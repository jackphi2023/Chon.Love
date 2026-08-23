from __future__ import annotations

import hashlib
import os
import tempfile
import urllib.request
from pathlib import Path

ASSETS = {
    "yunet_int8bq.onnx": (
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar_int8bq.onnx",
        "49f000ec501fef24739071fc7e68267d32209045b6822c0c72dce1da25726f10",
    ),
    "sface_int8.onnx": (
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx",
        "2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Chon.Love-PHOTO-V02C/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def main() -> int:
    destination = Path(os.getenv("MODEL_DIR", "/models"))
    destination.mkdir(parents=True, exist_ok=True)
    for filename, (url, expected) in ASSETS.items():
        target = destination / filename
        if target.is_file() and sha256(target) == expected:
            print(f"verified existing {filename}")
            continue
        with tempfile.NamedTemporaryFile(dir=destination, delete=False) as temp:
            temp_path = Path(temp.name)
        try:
            download(url, temp_path)
            actual = sha256(temp_path)
            if actual != expected:
                raise RuntimeError(f"checksum_mismatch:{filename}:{actual}")
            temp_path.replace(target)
            print(f"downloaded and verified {filename}")
        finally:
            temp_path.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
