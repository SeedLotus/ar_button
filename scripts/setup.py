"""Download MediaPipe dependencies for offline/local development.

Run once after cloning:
    python scripts/setup.py

Downloads:
  - vendor/vision_bundle.mjs      (MediaPipe Tasks Vision ES module)
  - wasm/vision_wasm_*.js/wasm    (WebAssembly binaries & loaders)
  - models/hand_landmarker.task   (Hand landmarker model)

Requires Python 3.8+ (stdlib only, no pip install needed).
"""

import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
MODEL_URL = (
    "https://mediapipe-models.storage.googleapis.com/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

FILES = {
    ROOT / "vendor" / "vision_bundle.mjs": f"{CDN}/vision_bundle.mjs",
    ROOT / "wasm" / "vision_wasm_internal.js": f"{CDN}/wasm/vision_wasm_internal.js",
    ROOT / "wasm" / "vision_wasm_internal.wasm": f"{CDN}/wasm/vision_wasm_internal.wasm",
    ROOT / "wasm" / "vision_wasm_nosimd_internal.js": f"{CDN}/wasm/vision_wasm_nosimd_internal.js",
    ROOT / "wasm" / "vision_wasm_nosimd_internal.wasm": f"{CDN}/wasm/vision_wasm_nosimd_internal.wasm",
    ROOT / "models" / "hand_landmarker.task": MODEL_URL,
}


def download(url: str, dest: Path) -> bool:
    if dest.exists():
        print(f"  SKIP (exists): {dest.name}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  DOWNLOAD {dest.name} ...", end=" ", flush=True)

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        dest.write_bytes(data)
        size_kb = len(data) / 1024
        unit = "KB" if size_kb < 1024 else "MB"
        size = size_kb if size_kb < 1024 else size_kb / 1024
        print(f"OK ({size:.1f} {unit})")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        # Clean up partial download
        if dest.exists():
            dest.unlink()
        return False


def main() -> int:
    print("Object Drum Studio — MediaPipe dependency setup\n")

    failed = []
    for dest, url in FILES.items():
        if not download(url, dest):
            failed.append(dest.name)

    if failed:
        print(f"\nFAILED: {len(failed)} file(s) could not be downloaded:")
        for name in failed:
            print(f"  - {name}")
        print("\nCheck your network connection and try again.")
        return 1
    else:
        print("\nAll dependencies ready. Run `python scripts/no-cache-server.py 5178` to start.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
