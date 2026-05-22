# DevWiki

개발자들이 기술 개념, 면접 질문, 실무 예시, Mermaid 시각 자료를 함께 작성하고 수정하는 개발자 지식 베이스입니다. Next.js와 Supabase를 사용합니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, RLS
- Markdown editor with preview
- Mermaid diagrams
- Supabase Storage image uploads

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase 연결 전에는 데모 문서가 보입니다. 실제 저장을 사용하려면 `supabase/README.md`를 따라 마이그레이션과 멤버 이메일을 설정하세요.

## Image uploads

Logged-in members can upload `png`, `jpeg`, `webp`, and `gif` images from the document editor. Uploaded files are stored in the private `devwiki-assets` Supabase Storage bucket and inserted into the document as Markdown image syntax.

## Member management

Owner members can open `/admin/members` to create a Supabase Auth user and `members` row together, then edit member roles and active status. The first owner account still has to be created in Supabase once before the in-app admin screen can be used.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run verify:mvp
npm run verify:supabase
npm run verify:mvp-data
npm run verify:mvp-ui
```

`verify:mvp` is the final completion gate. It runs lint, build, Supabase
readiness checks, authenticated data checks, and browser UI checks. It requires
`SUPABASE_SERVICE_ROLE_KEY`, `DEVWIKI_E2E_EMAIL`, and
`DEVWIKI_E2E_PASSWORD`; if no app is already running, it starts a local dev
server for the browser check. The preflight also rejects `.env.example`
placeholders, public/service key mixups, invalid URLs, uppercase E2E emails that
would not match `members.email`, and too-short E2E passwords.

`verify:mvp-data` and `verify:mvp-ui` require `SUPABASE_SERVICE_ROLE_KEY` and
`DEVWIKI_E2E_EMAIL`/`DEVWIKI_E2E_PASSWORD`. Run the app first for
`verify:mvp-ui`, and install the Playwright browser once with
`npx playwright install chromium` if Chromium is not available locally.
