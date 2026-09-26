-- ============================================================
-- 접수 대행 발송 기록 (2026-09-26 · 기술 고문 보고서 Q5 D+30)
-- ------------------------------------------------------------
-- 왜 필요한가 — 우리가 학생을 대신해 메일을 보내기 시작하면, "보냈다/안 보냈다"가
-- 분쟁거리가 된다. 학생은 냈다고 하고 재단은 못 받았다고 할 때 가릴 것이 있어야 한다.
-- 그리고 Resend 가 알려 주는 **바운스(반송)** 를 어딘가에 적어 두지 않으면,
-- 학생은 실패한 줄도 모르고 마감을 넘긴다.
--
-- 🔴 **증빙이므로 학생이 고칠 수 없어야 한다.** 그래서 정책이 비대칭이다 —
--    읽기는 자기 것만 되고, **넣기·고치기·지우기는 아무도 못 한다.**
--    쓰는 것은 Cloudflare Worker 가 `service_role` 열쇠로만 한다(RLS 를 건너뛴다).
--    ⚠️ `service_role` 열쇠는 **저장소에 절대 넣지 않는다** — 워커 시크릿으로만 둔다.
--
-- 🔴 **학생이 쓴 글을 담지 않는다.** 신청서 답·자기소개서·첨부는 여기 없다.
--    담는 것은 '언제 · 어느 공고 · 어디로 · 어떻게 됐나' 뿐이다.
--    (`terms.html` 2번 표에 같은 내용을 적었다 — 담는 것이 늘면 거기도 같이 고친다.)
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 실행.
-- ============================================================
create table if not exists public.apply_sends (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,

  notice_id   text not null,               -- 어느 공고인가 (data/registered.json 의 id)
  to_email    text not null,               -- 어디로 보냈나 (🔴 공고에서 읽은 주소 — 학생이 준 값이 아니다)
  subject     text,                        -- 제목만. 본문은 담지 않는다.

  provider_id text,                        -- Resend 가 준 메시지 id — 바운스를 이 값으로 잇는다
  status      text not null default 'queued',
  -- queued(보냈다고 접수됨) → delivered(도착) | bounced(반송) | complained(스팸 신고) | failed(발송 실패)
  detail      text,                        -- 실패·반송 사유 (Resend 가 준 문구 그대로)

  sent_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint apply_sends_status_ck
    check (status in ('queued', 'delivered', 'bounced', 'complained', 'failed'))
);

-- 바운스가 오면 provider_id 로 그 줄을 찾는다
create index if not exists apply_sends_provider on public.apply_sends (provider_id);
-- 학생이 '내 발송 기록'을 볼 때
create index if not exists apply_sends_user_at on public.apply_sends (user_id, sent_at desc);

-- ============================================================
-- 🔴 정책 — 읽기만, 그것도 자기 것만
-- ------------------------------------------------------------
-- insert·update·delete 정책을 **일부러 만들지 않는다.** RLS 가 켜져 있고 정책이 없으면
-- 그 동작은 막힌다 — 즉 anon 열쇠로는 기록을 넣거나 고치거나 지울 수 없다.
-- 이것이 '학생이 증빙을 조작할 수 없다'의 전부다. 정책을 더하지 말 것.
-- ============================================================
alter table public.apply_sends enable row level security;

drop policy if exists "자기 발송 기록만 읽는다" on public.apply_sends;
create policy "자기 발송 기록만 읽는다"
  on public.apply_sends
  for select
  using (auth.uid() = user_id);
