# PHOTO-V02B — Supabase Edge local-AI runtime POC

Status: **POC branch only. Do not merge to `main`.**

## Goal

Test the local face-verification stack from PHOTO-V02A inside the **real hosted Supabase Edge Runtime** before changing production signup verification.

PHOTO-V02B deliberately does **not**:

- modify `member-photo-verification`;
- read profile photos, selfies, Auth users or Storage objects;
- write any application database row;
- approve, reject or activate a member;
- change Netlify or the member UI;
- persist face embeddings.

The benchmark uses synthetic tensors only.

## Hosted Edge constraints

At the time of this POC, Supabase documents a hosted Edge memory limit of 256 MB and a CPU-time limit of 2 seconds per request. The Management API also has a smaller function-bundle limit than CLI deployment. These constraints are materially different from the GitHub CPU runner used by PHOTO-V02A.

## Runtime compatibility findings

### ONNX Runtime Web 1.27.0 — rejected for this Edge runtime

Two independent failures were reproduced in hosted Supabase Edge:

1. The thin ESM build reached a dynamic import for `ort-wasm-simd-threaded.mjs`, but the Edge runtime could not load that module dynamically at request time.
2. The bundled WASM build progressed further, then failed with:

```text
no available backend found. ERR: [wasm] TypeError: Creating a shared memory is not supported
```

Current ORT 1.27 WASM artifacts are threaded/shared-memory builds, so `numThreads = 1` does not remove their shared-memory requirement.

### ONNX Runtime Web 1.17.3 — compatible fallback for a POC

ORT 1.17.3 still ships non-threaded WASM artifacts. With:

```text
onnxruntime-web 1.17.3
numThreads = 1
proxy = false
```

the hosted Edge runtime initialized `InferenceSession` and `Tensor` successfully.

This old ORT version is acceptable only for compatibility benchmarking. It should not become a long-lived production dependency without a separate security/support review.

## Model verification

The exact model bytes were downloaded and SHA-256 checked **inside the hosted Edge runtime**.

| Model | Variant | Bytes | SHA-256 | Result |
|---|---:|---:|---|---|
| YuNet | `2023mar_int8bq` | 122,489 | `49f000ec501fef24739071fc7e68267d32209045b6822c0c72dce1da25726f10` | Binary correct; ORT 1.17.3 session creation aborts with numeric WASM exception `9123152` |
| YuNet | `2023mar` FP32 | 232,589 | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` | Session creation succeeds |
| SFace | `2021dec_int8` | 9,896,933 | `2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a` | Session creation succeeds |

The viable Edge POC combination is therefore:

```text
YuNet 2023mar FP32
+
SFace 2021dec INT8
+
ONNX Runtime Web 1.17.3 non-threaded WASM
```

## Session evidence

### SFace INT8

```text
createSessionMs = 477.88 ms
input           = data
output          = fc1
request wall    = 524.276 ms
```

### YuNet FP32

```text
createSessionMs = 609.619 ms
input           = input
input shape     = 1 x 3 x 640 x 640
outputs         = cls/obj/bbox/kps at strides 8/16/32
request wall    = 630.69 ms
```

YuNet INT8BQ was rejected because session creation aborted under the old non-threaded ORT runtime. Using FP32 is cheap in model size but expensive in inference CPU at 640x640.

## Actual hosted inference benchmark

The final benchmark creates no member images. It runs constant synthetic tensors matching the official model shapes.

One `copy` means:

```text
1 YuNet 640x640 detector run
+
1 SFace 112x112 embedding run
```

### 1 detector + 1 embedding

Run A:

```text
HTTP              200
cold              true
sessionReadyMs     586.79 ms
inferenceMs        1006.65 ms
totalWallMs        1593.44 ms
```

Run B:

```text
HTTP              200
cold              true
sessionReadyMs     645.08 ms
inferenceMs        1055.55 ms
totalWallMs        1700.63 ms
```

Both successive requests reported `cold=true`; the benchmark therefore cannot assume session reuse between hosted requests.

### 2 detectors + 2 embeddings

```text
HTTP 546
WORKER_RESOURCE_LIMIT
Edge execution time in platform log: 3384 ms
```

The platform response was:

```text
Function failed due to not having enough compute resources
```

A prior attempt to approximate the real signup workload with 6 detector + 6 embedding runs also did not return within the 5-second HTTP caller window.

## Verdict

**Supabase Edge is technically capable of loading and running the local models, but it is not a safe production host for Chon.Love face verification.**

The reason is compute budget, not model correctness:

- one detector + embedding pair already consumes about 1.0–1.06 seconds of inference plus cold session setup;
- two pairs hit `WORKER_RESOURCE_LIMIT`;
- real signup requires one selfie plus 3–5 profile photos, quality checks, face alignment, score aggregation, Storage IO and moderation persistence;
- production therefore has substantially more work than the benchmark that already fails at two pairs.

Do **not** replace AWS in `member-photo-verification` by embedding YuNet/SFace directly inside Supabase Edge.

## Recommended PHOTO-V02C architecture

Keep Supabase as the authority for Auth, Storage, moderation state and activation, but move local inference to a CPU runtime with a normal process/container budget:

```text
member-photo-verification / orchestration
        ↓ server-to-server authenticated request
local face worker
        ├── YuNet
        ├── SFace
        ├── quality checks
        ├── embeddings in RAM only
        └── multi-photo aggregate
        ↓ signed result
Supabase moderation + activation RPC
```

Candidate runtimes for the next POC:

1. regular serverless CPU Function that supports native ONNX/OpenCV and a longer CPU window; or
2. a minimal self-hosted Docker CPU service.

This removes AWS Rekognition/API-per-call cost while avoiding the Supabase Edge CPU ceiling. Infrastructure compute is still a resource and should not be described as permanently free; at beta scale it can often fit inside an existing quota or very small CPU host.

## Security rules for the next phase

- Final verification decision remains server-side.
- Worker accepts only authenticated internal requests.
- Worker fetches or receives trusted server-side image bytes; it never trusts `verified=true` or a score supplied by the browser.
- Face embeddings stay ephemeral in memory unless there is a separately reviewed biometric-data requirement.
- Raw similarity is an admin diagnostic, not a fake end-user percentage.
- Low confidence routes to retry/manual review instead of automatic account deletion.

## Production cleanup after the POC

The temporary hosted function `photo-v02b-local-ai-poc` was redeployed after testing as a dormant locked endpoint:

```text
version    13
status     ACTIVE
verify_jwt true
behavior   403 / locked_after_benchmark
```

It contains no benchmark nonce and no model inference path. Production `member-photo-verification` remains unchanged.
