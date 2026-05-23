# Supabase setup

DevWiki는 Supabase Auth, Postgres, Storage를 실제 저장소로 사용합니다.
아래 순서대로 설정해야 로그인, 문서 저장, 변경 이력, 이미지 업로드를 모두
검증할 수 있습니다.

## 1. Environment

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DEVWIKI_E2E_EMAIL=you@example.com
DEVWIKI_E2E_PASSWORD=change-this-password
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에는 `sb_publishable_...` 값이나 legacy
anon JWT key를 넣고, `SUPABASE_SERVICE_ROLE_KEY`에는 서버에서만 쓰는
`sb_secret_...` 값이나 legacy service_role JWT key를 넣습니다. `/admin/members`
멤버 관리 화면도 이 서버 전용 key로 Auth user를 생성합니다. service role key는
`NEXT_PUBLIC_*` 변수에 넣으면 안 됩니다.

`DEVWIKI_E2E_EMAIL`은 `members.email`에 `is_active = true`로 등록된
소문자 이메일이어야 하고, 같은 이메일의 Supabase Auth 계정이
`DEVWIKI_E2E_PASSWORD`로 로그인할 수 있어야 합니다. `npm run verify:mvp`는
`.env.example` placeholder, public/service key 혼동, 잘못된 URL, 대문자가
포함된 E2E 이메일, 너무 짧은 E2E 비밀번호를 초기에 차단합니다.

## 2. Migrations

Supabase SQL Editor에서 `supabase/migrations`의 SQL 파일을 파일명 순서대로
실행합니다.

1. `20260518123000_initial_devwiki.sql`
2. `20260518141600_grant_service_role_data_api_access.sql`
3. `20260518150053_rename_members_table.sql`
4. `20260518221215_capture_every_document_update.sql`
5. `20260521011129_document_links.sql`
6. `20260523072046_member_only_content_types_profiles.sql`
7. `20260523081322_document_member_learning_states.sql`

이미 첫 migration을 적용했다면 두 번째 이후 migration만 추가로 실행하면
됩니다. 두 번째 migration은 `verify:*` 스크립트가 사용하는 `service_role`이
Supabase Data API에서 public 테이블에 접근할 수 있도록 명시적으로 grant합니다.
세 번째 migration은 멤버 권한 함수와 service role grant를 보강합니다.
네 번째 migration은 문서 update마다 `document_revisions`에 revision이
남도록 트리거를 보강합니다.
다섯 번째 migration은 문서 간 연관 관계를 추가합니다. 여섯 번째 migration은
문서 콘텐츠 타입, 회원 전용 프로필 수정, editor 이상 쓰기 권한 정책을 추가합니다.
일곱 번째 migration은 멤버별 즐겨찾기와 숙지 완료 상태를 저장하는
`document_member_states` 테이블과 RLS 정책을 추가합니다.

프로젝트 루트의 `.mcp.json`은 Supabase Remote MCP 서버를 가리킵니다.
Codex/Claude 같은 MCP 클라이언트에서 `supabase` 서버를 인증하면, SQL Editor
대신 MCP로 migration 적용 여부를 확인하거나 SQL을 실행할 수 있습니다.

## 3. Members

Supabase SQL Editor에서 문서에 접근할 멤버 이메일을 등록합니다.

```sql
insert into public.members (email, display_name, role)
values
  ('you@example.com', 'You', 'owner'),
  ('member@example.com', 'Member', 'editor')
on conflict (email) do update
set display_name = excluded.display_name,
    role = excluded.role,
    is_active = true;
```

앱은 `members`에 `is_active = true`로 등록된 이메일만 문서를 읽을 수 있게
합니다. `owner`와 `editor`는 문서 작성, 수정, 복원, 이미지 업로드가 가능하고
`viewer`는 읽기와 토론 댓글만 가능합니다. 멤버십 조회는 로그인 이메일과
`members.email`을 직접 비교하므로, 이메일은 소문자로 등록하세요. 첫 owner
계정을 수동 등록한 뒤 로그인하면 `/admin/members`에서 이후 멤버의 Auth user와
`members` row를 함께 생성할 수 있습니다. 앱에서 추가되는 멤버는 자동 닉네임을
받고 `/me`에서 직접 수정합니다.

## 4. Auth Users

Supabase Dashboard의 Authentication > Users에서 멤버 이메일과 같은 Auth user를
만들고 비밀번호를 설정합니다. 초대/가입 UI는 MVP 범위에 포함하지 않고,
DevWiki 앱은 등록된 Auth user가 이메일+비밀번호로 로그인하는 흐름을
제공합니다. 첫 owner 로그인 이후에는 owner가 `/admin/members`에서 새 Auth user와
멤버 권한을 같이 만들 수 있습니다.

최종 검증 스크립트에서 테스트 계정을 자동 생성하거나 비밀번호를 동기화하려면
`DEVWIKI_E2E_MANAGE_MEMBER=1`을 함께 설정합니다. 이 옵션은
`DEVWIKI_E2E_EMAIL`의 Auth user 비밀번호를 `DEVWIKI_E2E_PASSWORD`로 갱신할 수
있으므로 테스트 전용 계정에만 사용하세요.

## 5. Storage

