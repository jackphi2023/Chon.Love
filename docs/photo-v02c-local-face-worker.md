# PHOTO-V02C — Local CPU face verification worker

Status: **implementation branch / release candidate. Do not enable the local provider in production until the worker has a real HTTPS deployment and health check.**

## Objective

Complete the provider replacement path proven in PHOTO-V02A and constrained by PHOTO-V02B:

- run YuNet + SFace on a normal CPU process/container rather than Supabase Edge;
- keep Supabase as the authority for Auth, Storage, moderation state and profile activation;
- remove face-comparison API-per-call dependency when the local worker is enabled;
- keep AWS behavior available as a compatibility fallback while rollout is incomplete;
- never trust a browser-provided verification decision;
- never persist face embeddings.

PHOTO-V02C does **not** claim camera liveness. The existing selfie screen captures a live camera frame, but presentation-attack/liveness protection is a separate follow-up.

## Architecture

```text
mobile selfie
    ↓ authenticated user request
Supabase member-photo-verification
    ├── stores private selfie
    ├── selects up to five usable profile media rows
    ├── creates short-lived signed Storage URLs
    ├── signs worker request with HMAC SHA-256
    ↓ HTTPS, server-to-server
photo-verification-worker
    ├── allowlists Storage host
    ├── downloads bounded image bytes
    ├── YuNet face detection + landmarks
    ├── SFace aligned embedding in process memory
    ├── returns raw cosine scores + quality diagnostics
    └── does not return embeddings
    ↓
Supabase member-photo-verification
    ├── validates request ID / engine / score range / media IDs
    ├── independently aggregates scores
    ├── applies Chon.Love server-side policy
    ├── resolves moderation case when approved
    └── calls activate_verified_signup_profile_v2 only on an approved server decision
```

The worker returns a `verified` diagnostic for its own smoke contract, but production activation does **not** trust that boolean. The Edge Function recomputes the final policy from raw validated profile scores.

## Local policy

PHOTO-V02C separates engine score from product presentation.

SFace produces cosine similarity in `[-1, 1]`. It is **not a percentage**. The implementation therefore does not turn a value such as `0.72` into `72%`.

Initial server defaults:

```text
LOCAL_FACE_COSINE_THRESHOLD = 0.363
LOCAL_FACE_MIN_STRONG_MATCHES = 2
```

The `0.363` value is OpenCV SFace's published LFW cosine reference threshold and is used only as a provisional rollout reference. It must not be treated as Chon.Love-specific calibration evidence.

For local auto-approval, Supabase requires all of:

1. at least `LOCAL_FACE_MIN_STRONG_MATCHES` usable profile scores;
2. at least that many scores at or above the configured cosine threshold;
3. median of the best three available profile scores at or above the threshold;
4. no provider/configuration/gender-consistency pending reason.

A member may still complete Signup V2 with one profile photo because the existing Photos contract allows one. With the default local policy, one usable reference photo is **not auto-approved**: the case stays `pending_review` and the UI offers `Cập nhật ảnh hồ sơ`.

Below-threshold local scores never automatically hide/delete an account. They route to moderation/manual review.

## Provider rollout

`member-photo-verification` remains provider-neutral and defaults to the existing AWS mode until rollout is explicitly changed.

### Supabase server secrets / environment

```text
FACE_COMPARISON_PROVIDER=local_worker
FACE_WORKER_URL=https://<worker-host>
FACE_WORKER_HMAC_SECRET=<same random secret as worker>
LOCAL_FACE_COSINE_THRESHOLD=0.363
LOCAL_FACE_MIN_STRONG_MATCHES=2
```

Supported `FACE_COMPARISON_PROVIDER` values:

- `aws` — compatibility default;
- `local_worker` — require the local worker; fail closed to pending if not configured;
- `auto` — prefer a configured local worker, otherwise use configured AWS.

An invalid provider value is treated as unconfigured rather than silently selecting a provider.

### Worker environment

See `services/photo-verification-worker/.env.example`.

Production requirements:

- HTTPS endpoint;
- strong `FACE_WORKER_HMAC_SECRET` held only in server-side secret stores;
- `FACE_ALLOWED_IMAGE_HOSTS` restricted to the Chon.Love Supabase Storage host;
- `FACE_ALLOW_HTTP_FOR_TESTS=false`;
- one worker process per container initially; scale horizontally if needed.

Do not put `FACE_WORKER_HMAC_SECRET` in Expo, Netlify public environment variables or repository files.

## Request authentication

Supabase sends:

```text
x-chon-timestamp
x-chon-request-id
x-chon-signature
```

Signature input:

```text
<unix timestamp>.<request id>.<exact JSON body>
```

Signature algorithm:

```text
HMAC-SHA256(shared-secret, signature-input)
```

The worker rejects:

