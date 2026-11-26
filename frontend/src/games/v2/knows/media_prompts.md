# AI KNOWS YOU v3 「숨긴 사진」 — 새 미디어 요청 (생성은 메인만)

승인 범위: 무대 배경 1 · 표지 1 · 2분 신비 루프 1 · 30초 공개 곡 1 (+ 부족하면 물건 사진 최대 5).
모든 사진: 글자 · 로고 · 상표 · 실존 인물 · 사람 얼굴 없음. 어둡지만 무섭지 않은 '무대' 톤(10초 · 단체방 사진과 같은 어두운 필름 느낌).
상태(11-23): 필수 4개는 메인이 생성해 아래 경로에 넣었다(도구 tools/media_gen/gen.py · 목록 tools/media_gen/knows.json). 선택 5장은 비용을 줄이려고 만들지 않았다 — 기존 세트를 쓴다.

## 꼭 필요한 것 (4)

| 경로 | 크기 | 용도 | 생성 전 임시였던 것 |
|---|---|---|---|
| frontend/public/knows/img/stage.webp | 1080x1920 세로 | 빠른 진행 · 공개 화면 뒤에 흐리게 깔리는 무대 배경 | room/img/bg_chat.webp |
| frontend/public/knows/img/cover.webp | 1080x1920 세로 | 첫 화면(표지) · 결과 화면 배경 | future/img/cover.webp |
| frontend/public/knows/music/loop.mp3 | 약 2분, 끊김 없는 반복 | 한 판 내내 도는 배경음악(손 리듬을 고정) | future/music/play.mp3 |
| frontend/public/knows/music/reveal.mp3 | 약 30초 | 봉투가 열리는 공개 순간 | future/music/reveal.mp3 |

### stage.webp
Prompt: `Empty dark theater stage seen from the audience, a single soft circular spotlight pooling on a black wooden floor at center, heavy deep-crimson velvet curtains fading into shadow at both sides, faint haze drifting through the light beam, cinematic film photograph, shallow depth of field, moody low-key lighting, generous empty dark space in the middle third for overlaid photos, no people, no text, no letters, no logos, vertical 9:16`

### cover.webp
Prompt: `Five small printed photographs laid face up in a loose fan on a dark velvet table under a single overhead spotlight, one of the photographs slightly turned and glowing warmer than the others as if secretly chosen, a sealed cream envelope with a dark red wax seal resting beside them, thin haze in the light, cinematic low-key film photograph, rich shadows, mysterious but not scary, the photographs show only blurred abstract color shapes, no people, no faces, no text, no letters, no logos, lower half calm and dark for a title overlay, vertical 9:16`

### loop.mp3 (2분 반복)
Prompt: `Mysterious minimal stage-magic ambient loop, steady soft pulse at 66 BPM like a slow heartbeat on a muted low drum, warm analog synth pad, sparse celesta notes, subtle ticking texture, calm suspense not horror, no vocals, no sudden hits, constant volume, seamless loop, 2 minutes`
메모: 박자가 일정해야 '아니' 누르는 손 리듬이 고정되고 늦어진 순간이 잘 드러난다. 큰 소리 · 갑작스러운 타격음 없이.

### reveal.mp3 (30초)
Prompt: `Short magical reveal cue, a soft rising shimmer of bells and strings building for 4 seconds into a gentle bright chord bloom, then a warm low sustained pad that slowly fades, wonder and a pleasant chill, not scary, no vocals, 30 seconds`

## 선택 (부족하면 · 최대 5장) — 두 번째 물건 세트용 (만들지 않음)

지금 물건 라운드는 기존 사진 다섯 장(열쇠 · 카메라 · 고양이 · 양복 · 휴대폰)으로 충분히 구별된다.
아래 다섯 장은 '다시 하기' 때 다른 물건 세트를 돌리고 싶을 때만. 없으면 같은 세트를 쓴다(코드는 파일이 있을 때만 켠다).
공통 꼬리: `single object centered and filling most of the frame, dark moody film photograph, soft spotlight from above, plain dark background, no people, no hands, no text, no letters, no logos, no brand marks, square 1:1`

| 경로 | 물건 | Prompt 앞부분 |
|---|---|---|
| frontend/public/knows/img/obj_umbrella.webp | 우산 | `A closed long black umbrella with a curved wooden handle leaning upright, raindrops on the fabric,` |
| frontend/public/knows/img/obj_watch.webp | 손목시계 | `A plain analog wristwatch with a brown leather strap and a blank white dial without any numbers or marks, lying on dark wood,` |
| frontend/public/knows/img/obj_mug.webp | 머그잔 | `A plain white ceramic mug with gentle steam rising, on a dark wooden table,` |
| frontend/public/knows/img/obj_glasses.webp | 안경 | `A pair of folded round tortoiseshell eyeglasses on a dark velvet cloth,` |
| frontend/public/knows/img/obj_plant.webp | 화분 | `A small green leafy potted plant in a plain terracotta pot,` |
