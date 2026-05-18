# Supabase setup

DevWiki는 Supabase Auth, Postgres, Storage를 실제 저장소로 사용합니다.
아래 순서대로 설정해야 로그인, 문서 저장, 변경 이력, 이미지 업로드를 모두
검증할 수 있습니다.

## 1. Environment

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`NEXT_PUBLIC_SITE_URL`은 magic link redirect URL 생성에 사용합니다. 로컬
검증은 `http://localhost:3000`, 배포 검증은 배포 URL로 맞춥니다.

## 2. Migrations

Supabase SQL Editor에서 `supabase/migrations`의 SQL 파일을 파일명 순서대로
실행합니다.

1. `20260518123000_initial_devwiki.sql`
2. `20260518141600_grant_service_role_data_api_access.sql`
3. `20260518221215_capture_every_document_update.sql`

이미 첫 migration을 적용했다면 두 번째와 세 번째 migration만 추가로 실행하면
됩니다. 두 번째 migration은 `verify:*` 스크립트가 사용하는 `service_role`이
Supabase Data API에서 public 테이블에 접근할 수 있도록 명시적으로 grant합니다.
세 번째 migration은 문서 update마다 `document_revisions`에 revision이 남도록
트리거를 보강합니다.

프로젝트 루트의 `.mcp.json`은 Supabase Remote MCP 서버를 가리킵니다.
Codex/Claude 같은 MCP 클라이언트에서 `supabase` 서버를 인증하면, SQL Editor
대신 MCP로 migration 적용 여부를 확인하거나 SQL을 실행할 수 있습니다.

## 3. Study Members

Supabase SQL Editor에서 스터디원 이메일을 등록합니다.

```sql
insert into public.study_members (email, display_name, role)
values
  ('you@example.com', 'You', 'owner'),
  ('member1@example.com', 'Member 1', 'editor'),
  ('member2@example.com', 'Member 2', 'editor'),
  ('member3@example.com', 'Member 3', 'editor'),
  ('member4@example.com', 'Member 4', 'editor')
on conflict (email) do update
set display_name = excluded.display_name,
    role = excluded.role,
    is_active = true;
```

앱은 `study_members`에 `is_active = true`로 등록된 이메일만 문서 읽기,
작성, 수정, 이미지 업로드를 허용합니다. 멤버십 조회는 로그인 이메일과
`study_members.email`을 직접 비교하므로, 스터디원 이메일은 소문자로
등록하세요.

## 4. Auth URLs

Supabase Dashboard에서 이메일 OTP/magic link 로그인을 켜고 redirect URL을
등록합니다.

- Local: `http://localhost:3000/auth/callback`
- Production: `https://your-domain.example/auth/callback`

로컬 검증 중에는 `.env.local`의 `NEXT_PUBLIC_SITE_URL`도
`http://localhost:3000`이어야 합니다.

## 5. Storage

초기 migration은 private bucket `devwiki-assets`를 만들고 `png`, `jpeg`,
`webp`, `gif` MIME 타입만 허용합니다. 이미지 요청은 앱의
`/api/assets/:path*` route가 Supabase signed URL로 변환합니다.

## 6. MVP Verification

1. `npm run dev -- --port 3000`으로 앱을 실행합니다.
2. 등록된 스터디원 이메일로 `/login`에서 magic link를 요청합니다.
3. 이메일 링크를 열어 DevWiki 세션을 생성합니다.
4. `/documents/new`에서 `멱등성 테스트` 문서를 작성합니다.
5. 본문에 Markdown 표, 코드블록, `flowchart`, `sequenceDiagram` Mermaid 블록을 넣습니다.
6. 이미지 하나를 업로드해 Markdown 이미지 문법이 삽입되는지 확인합니다.
7. 저장 후 상세 페이지에서 Markdown, Mermaid, 이미지가 렌더링되는지 확인합니다.
8. 문서를 수정하고 수정 요약을 입력합니다.
9. 변경 이력에 생성/수정 revision이 보이는지 확인합니다.
10. 태그와 검색어로 문서를 다시 찾습니다.
11. 로그아웃 후 `/documents/new`, `/documents/[slug]/edit`, `/api/assets/upload`가 차단되는지 확인합니다.

기본 명령 검증도 함께 통과해야 합니다.

```bash
npm run lint
npm run build
npm run verify:supabase
npm run verify:mvp
```

`npm run verify:supabase`는 publishable key만으로 비로그인 문서 쓰기와 이미지
업로드가 차단되는지 확인합니다. `SUPABASE_SERVICE_ROLE_KEY`를 환경변수로
제공하면 활성 스터디원 row, `devwiki-assets` bucket 설정, 문서 update마다
revision이 생기는 trigger migration까지 추가로 확인합니다.
service role 검증은 임시 `readiness-revision-*` 문서를 생성한 뒤 삭제합니다.

로그인된 스터디원의 실제 데이터 흐름은 아래 명령으로 추가 확인할 수 있습니다.

```bash
DEVWIKI_E2E_EMAIL="you@example.com" npm run verify:mvp-data
```

`verify:mvp-data`는 `SUPABASE_SERVICE_ROLE_KEY`가 있을 때만 실행됩니다. 이
명령은 admin magic link로 테스트 세션을 만들고, 스터디원/비스터디원 권한,
문서 생성/수정, Markdown 원문 보존, tag 갱신, 이미지 업로드, revision 생성을
검증합니다. 테스트 문서, 이미지, tag, 임시 비스터디원 auth user는 실행 후
삭제합니다. 테스트 이메일을 `study_members`에 자동 등록하려면
`DEVWIKI_E2E_MANAGE_MEMBER=1`을 함께 설정합니다.

브라우저에서 최종 MVP 흐름을 검증하려면 dev server를 켠 뒤 아래 명령을 실행합니다.

```bash
npm run dev
DEVWIKI_E2E_EMAIL="you@example.com" npm run verify:mvp-ui
```

`verify:mvp-ui`도 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다. 이 명령은 admin
magic link로 실제 브라우저 세션을 만들고, 작성 화면의 Markdown/Mermaid/image
미리보기, 저장 후 상세 페이지 렌더링, 수정/변경 이력, 태그 검색, 로그아웃 후
차단 흐름을 확인합니다. Chromium 실행에 실패하면
`npx playwright install chromium`을 한 번 실행하세요.

최종 완료 판정은 아래 단일 명령으로 확인합니다.

```bash
DEVWIKI_E2E_EMAIL="you@example.com" npm run verify:mvp
```

`verify:mvp`는 `lint`, `build`, `verify:supabase`, `verify:mvp-data`,
`verify:mvp-ui`를 순서대로 실행합니다. `SUPABASE_SERVICE_ROLE_KEY`나
`DEVWIKI_E2E_EMAIL`이 없으면 실패하며, `DEVWIKI_E2E_BASE_URL`이 없고
`localhost:3000`이 비어 있으면 dev server를 직접 띄운 뒤 브라우저 검증을
수행합니다.

## Notes

New Supabase projects may not expose SQL-created tables to the Data API
automatically. The migrations explicitly grant the `authenticated` role access
for the app and the `service_role` role for verification/admin scripts, then use
RLS policies to decide which rows can be read or written by authenticated users.
