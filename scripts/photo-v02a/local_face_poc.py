#!/usr/bin/env python3
"""PHOTO-V02A local face-verification proof of concept.

This script intentionally does not touch production Supabase data. It benchmarks
YuNet + SFace on CPU using one source face and five deterministic profile-photo
variants. The generated variants are for runtime/sanity validation only; they
are not an accuracy-calibration dataset.
"""

from __future__ import annotations

import argparse
import json
import math
import resource
import statistics
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np

SFACE_REFERENCE_COSINE_THRESHOLD = 0.363
PROFILE_VARIANT_COUNT = 5


@dataclass
class IterationResult:
    total_ms: float
    selfie_embedding_ms: float
    profile_embedding_ms: float
    compare_ms: float
    scores: list[float]
    strong_matches: int
    top3_median: float


def elapsed_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000.0


def rss_mb() -> float:
    # Linux reports ru_maxrss in KiB; macOS reports bytes. GitHub Actions uses Linux.
    value = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    return value / 1024.0


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, math.ceil(p * len(ordered)) - 1))
    return ordered[rank]


def make_profile_variants(image: np.ndarray) -> list[np.ndarray]:
    h, w = image.shape[:2]
    center = (w / 2.0, h / 2.0)
    rotate_left = cv2.warpAffine(image, cv2.getRotationMatrix2D(center, -4.0, 1.0), (w, h), borderMode=cv2.BORDER_REFLECT)
    rotate_right = cv2.warpAffine(image, cv2.getRotationMatrix2D(center, 4.0, 1.0), (w, h), borderMode=cv2.BORDER_REFLECT)
    brighter = cv2.convertScaleAbs(image, alpha=1.0, beta=18)
    softer_contrast = cv2.convertScaleAbs(image, alpha=0.90, beta=8)
    return [image.copy(), rotate_left, rotate_right, brighter, softer_contrast]


class LocalSFaceVerifier:
    def __init__(self, yunet_model: Path, sface_model: Path) -> None:
        started = time.perf_counter()
        self.detector = cv2.FaceDetectorYN_create(
            str(yunet_model),
            "",
            (320, 320),
            0.90,
            0.30,
            5000,
        )
        self.recognizer = cv2.FaceRecognizerSF_create(str(sface_model), "")
        self.model_load_ms = elapsed_ms(started)

    def embedding(self, image: np.ndarray) -> np.ndarray:
        if image is None or image.size == 0:
            raise ValueError("empty_image")
        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        if faces is None or len(faces) == 0:
            raise ValueError("no_face_detected")
        # Prefer the most confident face. Signup quality rules can reject multiple
        # faces later; this POC only validates the local inference pipeline.
        face = max(faces, key=lambda row: float(row[-1]))
        aligned = self.recognizer.alignCrop(image, face)
        return self.recognizer.feature(aligned)

    def cosine(self, left: np.ndarray, right: np.ndarray) -> float:
        return float(self.recognizer.match(left, right, cv2.FaceRecognizerSF_FR_COSINE))


def run_iteration(verifier: LocalSFaceVerifier, selfie: np.ndarray, profiles: list[np.ndarray]) -> IterationResult:
    total_started = time.perf_counter()

    started = time.perf_counter()
    selfie_embedding = verifier.embedding(selfie)
    selfie_ms = elapsed_ms(started)

    started = time.perf_counter()
    profile_embeddings = [verifier.embedding(image) for image in profiles]
    profile_ms = elapsed_ms(started)

    started = time.perf_counter()
    scores = [verifier.cosine(selfie_embedding, embedding) for embedding in profile_embeddings]
    compare_ms = elapsed_ms(started)

    strong_matches = sum(score >= SFACE_REFERENCE_COSINE_THRESHOLD for score in scores)
    top3 = sorted(scores, reverse=True)[:3]
    top3_median = float(statistics.median(top3))

    return IterationResult(
        total_ms=elapsed_ms(total_started),
        selfie_embedding_ms=selfie_ms,
        profile_embedding_ms=profile_ms,
        compare_ms=compare_ms,
        scores=[round(score, 6) for score in scores],
        strong_matches=strong_matches,
        top3_median=round(top3_median, 6),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--yunet", required=True, type=Path)
    parser.add_argument("--sface", required=True, type=Path)
    parser.add_argument("--selfie", required=True, type=Path)
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    image = cv2.imread(str(args.selfie), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"cannot_read_selfie:{args.selfie}")

    profiles = make_profile_variants(image)
    if len(profiles) != PROFILE_VARIANT_COUNT:
        raise SystemExit("profile_variant_generation_failed")

    process_started = time.perf_counter()
    verifier = LocalSFaceVerifier(args.yunet, args.sface)
    first = run_iteration(verifier, image, profiles)
    warm = [run_iteration(verifier, image, profiles) for _ in range(max(1, args.iterations))]
    process_ms = elapsed_ms(process_started)

    warm_totals = [item.total_ms for item in warm]
    peak_rss_mb = rss_mb()
    # Screening gate only. Supabase Edge must still be benchmarked inside its own
    # runtime before production use because GitHub-hosted CPU != Edge CPU quota.
    edge_screening_candidate = percentile(warm_totals, 0.95) <= 1500.0 and peak_rss_mb <= 180.0

    report = {
        "poc": "PHOTO-V02A",
        "engine": "opencv_yunet_sface_cpu",
        "opencv_version": cv2.__version__,
        "reference_cosine_threshold": SFACE_REFERENCE_COSINE_THRESHOLD,
        "profile_image_count": PROFILE_VARIANT_COUNT,
        "model_load_ms": round(verifier.model_load_ms, 3),
        "cold_verification": asdict(first),
        "warm_verifications": [asdict(item) for item in warm],
        "warm_summary": {
            "median_ms": round(statistics.median(warm_totals), 3),
            "p95_ms": round(percentile(warm_totals, 0.95), 3),
            "min_ms": round(min(warm_totals), 3),
            "max_ms": round(max(warm_totals), 3),
        },
        "peak_rss_mb": round(peak_rss_mb, 3),
        "process_elapsed_ms": round(process_ms, 3),
        "edge_screening_candidate": edge_screening_candidate,
        "edge_screening_note": "GitHub runner benchmark only; production Edge CPU/RAM benchmark is still required.",
        "accuracy_note": "Synthetic variants of one public sample validate plumbing/runtime only; do not calibrate production thresholds from this run.",
    }

    # Functional sanity: all five deterministic same-person variants must yield
    # finite scores and a majority must exceed OpenCV's published LFW reference.
    if any(not math.isfinite(score) for score in first.scores):
        raise SystemExit("non_finite_similarity_score")
    if first.strong_matches < 3:
        raise SystemExit(f"local_face_sanity_failed:strong_matches={first.strong_matches}")

    payload = json.dumps(report, ensure_ascii=False, indent=2)
    print(payload)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
