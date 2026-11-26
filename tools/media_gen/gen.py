"""대개편 시제품 사진 · 음악 만들기 (공용) — 게임별 목록 JSON 을 받아 Gemini 이미지 · Lyria 로 만든다

실행 (GEMINI_API_KEY 필요, 키는 출력하지 않는다 · 생성은 메인 세션만):
  python gen.py <목록.json> --out <frontend/public/<게임>> [--only a,b] [--force] [--dry-run]
목록 형식: {"style": "...공통 문구", "images": {"이름": {"prompt": "...", "aspect": "3:4"}},
           "music": {"이름": {"prompt": "...", "long": true}}}
결과: img/<이름>.webp (긴 변 1280px) · music/<이름>.mp3
비용(대략): 이미지 장당 $0.067(gemini-3.1-flash-image, case_batch costs.py 와 같은 단가) · 2분 곡 $0.08 · 30초 곡 $0.04 — 기록은 reports/media_budget.md
모든 장면은 지어낸 것 — 실존 장소 · 인물 · 상표 · 글자 없음 (법적 검토)
"""
import argparse
import asyncio
import io
import json
import os
import sys
from pathlib import Path

IMAGE_MODEL = os.getenv("MEDIA_IMAGE_MODEL", "gemini-3.1-flash-image")
MUSIC_LONG = os.getenv("MEDIA_MUSIC_MODEL", "lyria-3.5")
MUSIC_CLIP = os.getenv("MEDIA_MUSIC_CLIP_MODEL", "lyria-3-clip-preview")
ASPECTS = {"1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"}


def to_webp(data: bytes, edge: int = 1280) -> bytes:
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert("RGB")
    if max(im.size) > edge:
        k = edge / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, "WEBP", quality=82, method=6)
    return out.getvalue()


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    style = spec.get("style", "")
    only = {x for x in a.only.split(",") if x}
    imgs = {n: v for n, v in spec.get("images", {}).items() if not only or n in only}
    mus = {n: v for n, v in spec.get("music", {}).items() if not only or n in only}
    for n, v in imgs.items():
        if v.get("aspect", "1:1") not in ASPECTS:
            print(f"비율 오류 {n}: {v.get('aspect')}")
            return 2
    est = len(imgs) * 0.067 + sum(0.08 if v.get("long") else 0.04 for v in mus.values())
    print(f"만들 것: 이미지 {len(imgs)}장 · 곡 {len(mus)}개 (최대 약 ${est:.2f})", flush=True)
    if a.dry_run:
        return 0
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("GEMINI_API_KEY 없음")
        return 2
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=240_000, api_version="v1beta"))
    out = Path(a.out)
    (out / "img").mkdir(parents=True, exist_ok=True)
    (out / "music").mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(3)
    spent = {"img": 0, "long": 0, "clip": 0}

    async def image(name, v):
        p = out / "img" / f"{name}.webp"
        if p.exists() and not a.force:
            return
        async with sem:
            for attempt in range(3):
                try:
                    res = await client.aio.models.generate_content(
                        model=IMAGE_MODEL, contents=style + v["prompt"],
                        config=types.GenerateContentConfig(response_modalities=["IMAGE"],
                                                           image_config=types.ImageConfig(aspect_ratio=v.get("aspect", "1:1"))))
                    for cand in res.candidates or []:
                        for part in (cand.content.parts if cand.content else []) or []:
                            if part.inline_data and part.inline_data.data:
                                p.write_bytes(to_webp(part.inline_data.data))
                                spent["img"] += 1
                                print(f"이미지 완료 {name} {p.stat().st_size // 1024}KB", flush=True)
                                return
                    print(f"이미지 없음 {name} (시도 {attempt + 1})", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"이미지 실패 {name} {type(e).__name__}: {str(e)[:160]}", flush=True)
            print(f"이미지 포기 {name}", flush=True)

    async def music(name, v):
        p = out / "music" / f"{name}.mp3"
        if p.exists() and not a.force:
            return
        model = MUSIC_LONG if v.get("long") else MUSIC_CLIP
        async with sem:
            for attempt in range(2):
                try:
                    res = await client.aio.models.generate_content(model=model, contents=v["prompt"])
                    for cand in res.candidates or []:
                        for part in (cand.content.parts if cand.content else []) or []:
                            if part.inline_data and part.inline_data.data:
                                p.write_bytes(part.inline_data.data)
                                spent["long" if v.get("long") else "clip"] += 1
                                print(f"곡 완료 {name} {p.stat().st_size // 1024}KB ({part.inline_data.mime_type})", flush=True)
                                return
                    print(f"곡 소리 없음 {name} (시도 {attempt + 1})", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"곡 실패 {name} {type(e).__name__}: {str(e)[:160]}", flush=True)
            print(f"곡 포기 {name}", flush=True)

    await asyncio.gather(*[image(n, v) for n, v in imgs.items()], *[music(n, v) for n, v in mus.items()])
    usd = spent["img"] * 0.067 + spent["long"] * 0.08 + spent["clip"] * 0.04
    print(f"생성: 이미지 {spent['img']}장 · 2분 곡 {spent['long']} · 30초 곡 {spent['clip']} (약 ${usd:.2f} ≈ ₩{round(usd * 1440)})")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
