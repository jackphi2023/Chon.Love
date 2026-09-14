#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.photo-v02a}"
MODEL_DIR="$ROOT_DIR/models"
SAMPLE_DIR="$ROOT_DIR/samples"
mkdir -p "$MODEL_DIR" "$SAMPLE_DIR"

# Official OpenCV organization mirrors on Hugging Face. The binary checksums
# below are published on the file pages and make this POC fail closed if the
# hosted artifacts change unexpectedly.
YUNET_URL='https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar_int8bq.onnx?download=true'
YUNET_SHA256='49f000ec501fef24739071fc7e68267d32209045b6822c0c72dce1da25726f10'
SFACE_URL='https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec_int8.onnx?download=true'
SFACE_SHA256='2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a'
LENA_URL='https://raw.githubusercontent.com/opencv/opencv/4.x/samples/data/lena.jpg'

fetch() {
  local url="$1"
  local output="$2"
  curl --fail --location --retry 3 --retry-delay 2 --silent --show-error "$url" --output "$output"
}

verify_sha256() {
  local expected="$1"
  local file="$2"
  echo "$expected  $file" | sha256sum --check --status || {
    echo "Checksum mismatch: $file" >&2
    sha256sum "$file" >&2
    exit 1
  }
}

fetch "$YUNET_URL" "$MODEL_DIR/yunet_int8bq.onnx"
verify_sha256 "$YUNET_SHA256" "$MODEL_DIR/yunet_int8bq.onnx"

fetch "$SFACE_URL" "$MODEL_DIR/sface_int8.onnx"
verify_sha256 "$SFACE_SHA256" "$MODEL_DIR/sface_int8.onnx"

# Public OpenCV sample used only for runtime/sanity benchmarking. Production
# threshold calibration must use a consented, representative Chon.Love dataset.
fetch "$LENA_URL" "$SAMPLE_DIR/lena.jpg"

echo "PHOTO-V02A assets ready in $ROOT_DIR"
ls -lh "$MODEL_DIR" "$SAMPLE_DIR"
