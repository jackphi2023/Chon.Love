from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.request
import uuid

WORKER_URL = os.environ.get("SMOKE_WORKER_URL", "http://127.0.0.1:8088").rstrip("/")
IMAGE_BASE_URL = os.environ["SMOKE_IMAGE_BASE_URL"].rstrip("/")
SECRET = os.environ["FACE_WORKER_HMAC_SECRET"]


def signed_request(payload: dict[str, object]) -> dict[str, object]:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    request_id = str(payload["requestId"])
    timestamp = str(int(time.time()))
    signature = hmac.new(
        SECRET.encode("utf-8"),
        timestamp.encode("utf-8") + b"." + request_id.encode("utf-8") + b"." + body,
        hashlib.sha256,
    ).hexdigest()
    request = urllib.request.Request(
        f"{WORKER_URL}/v1/verify",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-chon-timestamp": timestamp,
            "x-chon-request-id": request_id,
            "x-chon-signature": signature,
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    request_id = str(uuid.uuid4())
    image_url = f"{IMAGE_BASE_URL}/lena.jpg"
    payload: dict[str, object] = {
        "requestId": request_id,
        "selfie": {"id": "selfie", "url": image_url, "mimeType": "image/jpeg"},
        "profiles": [
            {"id": f"profile-{index}", "url": image_url, "mimeType": "image/jpeg"}
            for index in range(1, 6)
        ],
    }
    result = signed_request(payload)
    assert result["requestId"] == request_id
    assert result["engine"] == "opencv_yunet_sface_cpu"
    assert result["verified"] is True
    assert int(result["strongMatchCount"]) >= 2
    assert int(result["usableProfileCount"]) == 5
    assert float(result["maxCosineSimilarity"]) >= 0.99
    assert float(result["top3MedianCosine"]) >= 0.99
    serialized = json.dumps(result)
    assert "embedding" not in serialized.lower()
    assert image_url not in serialized
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
