# PHOTO-V02A — Local AI face verification POC

Status: **POC branch only. Do not merge to `main` yet.**

## Goal

Validate a zero-per-call face-comparison engine for Chon.Love using locally executed OpenCV models instead of AWS Rekognition:

- YuNet for face detection / landmarks.
- SFace for aligned face embeddings and cosine similarity.
- CPU-only inference.
- One selfie compared with five profile-photo variants.
- No production user data and no Supabase production writes.

The existing `member-photo-verification` production Edge Function remains untouched in PHOTO-V02A. This avoids replacing a working release path before the local model runtime has been measured.

## Pinned POC assets

The download script uses OpenCV-organization model mirrors and verifies SHA-256 before execution.

| Model | File | SHA-256 |
|---|---|---|
| YuNet | `face_detection_yunet_2023mar_int8bq.onnx` | `49f000ec501fef24739071fc7e68267d32209045b6822c0c72dce1da25726f10` |
| SFace | `face_recognition_sface_2021dec_int8.onnx` | `2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a` |

Models are downloaded during the POC workflow and are **not committed to the Chon.Love repository**.

## Benchmark path

```text
public OpenCV sample image
        ↓
make 5 deterministic profile variants
        ↓
YuNet detect + landmarks
        ↓
SFace alignCrop + embedding
        ↓
1 selfie × 5 cosine comparisons
        ↓
strong match count + top-3 median
        ↓
latency / RSS report
```

The variants validate runtime plumbing and same-person sanity only. They are **not** a production threshold-calibration dataset.

## Reference threshold

The POC records OpenCV SFace's published LFW cosine reference threshold (`0.363`) only as a sanity reference. Chon.Love must not convert this directly to a fake percentage or use it as the final auto-approval threshold without calibration on a consented representative dataset.

Future production policy should aggregate multiple profile images rather than use a single maximum score.

## Screening gate

The GitHub Actions benchmark emits:

- model initialization time;
- cold verification time;
- warm median and p95 time;
- selfie embedding time;
- five-profile embedding time;
- comparison time;
- peak RSS;
- five raw cosine scores;
- strong match count;
- top-3 median.

A provisional `edge_screening_candidate` is `true` only when GitHub-runner warm p95 is <= 1500 ms and peak RSS is <= 180 MB. This is intentionally stricter than the hosted Supabase limits to leave headroom.

**Important:** this is only a screening signal. GitHub-hosted CPU performance is not equivalent to Supabase Edge Runtime CPU quota. A separate in-runtime benchmark is required before using this engine inside `member-photo-verification`.

## Security and privacy constraints retained

PHOTO-V02A deliberately does not:

- accept a client-provided `verified=true` decision;
- persist face embeddings;
- write biometric vectors to public tables;
- expose service-role credentials;
- modify activation rules;
- infer gender from facial appearance;
- touch real member moderation cases.

The eventual production verifier must download original profile images server-side and make the final decision server-side.

## Why the production AWS path is not removed yet

`member-photo-verification` is currently production-critical. Replacing Rekognition before proving model compatibility, memory use, CPU latency and deployment packaging would create a new signup outage risk.

PHOTO-V02A therefore proves the local engine first. If the benchmark is healthy, PHOTO-V02B can introduce a provider-neutral interface and a local provider behind an explicit feature flag. If Edge Runtime is not viable, the same local model can move to a CPU function/container without reintroducing a paid face API.

## Manual run

```bash
bash scripts/photo-v02a/download-assets.sh .photo-v02a
python -m pip install opencv-python-headless==4.14.0.94 numpy==2.3.2
python scripts/photo-v02a/local_face_poc.py \
  --yunet .photo-v02a/models/yunet_int8bq.onnx \
  --sface .photo-v02a/models/sface_int8.onnx \
  --selfie .photo-v02a/samples/lena.jpg \
  --iterations 7 \
  --output artifacts/photo-v02a-benchmark.json
```

## Exit criteria for PHOTO-V02A

1. Pinned model downloads pass checksum verification.
2. YuNet detects the face and SFace produces finite embeddings.
3. One selfie × five same-person variants produces five finite cosine scores.
4. At least three variants exceed the SFace reference threshold.
5. Benchmark artifact is uploaded by GitHub Actions.
6. Latency and peak RSS are recorded.
7. No production function/database deployment occurs.
