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
2. `20260518221215_capture_every_document_update.sql`

이미 첫 migration을 적용했다면 두 번째 migration만 추가로 실행하면 됩니다.
두 번째 migration은 문서 update마다 `document_revisions`에 revision이 남도록
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
작성, 수정, 이미지 업로드를 허용합니다.

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
```

## Notes

New Supabase projects may not expose SQL-created tables to the Data API
automatically. The migrations explicitly grant the `authenticated` role access
and then use RLS policies to decide which rows can be read or written.
