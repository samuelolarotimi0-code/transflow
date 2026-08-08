import json
import os
import sys
from pathlib import Path

try:
    import whisper
except Exception as exc:  # pragma: no cover
    raise SystemExit(f"whisper import failed: {exc}")

wav_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
if not wav_path or not wav_path.exists():
    raise SystemExit("audio file not found")

model_name = os.environ.get("WHISPER_MODEL", "base")
model = whisper.load_model(model_name)
result = model.transcribe(str(wav_path), fp16=False)
print(result.get("text", "").strip())
