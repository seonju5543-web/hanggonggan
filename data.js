// 기본 데이터 — 관리자 패널에서 저장하면 localStorage로 덮어씁니다
const DEFAULT_DATA = {
  restaurant: {
    name: "한공간",
    nameEn: "Han Gong-gan",
    tagline: "연남동 퓨전 파스타 바",
    hero: "낯선 재료의 조합, 익숙한 온기",
    about1: "연남동 골목 깊숙이 자리한 한공간은 한국적 식재료와 유럽 파스타·이탈리안 감성이 만나는 퓨전 다이닝 바입니다.",
    about2: "달래된장 크림파스타, 돌김 성게 로제, 양고기 전병 플레이트처럼 낯선 듯 친숙한 메뉴들로 새로운 미식 경험을 선사합니다. 저녁 5시부터 자정까지, 한 잔과 함께 천천히 즐기세요.",
    phone: "010-7223-4247",
    address1: "서울특별시 마포구 연남동 561-4",
    address2: "동교로27길 78",
    quote: "\"한국의 맛, 유럽의 방식으로 재해석하다\"",
    notice: "※ 공휴일 영업시간은 다를 수 있습니다."
  },
  theme: {
    gold: "#c9a96e",
    bg: "#080807",
    surface: "#111110"
  },
  hours: [
    { day: "월요일", time: "17:00 – 00:00", closed: false },
    { day: "화요일", time: "",              closed: true  },
    { day: "수요일", time: "17:00 – 00:00", closed: false },
    { day: "목요일", time: "17:00 – 00:00", closed: false },
    { day: "금요일", time: "17:00 – 00:00", closed: false },
    { day: "토요일", time: "17:00 – 00:00", closed: false },
    { day: "일요일", time: "17:00 – 00:00", closed: false }
  ],
  menu: {
    signature: [
      { name: "유자 유린기",       desc: "상큼한 유자 소스와 촉촉한 닭고기의 완벽한 조화. 한공간의 가장 사랑받는 시그니처 안주", price: "24,000", featured: true },
      { name: "양고기 전병 플레이트", desc: "부드러운 전병에 향긋한 양고기를 감싼 이색 플레이트. 한 입 베어 물면 펼쳐지는 이국적인 맛",  price: "21,000", featured: true },
      { name: "온통초록 부라타",    desc: "신선한 부라타 치즈와 초록 채소의 상큼한 조화",  price: "15,000", featured: false },
      { name: "문어감자 사장님",    desc: "쫄깃한 문어와 포슬포슬 감자의 든든한 안주",     price: "18,000", featured: false }
    ],
    pasta: [
      { name: "달래 된장 크림파스타",       desc: "향긋한 달래와 깊은 된장의 풍미가 어우러진 크림 파스타", price: "19,000" },
      { name: "호박고지 앤쵸비 오일파스타", desc: "말린 호박고지와 앤쵸비의 고소하고 깊은 오일 파스타",  price: "20,000" },
      { name: "음메헤 양고기 파스틴",       desc: "양고기의 깊은 맛을 파스타에 담은 시그니처 메뉴",      price: "21,000" },
      { name: "돌김 성게 로제파스타",       desc: "국산 돌김과 성게알이 만든 바다향 가득한 로제 파스타", price: "22,000" }
    ],
    side: [
      { name: "마라 만두",     desc: "얼얼한 마라 소스와 바삭한 만두의 중독적인 조합", price: "" },
      { name: "감자 디쉬",    desc: "시즈닝 가득한 바삭한 감자 플레이트",             price: "" },
      { name: "허니갈릭 치킨", desc: "달콤한 허니갈릭 소스를 곁들인 바삭한 치킨",     price: "" },
      { name: "볶음우동",     desc: "감칠맛 넘치는 소스의 쫄깃한 볶음우동",           price: "" }
    ]
  }
};

function getSiteData() {
  try {
    const stored = localStorage.getItem('hangonggan_data');
    return stored ? JSON.parse(stored) : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

function saveSiteData(data) {
  localStorage.setItem('hangonggan_data', JSON.stringify(data));
}
