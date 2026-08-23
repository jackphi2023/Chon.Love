from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

ENGINE = "opencv_yunet_sface_cpu"
ENGINE_VERSION = "photo-v02c-1"
DEFAULT_COSINE_THRESHOLD = 0.363
DEFAULT_MIN_STRONG_MATCHES = 2
DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_REQUEST_SKEW_SECONDS = 300

YUNET_MODEL = Path(os.getenv("YUNET_MODEL_PATH", "/models/yunet_int8bq.onnx"))
SFACE_MODEL = Path(os.getenv("SFACE_MODEL_PATH", "/models/sface_int8.onnx"))
FACE_WORKER_HMAC_SECRET = os.getenv("FACE_WORKER_HMAC_SECRET", "")
COSINE_THRESHOLD = float(os.getenv("FACE_COSINE_THRESHOLD", str(DEFAULT_COSINE_THRESHOLD)))
MIN_STRONG_MATCHES = max(1, int(os.getenv("FACE_MIN_STRONG_MATCHES", str(DEFAULT_MIN_STRONG_MATCHES))))
MAX_IMAGE_BYTES = max(1024, int(os.getenv("FACE_MAX_IMAGE_BYTES", str(DEFAULT_MAX_IMAGE_BYTES))))
REQUEST_SKEW_SECONDS = max(30, int(os.getenv("FACE_REQUEST_SKEW_SECONDS", str(DEFAULT_REQUEST_SKEW_SECONDS))))
ALLOW_HTTP_FOR_TESTS = os.getenv("FACE_ALLOW_HTTP_FOR_TESTS", "false").lower() == "true"
ALLOWED_IMAGE_HOSTS = tuple(
    item.strip().lower()
    for item in os.getenv("FACE_ALLOWED_IMAGE_HOSTS", "").split(",")
    if item.strip()
)


