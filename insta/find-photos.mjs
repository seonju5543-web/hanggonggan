/** 사진 풀 — 교내·교외 전부 **위키미디어 공용**에서 모은다(교내·교외 전부 눈으로 고른 파일 이름).
 *  🔴 Openverse 는 걷어냈다: 준 주소 42장 중 8장만 열렸다(핫링크 차단·404).
 *  🔴 다른 출처로 fetch 하면 CORS 로 막힌다 — page.goto 로 직접 연다.
 *  🔴 주소는 API 가 준 `thumburl` 을 그대로 쓴다. 손으로 조립하면 400 이 온다.
 *  🔴 CC BY-SA 도 쓴다: 동일조건은 그 카드 이미지 하나에만 걸리고 앱·브랜드로 안 번진다.
 *     조건은 **저작자·라이선스 표시**이고, 그것은 표지 카드에 박는다(캡션은 접혀서 안 보인다). */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const JUNK = /Gezicht op|RP-F-|Fotoreproductie|logo|logotype|map|plan|diagram|seal|coat of arms|manuscript|medieval|antique|18[0-9]{2}|19[0-3][0-9]|bible|torah|quran|church|temple/i;
/** 🔴 저작자 이름을 글자 수로 자르지 말 것 — CC BY 에서 틀린 표시는 안 하느니만 못하다.
 *  실측: 26자로 잘라 `Joe Mabel as Flickr user J` 가 남았다. 위키미디어 Artist 칸은
 *  겹친 태그라 태그를 떼면 같은 이름이 두 번 이어 붙기도 한다(`Unknown authorUnknown author`). */
const who = (v) => {
  const t = String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return /^unknown/i.test(t) ? '저작자 미상' : t;
};

const b = await chromium.launch();
const p = await b.newPage();


async function commons(titles) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&titles=`
    + titles.map((t) => encodeURIComponent('File:' + t)).join('|')
    + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1350&format=json&origin=*`;
  await p.goto('https://commons.wikimedia.org/', { waitUntil: 'domcontentloaded' });
  const j = await p.evaluate((x) => fetch(x).then((r) => r.json()), u);
  return Object.values(j?.query?.pages || {}).map((pg) => {
    const ii = (pg.imageinfo || [])[0]; if (!ii?.thumburl) return null;
    return { url: ii.thumburl, lic: ii.extmetadata?.LicenseShortName?.value || '?',
      by: who(ii.extmetadata?.Artist?.value),
      title: pg.title.replace('File:', '').slice(0, 44) };
  }).filter(Boolean);
}

/** 🔴 주소를 받아만 오면 안 된다 — Openverse 가 준 주소의 대부분은 404 이거나
 *  핫링크가 막혀 있다(실측 42장 중 8장만 열림). 실제로 그려지는지 확인하고 남긴다. */
async function alive(list) {
  if (!list.length) return [];
  await p.setContent(`<body>${list.map((x, i) =>
    `<img id="i${i}" src="${x.url}" style="width:40px">`).join('')}</body>`);
  await p.waitForTimeout(6000);
  const ok = await p.evaluate((n) => Array.from({ length: n }, (_, i) => {
    const el = document.getElementById('i' + i);
    return !!(el && el.complete && el.naturalWidth > 200);
  }), list.length);
  return list.filter((_, i) => ok[i]);
}

const pool = {};
pool['경희대'] = await alive(await commons(['Kyung Hee Univ. Administration Building(Seoul Campus).JPG',
  'Kyung Hee Univ. Grand Auditorium.JPG', 'Kyung Hee Univ. College of Law.JPG',
  'Kyung Hee Univ. Central Library and Museum.JPG']));
pool['한국외대'] = await alive(await commons(['Hufs-main.jpg', 'Hufs-lib3.jpg', 'Hufs-lib2.jpg',
  'Administration building, HUFS.jpg', 'Hankuk University of Foreign Studies, Seoul Campus.jpg']));

// 🔴 교외 사진은 **학교가 안 드러나야** 하고 **주제와 이어져야** 한다. 둘은 다른 조건이다.
//    첫 판은 검색으로 '외국 대학 건물' 을 긁어 와서 이바단 도서관·1918년 베이징대·미술
//    작가책이 표지에 깔렸다(개발자 지적: "인도인이 밥 먹는 사진..? 은 너무 연관성이 떨어지는데").
//    🔴 그래서 검색 순위에 맡기지 않고 **눈으로 고른 파일 이름을 박아 둔다** — 교내와 같은 방식.
//       위키미디어 공용에는 한국 대학 공부 장면이 거의 없다(실측: 쓸 만한 것 0장).
//       그래서 학교를 못 알아보는 **열람실·서가**로 간다 — 장학금·등록금과 결이 맞는다.
//    ⚠️ 버린 것: 역사 사진(칼라일 인디언 학교·로워 수용소) · 특정 지역 색이 센 것(일본 지역
//       도서관 안내판·이란) · 미술 작가책. 배경으로 깔았을 때 공고와 무관해 보인다.
pool['교외·열람실'] = await alive(await commons([
  'Study_area_inside_Hillman_Library.jpg',
  'Hillman_Library,_interior.jpg',
  'Study_Area_-_Seattle_Central_Library_-_Flickr_-_brewbooks.jpg',
  'Hunters_Point_Library_td_(2019-09-24)_005_-_Mezzanine.jpg',
  'Hunters_Point_Library_td_(2019-09-24)_011_-_Mezzanine.jpg',
  'Weldon_Library_post_revitalization.jpg',
  'NTU_Main_Library_24-Hour_Study_Room.jpg',
  'DeWitt_Wallace_Library,_interior,_Macalester_College,_St_Paul,_MN.jpg',
  'Trobe_Reading_Room_State_Library_of_Victoria_interior.jpg',
  'Study_room.jpeg',
]));
pool['교외·서가'] = await alive(await commons([
  'Library-shelves-bibliographies-Graz.jpg',
  'Inside_the_Library_of_Birmingham_-_Level_2-_Knowledge_Floor_-_shelves_(9883645136).jpg',
  'Inside_the_Library_of_Birmingham_-_Level_2-_Knowledge_Floor_-_shelves_&_laptops_(9883544185).jpg',
  'Inside_the_Library_of_Birmingham_-_Level_LG_-_shelves_of_books_(9875283466).jpg',
  'International_books_at_Kent_Library.jpg',
  'Downtown_Tulsa_library_interior_shelves_Tulsa_OK_2025-10-23_12-35-16_1.jpg',
  'Hunters_Point_Library_td_(2019-09-24)_014_-_Mezzanine.jpg',
  'Canadian_law_books_on_shelf_(31089552820).jpg',
]));
pool['교외·책'] = await alive(await commons([
  'Stack_of_journals_and_books_in_the_Central_Geological_Survey_Library,_MOEA.jpg',
  'Book_sale_loot_(4552277923).jpg',
  'Books_in_a_stack_(a_stack_of_books)_-_Flickr_-_brewbooks.jpg',
]));
await b.close();
Object.entries(pool).forEach(([k, v]) => console.log(`${v.length ? '✓' : '✗'} ${k} — ${v.length}장`));
writeFileSync(join(ROOT, 'insta/photos.json'), JSON.stringify(pool, null, 1) + '\n');
console.log('총', Object.values(pool).flat().length, '장');