- missing signatures;
- invalid signatures;
- expired timestamps outside the configured skew window;
- mismatch between signed request ID and JSON request ID.

The timestamp window limits simple replay. If a later threat model requires strict single-use replay prevention across workers, add a short-lived centralized nonce store before exposing the worker beyond the internal verification path.

## SSRF and image safety

The worker does not accept arbitrary browser URLs.

Supabase creates short-lived signed URLs for known media rows and the worker additionally requires:

- HTTPS in production;
- exact/suffix hostname allowlist;
- no URL credentials;
- bounded `Content-Length` when supplied;
- bounded streaming read even if `Content-Length` is missing or false;
- OpenCV decode validation;
- minimum 96 px image dimensions.

Selfie requires exactly one detected face. Profile images may contain more than one face for backward compatibility, but only the highest-confidence face is scored and diagnostics record the face count. A stricter profile-photo quality policy can be introduced after calibration without changing the provider contract.

## Biometric-data boundary

The worker creates SFace embeddings only in RAM for the duration of a request.

It does not:

- return embeddings;
- store embeddings;
- write to Supabase;
- receive a Supabase service-role key;
- receive Auth JWTs;
- receive user email/name/profile fields;
- log signed image URLs in application code.

Supabase stores only moderation diagnostics such as provider, raw cosine aggregates, matched media ID, counts, worker version/elapsed time and the existing private selfie storage path.

## Failure behavior

Fail closed means **pending review**, not automatic rejection.

Examples:

| Condition | Result |
|---|---|
| worker URL/secret missing | `face_comparison_provider_not_configured` |
| worker timeout/5xx/invalid response | `face_comparison_quality_or_provider_error` |
| no usable face score | `face_comparison_quality_or_provider_error` |
| too few usable reference photos | `face_reference_photos_insufficient_for_auto_approval` |
| local aggregate below threshold | `face_similarity_not_above_local_threshold` |
| declared gender changed during request | existing declared-profile-consistency pending path |
| local aggregate passes | moderation case resolved + existing activation RPC |

The user UI does not display a fake percentage for local cosine results.

## Docker deployment unit

Build from the isolated directory:

```bash
docker build -t chon-photo-worker services/photo-verification-worker
```

The image:

- pins Python/OpenCV/Numpy/FastAPI versions;
- downloads pinned YuNet INT8BQ and SFace INT8 assets during build;
- verifies their SHA-256 values;
- runs as non-root uid 10001;
- starts one Uvicorn worker.

A production platform must provide enough sustained CPU for the PHOTO-V02A workload. PHOTO-V02B proved that hosted Supabase Edge is not that platform.

## Automated acceptance

`.github/workflows/photo-v02c-local-face-worker.yml` performs an end-to-end Docker contract test:

1. download the public smoke image;
2. build the real worker container and model assets;
3. start an isolated local image server;
4. start the worker with a CI-only HMAC secret and local-only HTTP allowance;
5. require healthy model/auth/allowlist status;
6. send a correctly signed 1-selfie × 5-profile request;
7. assert five usable same-person scores and successful aggregate;
8. assert the response contains neither embeddings nor source image URL;
9. assert an unsigned verification request receives HTTP 401.

Repository CI/Database/Browser E2E/LX contracts remain required before release.

## Production activation checklist

Do not set `FACE_COMPARISON_PROVIDER=local_worker` until all items below are true:

1. V02C Docker contract is green on exact release head.
2. Standard repository CI, Database and Browser E2E gates are green.
3. Worker is deployed to an HTTPS CPU host.
4. `/healthz` reports `ok=true` on the deployed worker.
5. Worker secret is installed in both secret stores, never copied to client configuration.
6. Storage hostname allowlist is verified against an actual signed Chon.Love media URL.
7. A controlled production canary returns real finite local scores without activating a user incorrectly.
8. A same-person canary and an intentionally non-matching/quality-failure case both route as expected.
9. Only then switch `FACE_COMPARISON_PROVIDER` to `local_worker` or `auto`.
10. Keep admin manual-review path available throughout rollout.

## Accuracy limitation before broad auto-approval

The current `0.363` threshold comes from a public reference benchmark, not from Chon.Love members. PHOTO-V02A used one public identity transformed five ways, so it validates plumbing/performance only.

Before treating local auto-approval as high-confidence identity verification at scale, build a consented, representative validation set and measure false-match / false-non-match tradeoffs. Until that calibration exists, manual review remains the safety fallback for ambiguous cases.

## Remaining liveness gap

PHOTO-V02C verifies face similarity, not presentation liveness. A photo/video shown to the camera may still defeat simple camera capture depending on device/browser behavior.

A later liveness phase should add challenge/sequence-based or dedicated anti-spoof inference before claiming strong "người thật đang hiện diện trước camera" assurance.