class ImageRef(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    url: str = Field(min_length=8, max_length=4096)
    mimeType: str = Field(min_length=3, max_length=128)


class VerificationRequest(BaseModel):
    requestId: str = Field(min_length=8, max_length=128)
    selfie: ImageRef
    profiles: list[ImageRef] = Field(min_length=1, max_length=5)


@dataclass
class FaceEmbedding:
    vector: np.ndarray
    face_count: int
    selected_confidence: float


class FaceEngine:
    def __init__(self, yunet_model: Path, sface_model: Path) -> None:
        if not yunet_model.is_file() or not sface_model.is_file():
            raise RuntimeError("face_model_missing")
        self.detector = cv2.FaceDetectorYN_create(
            str(yunet_model),
            "",
            (320, 320),
            0.90,
            0.30,
            5000,
        )
        self.recognizer = cv2.FaceRecognizerSF_create(str(sface_model), "")

    def decode(self, payload: bytes) -> np.ndarray:
        if not payload or len(payload) > MAX_IMAGE_BYTES:
            raise ValueError("invalid_image_size")
        data = np.frombuffer(payload, dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise ValueError("image_decode_failed")
        return image

    def embedding(self, image: np.ndarray) -> FaceEmbedding:
        height, width = image.shape[:2]
        if width < 96 or height < 96:
            raise ValueError("image_too_small")
        self.detector.setInputSize((width, height))
        _, faces = self.detector.detect(image)
        if faces is None or len(faces) == 0:
            raise ValueError("no_face_detected")
        selected = max(faces, key=lambda row: float(row[-1]))
        aligned = self.recognizer.alignCrop(image, selected)
        vector = self.recognizer.feature(aligned)
        if vector is None or vector.size == 0 or not np.isfinite(vector).all():
            raise ValueError("invalid_face_embedding")
        return FaceEmbedding(
            vector=vector,
            face_count=int(len(faces)),
            selected_confidence=float(selected[-1]),
        )

    def cosine(self, left: np.ndarray, right: np.ndarray) -> float:
        score = float(self.recognizer.match(left, right, cv2.FaceRecognizerSF_FR_COSINE))
        if not math.isfinite(score):
            raise ValueError("non_finite_similarity")
        return score


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


_NO_REDIRECT_OPENER = urllib.request.build_opener(NoRedirectHandler())
app = FastAPI(title="Chon.Love Photo Verification Worker", version=ENGINE_VERSION)
_engine: FaceEngine | None = None


def engine() -> FaceEngine:
    global _engine
    if _engine is None:
        _engine = FaceEngine(YUNET_MODEL, SFACE_MODEL)
    return _engine


def host_allowed(hostname: str | None) -> bool:
    if not hostname or not ALLOWED_IMAGE_HOSTS:
        return False
    host = hostname.lower().rstrip(".")
    for rule in ALLOWED_IMAGE_HOSTS:
        candidate = rule.rstrip(".")
        if candidate.startswith("."):
            if host.endswith(candidate):
                return True
        elif host == candidate:
            return True
    return False


def fetch_image(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ({"https", "http"} if ALLOW_HTTP_FOR_TESTS else {"https"}):
        raise ValueError("image_url_scheme_not_allowed")
    if parsed.username or parsed.password or not host_allowed(parsed.hostname):
        raise ValueError("image_url_host_not_allowed")
    request = urllib.request.Request(url, headers={"User-Agent": "Chon.Love-PHOTO-V02C/1.0"})
    try:
        response = _NO_REDIRECT_OPENER.open(request, timeout=8)
    except urllib.error.HTTPError as error:
        if 300 <= error.code < 400:
            raise ValueError("image_redirect_not_allowed") from error
        raise
    with response:
        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_IMAGE_BYTES:
            raise ValueError("image_too_large")
        payload = response.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise ValueError("image_too_large")
    return payload


def signature_payload(timestamp: str, request_id: str, body: bytes) -> bytes:
    return timestamp.encode("utf-8") + b"." + request_id.encode("utf-8") + b"." + body


def verify_signature(body: bytes, timestamp: str | None, request_id: str | None, signature: str | None) -> None:
    if not FACE_WORKER_HMAC_SECRET:
        raise HTTPException(status_code=503, detail="worker_secret_not_configured")
    if not timestamp or not request_id or not signature:
        raise HTTPException(status_code=401, detail="worker_signature_required")
    try:
        request_time = int(timestamp)
    except ValueError as error:
        raise HTTPException(status_code=401, detail="invalid_worker_timestamp") from error
    if abs(int(time.time()) - request_time) > REQUEST_SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="worker_timestamp_expired")
    expected = hmac.new(
        FACE_WORKER_HMAC_SECRET.encode("utf-8"),
        signature_payload(timestamp, request_id, body),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature.lower()):
        raise HTTPException(status_code=401, detail="invalid_worker_signature")


def safe_error(error: Exception) -> str:
    message = str(error)
    allowed = {
        "invalid_image_size",
        "image_decode_failed",
        "image_too_small",
        "no_face_detected",
        "multiple_faces_detected",
        "invalid_face_embedding",
        "non_finite_similarity",
        "image_url_scheme_not_allowed",
        "image_url_host_not_allowed",
        "image_redirect_not_allowed",
        "image_too_large",
    }
    return message if message in allowed else error.__class__.__name__


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    ready = bool(FACE_WORKER_HMAC_SECRET and ALLOWED_IMAGE_HOSTS and YUNET_MODEL.is_file() and SFACE_MODEL.is_file())
    return {
        "ok": ready,
        "engine": ENGINE,
        "version": ENGINE_VERSION,
        "opencvVersion": cv2.__version__,
        "modelsPresent": YUNET_MODEL.is_file() and SFACE_MODEL.is_file(),
        "authConfigured": bool(FACE_WORKER_HMAC_SECRET),
        "imageHostAllowlistConfigured": bool(ALLOWED_IMAGE_HOSTS),
    }


@app.post("/v1/verify")
async def verify(
    request: Request,
    x_chon_timestamp: str | None = Header(default=None),
    x_chon_request_id: str | None = Header(default=None),
    x_chon_signature: str | None = Header(default=None),
) -> dict[str, Any]:
    started = time.perf_counter()
    body = await request.body()
    verify_signature(body, x_chon_timestamp, x_chon_request_id, x_chon_signature)
    try:
        parsed = VerificationRequest.model_validate_json(body)
    except Exception as error:
        raise HTTPException(status_code=400, detail="invalid_verification_payload") from error
    if parsed.requestId != x_chon_request_id:
        raise HTTPException(status_code=400, detail="request_id_mismatch")

    face_engine = engine()
    errors: list[str] = []

    try:
        selfie_bytes = fetch_image(parsed.selfie.url)
        selfie_embedding = face_engine.embedding(face_engine.decode(selfie_bytes))
    except Exception as error:
        return {
            "requestId": parsed.requestId,
            "engine": ENGINE,
            "version": ENGINE_VERSION,
            "verified": False,
            "decisionReason": "selfie_quality_error",
            "cosineThreshold": COSINE_THRESHOLD,
            "minimumStrongMatches": MIN_STRONG_MATCHES,
            "maxCosineSimilarity": None,
            "top3MedianCosine": None,
            "strongMatchCount": 0,
            "usableProfileCount": 0,
            "attemptedProfileCount": len(parsed.profiles),
            "selfieFaceCount": 0,
            "profileScores": [],
            "errors": [f"selfie:{safe_error(error)}"],
            "elapsedMs": round((time.perf_counter() - started) * 1000.0, 3),
        }

    if selfie_embedding.face_count != 1:
        return {
            "requestId": parsed.requestId,
            "engine": ENGINE,
            "version": ENGINE_VERSION,
            "verified": False,
            "decisionReason": "selfie_face_count_not_one",
            "cosineThreshold": COSINE_THRESHOLD,
            "minimumStrongMatches": MIN_STRONG_MATCHES,
            "maxCosineSimilarity": None,
            "top3MedianCosine": None,
            "strongMatchCount": 0,
            "usableProfileCount": 0,
            "attemptedProfileCount": len(parsed.profiles),
            "selfieFaceCount": selfie_embedding.face_count,
            "profileScores": [],
            "errors": [],
            "elapsedMs": round((time.perf_counter() - started) * 1000.0, 3),
        }

    scores: list[dict[str, Any]] = []
    for profile in parsed.profiles:
        try:
            profile_bytes = fetch_image(profile.url)
            profile_embedding = face_engine.embedding(face_engine.decode(profile_bytes))
            if profile_embedding.face_count != 1:
                raise ValueError("multiple_faces_detected")
            cosine = face_engine.cosine(selfie_embedding.vector, profile_embedding.vector)
            scores.append(
                {
                    "mediaId": profile.id,
                    "cosineSimilarity": round(cosine, 6),
                    "faceCount": profile_embedding.face_count,
                    "selectedFaceConfidence": round(profile_embedding.selected_confidence, 6),
                    "strongMatch": cosine >= COSINE_THRESHOLD,
                }
            )
        except Exception as error:
            errors.append(f"{profile.id}:{safe_error(error)}")

    finite_scores = [float(item["cosineSimilarity"]) for item in scores]
    strong_match_count = sum(1 for item in scores if bool(item["strongMatch"]))
    top3 = sorted(finite_scores, reverse=True)[:3]
    top3_median = float(statistics.median(top3)) if top3 else None
    max_cosine = max(finite_scores) if finite_scores else None

    if len(scores) < MIN_STRONG_MATCHES:
        verified = False
        decision_reason = "insufficient_usable_profile_photos"
    elif strong_match_count < MIN_STRONG_MATCHES:
        verified = False
        decision_reason = "insufficient_strong_matches"
    elif top3_median is None or top3_median < COSINE_THRESHOLD:
        verified = False
        decision_reason = "aggregate_similarity_below_threshold"
    else:
        verified = True
        decision_reason = "verified"

    return {
        "requestId": parsed.requestId,
        "engine": ENGINE,
        "version": ENGINE_VERSION,
        "verified": verified,
        "decisionReason": decision_reason,
        "cosineThreshold": COSINE_THRESHOLD,
        "minimumStrongMatches": MIN_STRONG_MATCHES,
        "maxCosineSimilarity": None if max_cosine is None else round(max_cosine, 6),
        "top3MedianCosine": None if top3_median is None else round(top3_median, 6),
        "strongMatchCount": strong_match_count,
        "usableProfileCount": len(scores),
        "attemptedProfileCount": len(parsed.profiles),
        "selfieFaceCount": selfie_embedding.face_count,
        "selfieSelectedFaceConfidence": round(selfie_embedding.selected_confidence, 6),
        "profileScores": scores,
        "errors": errors,
        "elapsedMs": round((time.perf_counter() - started) * 1000.0, 3),
    }
