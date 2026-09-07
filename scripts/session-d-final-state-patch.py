from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


comparison = "supabase/functions/member-photo-verification/index.ts"
replace_once(
    comparison,
    "  'face_liveness_reference_image_missing',\n]);",
    "  'face_liveness_reference_image_missing',\n  'face_liveness_reference_image_unsupported_format',\n]);",
)
