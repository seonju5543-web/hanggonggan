/* VAPID 열쇠 한 쌍 만들기 — 푸시 서버가 "나는 한대장이 맞다"고 증명하는 데 쓴다.
   외부 라이브러리 없이 Node 기본 기능만 쓴다.

   실행:  node server/push/gen-vapid.mjs

   나오는 것 두 가지
     · 공개키(VAPID_PUBLIC)  — 앱(push-config.js)과 서버 양쪽에 넣는다. 공개돼도 안전.
     · 개인키(VAPID_JWK)     — **서버에만** 넣는다. 저장소·앱에 절대 넣지 말 것.
       (개인키가 새면 남이 우리 사용자에게 알림을 보낼 수 있다. 그때는 다시 만들어 교체하면 된다.)
*/
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const raw = Buffer.concat([Buffer.from([0x04]), b64urlToBuf(pub.x), b64urlToBuf(pub.y)]);
const applicationServerKey = raw.toString('base64url');

// 서버가 서명할 때 쓰는 개인키 JWK (d 포함)
const jwk = { kty: 'EC', crv: 'P-256', x: priv.x, y: priv.y, d: priv.d, ext: true };

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VAPID 열쇠를 만들었습니다. 아래 두 곳에 그대로 붙여넣으세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

① 앱에 넣을 공개키  →  push-config.js 의 publicKey

${applicationServerKey}

② 서버에 넣을 값들 (터미널에 그대로 붙여넣으면 됩니다)

npx wrangler secret put VAPID_PUBLIC
${applicationServerKey}

npx wrangler secret put VAPID_JWK
${JSON.stringify(jwk)}

npx wrangler secret put VAPID_SUBJECT
mailto:seonju5543@gmail.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⚠️ 위 ②의 VAPID_JWK(개인키)는 이 화면에서만 보고 서버에만 넣으세요.
    파일로 저장하거나 저장소(GitHub)에 올리면 안 됩니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
