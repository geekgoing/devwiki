# DevWiki

개발자가 함께 정리하는 기술 면접 위키입니다. Next.js와 Supabase를 사용해 스터디원 5명이 백엔드 면접 개념, 꼬리 질문, 예시, Mermaid 시각 자료를 같이 작성하고 수정할 수 있게 만듭니다.

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

Supabase 연결 전에는 데모 문서가 보입니다. 실제 저장을 사용하려면 `supabase/README.md`를 따라 마이그레이션과 스터디원 이메일을 설정하세요.

## Image uploads

Logged-in study members can upload `png`, `jpeg`, `webp`, and `gif` images from the document editor. Uploaded files are stored in the private `devwiki-assets` Supabase Storage bucket and inserted into the document as Markdown image syntax.

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
`SUPABASE_SERVICE_ROLE_KEY` and `DEVWIKI_E2E_EMAIL`; if no app is already
running, it starts a local dev server for the browser check.

`verify:mvp-data` and `verify:mvp-ui` require `SUPABASE_SERVICE_ROLE_KEY` and
`DEVWIKI_E2E_EMAIL`. Run the app first for `verify:mvp-ui`, and install the
Playwright browser once with `npx playwright install chromium` if Chromium is
not available locally.