초기 migration은 private bucket `devwiki-assets`를 만들고 `png`, `jpeg`,
`webp`, `gif` MIME 타입만 허용합니다. 이미지 업로드는 owner/editor만 가능하고,
이미지 요청은 active member에게만 `/api/assets/:path*` route가 Supabase signed
URL로 변환합니다.

## 6. MVP Verification

1. `npm run dev -- --port 3000`으로 앱을 실행합니다.
2. 등록된 멤버 이메일과 비밀번호로 `/login`에서 로그인합니다.
3. DevWiki 세션이 생성되어 문서 목록으로 이동하는지 확인합니다.
4. `/documents/new`에서 `멱등성 테스트` 문서를 작성합니다.
5. 본문에 Markdown 표, 코드블록, `flowchart`, `sequenceDiagram` Mermaid 블록을 넣습니다.
6. 이미지 하나를 업로드해 Markdown 이미지 문법이 삽입되는지 확인합니다.
7. 저장 후 상세 페이지에서 Markdown, Mermaid, 이미지가 렌더링되는지 확인합니다.
8. 문서를 수정하고 수정 요약을 입력합니다.
9. 변경 이력에 생성/수정 revision이 보이는지 확인합니다.
10. 태그와 검색어로 문서를 다시 찾습니다.
11. 로그아웃 후 `/`, `/help`, `/documents/[slug]`, `/documents/new`, `/documents/[slug]/edit`, `/api/assets/upload`가 차단되는지 확인합니다.

기본 명령 검증도 함께 통과해야 합니다.

```bash
npm run lint
npm run build
npm run verify:supabase
npm run verify:mvp
```

`npm run verify:supabase`는 publishable key만으로 비로그인 문서 쓰기와 이미지
업로드가 차단되는지 확인합니다. `SUPABASE_SERVICE_ROLE_KEY`를 환경변수로
제공하면 활성 멤버 row, `devwiki-assets` bucket 설정, 문서 update마다
revision이 생기는 trigger migration까지 추가로 확인합니다.
service role 검증은 임시 `readiness-revision-*` 문서를 생성한 뒤 삭제합니다.
`DEVWIKI_E2E_EMAIL`이 설정되어 있으면 해당 이메일이 활성 멤버인지
확인합니다. 테스트 이메일을 자동 등록하려면 `DEVWIKI_E2E_MANAGE_MEMBER=1`을
함께 설정합니다.
`Revision trigger migration is not applied` 실패가 나오면
`20260518221215_capture_every_document_update.sql`이 아직 실제 Supabase
프로젝트에 적용되지 않은 상태입니다.

로그인된 멤버의 실제 데이터 흐름은 아래 명령으로 추가 확인할 수 있습니다.

```bash
DEVWIKI_E2E_EMAIL="you@example.com" DEVWIKI_E2E_PASSWORD="change-this-password" npm run verify:mvp-data
```

`verify:mvp-data`는 `SUPABASE_SERVICE_ROLE_KEY`가 있을 때만 실행됩니다. 이
명령은 이메일+비밀번호로 테스트 세션을 만들고, 멤버/비멤버 권한, 문서
생성/수정, Markdown 원문 보존, tag 갱신, 이미지 업로드, revision 생성을
검증합니다. 멤버별 즐겨찾기/숙지 완료 row도 함께 검증합니다.
테스트 문서, 이미지, tag, 임시 비멤버 auth user는 실행 후
삭제합니다. 테스트 이메일을 `members`와 Supabase Auth에 자동 등록하거나
비밀번호를 동기화하려면 `DEVWIKI_E2E_MANAGE_MEMBER=1`을 함께 설정합니다.

브라우저에서 최종 MVP 흐름을 검증하려면 dev server를 켠 뒤 아래 명령을 실행합니다.

```bash
npm run dev
DEVWIKI_E2E_EMAIL="you@example.com" DEVWIKI_E2E_PASSWORD="change-this-password" npm run verify:mvp-ui
```

`verify:mvp-ui`도 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다. 이 명령은
이메일+비밀번호 브라우저 로그인, 작성 화면의 Markdown/Mermaid/image 미리보기,
저장 후 상세 페이지 렌더링, 수정/변경 이력, 태그 검색, 로그아웃 후 차단 흐름을
확인합니다. Chromium 실행에 실패하면
`npx playwright install chromium`을 한 번 실행하세요.

최종 완료 판정은 아래 단일 명령으로 확인합니다.

```bash
DEVWIKI_E2E_EMAIL="you@example.com" DEVWIKI_E2E_PASSWORD="change-this-password" npm run verify:mvp
```

`verify:mvp`는 `lint`, `build`, `verify:supabase`, `verify:mvp-data`,
`verify:mvp-ui`를 순서대로 실행합니다. `SUPABASE_SERVICE_ROLE_KEY`나
`DEVWIKI_E2E_EMAIL`, `DEVWIKI_E2E_PASSWORD`가 없거나 예시 값을 그대로 둔 경우
실패하며, `DEVWIKI_E2E_BASE_URL`이 없고 `localhost:3000`이 비어 있으면 dev
server를 직접 띄운 뒤 브라우저 검증을 수행합니다.

## Notes

New Supabase projects may not expose SQL-created tables to the Data API
automatically. The migrations explicitly grant the `authenticated` role access
for the app and the `service_role` role for verification/admin scripts, then use
RLS policies to decide which rows can be read or written by authenticated users.
