// 「숨긴 사진」 사진 세트 — 기존 밝은 사진 은행만 쓴다(최근 검색어 · 다들 언제 돼? · 내릴게요 사진을 public/knows/img 로 복사 — 2026-11-26 게임 독립: 자산은 자기 폴더에만)(새로 만들지 않음 · 글자 · 상표 · 얼굴 없음 · 정사각으로 잘라 씀)
//   세트마다 7장 — 단계의 사진 수(5 · 6 · 7)만큼 판마다 뽑는다. 한 세트 안의 사진은 빠른 진행(0.5초)에서도 한눈에 갈리는 것만
//   unlock: 이 단계를 처음 깨면 열린다(0 = 처음부터). 물건 · 장소 · 색 으로 시작해 단계마다 하나씩(1~8단계)
//   pos: 정사각 칸에서 물건이 가운데 오게 자르는 위치(가로 사진만) · color: 코드로 그린 색 카드 · shape: 코드로 그린 도형
const S = (id, name, file, pos) => ({ id, name, src: `/knows/img/${file}.webp`, ...(pos ? { pos } : {}) })
const M = (id, name, file, pos) => ({ id, name, src: `/knows/img/${file}.webp`, ...(pos ? { pos } : {}) })
const T = (id, name, file) => ({ id, name, src: `/knows/img/${file}.webp`, pos: '50% 62%' })

export const SET_SIZE = 7

export const SETS = [
  {
    id: 'thing', name: '물건', unlock: 0,
    items: [
      S('glasses', '안경', 's_glasses'), S('piggy', '저금통', 's_piggy'), S('gift', '선물', 's_gift'), S('calc', '계산기', 's_calc'),
      S('candle', '촛불', 's_candles'), S('phone', '휴대폰', 's_brokenphone'), S('cards', '카드', 's_cards'),
    ],
  },
  {
    id: 'place', name: '장소', unlock: 0,
    items: [
      S('airport', '공항', 'q_airport', '42% 50%'), S('stage', '무대', 'q_band', '64% 50%'), S('track', '운동장', 'q_relay', '50% 50%'),
      S('room', '빈 방', 's_movein'), S('street', '밤거리', 'q_wallet', '30% 50%'), S('kitchen', '부엌', 's_kitchen'),
      S('meeting', '회의실', 's_presentation'),
    ],
  },
  {
    id: 'color', name: '색', unlock: 0,
    items: [
      { id: 'red', name: '빨강', color: '#d8343f' }, { id: 'yellow', name: '노랑', color: '#e9b824' }, { id: 'green', name: '초록', color: '#1f9d57' },
      { id: 'blue', name: '파랑', color: '#2f6fe0' }, { id: 'purple', name: '보라', color: '#8b4fd8' }, { id: 'pink', name: '분홍', color: '#f27ab8' },
      { id: 'white', name: '하양', color: '#eeeae2' },
    ],
  },
  {
    id: 'food', name: '음식', unlock: 1,
    items: [
      M('meat', '고기', 'm_menu_meat'), M('noodle', '국수', 'm_menu_noodle'), M('pizza', '피자', 'm_menu_pizza'), M('salad', '샐러드', 'm_menu_salad'),
      M('sushi', '초밥', 'm_menu_sushi'), S('coffee', '커피', 's_cafedate'), S('fruit', '과일', 'q_meetparents', '40% 58%'),
    ],
  },
  {
    id: 'seat', name: '옆자리', unlock: 2,
    items: [
      T('flowers', '꽃다발', 'p_flowers'), T('grocery', '장바구니', 'p_grocery'), T('book', '책', 'p_book'), T('box', '상자', 'p_box'),
      T('umbrella', '우산', 'p_umbrella'), T('laptop', '노트북', 'p_laptop'), T('cup', '컵', 'p_coffee'),
    ],
  },
  {
    id: 'trip', name: '여행', unlock: 3,
    items: [
      S('tent', '텐트', 's_tent'), S('carrier', '캐리어', 's_trip'), S('hat', '밀짚모자', 's_travel'), S('busk', '버스킹', 's_busk'),
      S('bag', '배낭', 's_pocket'), S('welcome', '마중', 's_pickup'), S('market', '장터', 's_secondhand'),
    ],
  },
  {
    id: 'party', name: '기념일', unlock: 4,
    items: [
      S('ring', '반지', 's_wedding'), S('cap', '학사모', 's_graduation'), S('medal', '메달', 's_medal'), S('balloon', '풍선', 's_party'),
      S('mic', '마이크', 'q_speech', '36% 50%'), S('cookie', '쿠키', 's_doorgift'), S('letter', '편지', 'q_retire', '34% 62%'),
    ],
  },
  {
    id: 'desk', name: '책상', unlock: 5,
    items: [
      S('clock', '시계', 's_examnight'), S('marker', '형광펜', 's_study'), S('pc', '컴퓨터', 's_pcbroken'), S('window', '창가', 's_newdesk'),
      S('jacket', '재킷', 's_interview'), S('pen', '펜', 's_idcard'), S('lock', '자물쇠', 's_hacking'),
    ],
  },
  {
    id: 'home', name: '집 안', unlock: 6,
    items: [
      S('doll', '인형', 's_baby'), S('boxes', '이삿짐', 's_boxes'), S('bucket', '양동이', 's_cleaning'), S('closet', '옷장', 's_closet'),
      S('paint', '물감', 's_crafts'), S('guitar', '기타', 's_guitar'), S('note', '쪽지', 's_note'),
    ],
  },
  {
    id: 'nature', name: '자연', unlock: 7,
    items: [
      S('kitten', '고양이', 's_kitten'), S('hamster', '햄스터 집', 'q_hamster', '30% 50%'), S('leaf', '잎', 's_leafbug'), S('pots', '화분', 's_plants'),
      S('daisy', '흰 꽃', 's_whiteflower'), S('hole', '쥐구멍', 's_mousehole'), S('path', '숲길', 's_running'),
    ],
  },
  {
    id: 'shape', name: '도형', unlock: 8,
    items: [
      { id: 'circle', name: '동그라미', shape: 'circle' }, { id: 'triangle', name: '세모', shape: 'triangle' }, { id: 'square', name: '네모', shape: 'square' },
      { id: 'star', name: '별', shape: 'star' }, { id: 'heart', name: '하트', shape: 'heart' }, { id: 'moon', name: '달', shape: 'moon' },
      { id: 'bolt', name: '번개', shape: 'bolt' },
    ],
  },
]

export const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s]))

// 도형 카드 — viewBox 0 0 100 100 의 채운 모양 (화면이 SVG 로 그린다)
export const SHAPES = {
  circle: 'M50 18a32 32 0 1 0 0.01 0z',
  triangle: 'M50 16 86 80H14z',
  square: 'M22 22h56v56H22z',
  star: 'M50 12l10.6 23.4 25.4 2.8-19 17.2 5.4 25L50 67.6 27.6 80.4l5.4-25-19-17.2 25.4-2.8z',
  heart: 'M50 84 20 54C8 42 12 22 30 20c9-1 16 4 20 11 4-7 11-12 20-11 18 2 22 22 10 34z',
  moon: 'M62 14a36 36 0 1 0 22 52A30 30 0 0 1 62 14z',
  bolt: 'M56 10 22 56h24l-6 34 38-50H54z',
}

// 받침 있는 말 뒤에는 '이죠' — "열쇠죠?" · "양복이죠?"
export function hasBatchim(word) {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
}
export const askLine = (name) => `${name}${hasBatchim(name) ? '이죠' : '죠'}?`
