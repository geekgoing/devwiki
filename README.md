# DevWiki

등록된 멤버가 기술 용어, 면접 Q&A, 상황 시뮬레이션을 함께 작성하고 토론하는 회원 전용 개발자 지식 베이스입니다. Next.js와 Supabase를 사용합니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, RLS
- Markdown editor with preview
- Mermaid diagrams
- Supabase Storage image uploads
- Member-only access, role-based editing, profile nicknames
- Per-member favorites and completed-learning filters
- Share metadata, generated app icons, and document link copying

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase 연결 전에는 데모 문서가 보입니다. 실제 저장을 사용하려면 `supabase/README.md`를 따라 마이그레이션과 첫 owner 계정을 설정하세요.

## Content areas

- `기술 용어`: 기술 개념, 실무 예시, 꼬리 질문
- `면접 Q&A`: 기술/인성 질문과 답변 Tip
- `상황 시뮬레이션`: 서술형 상황 질문과 토론

Supabase가 연결된 환경에서는 로그인한 active member만 문서를 읽을 수 있습니다. `공개` 상태는 인터넷 공개가 아니라 전체 멤버 기본 목록에 노출된다는 뜻입니다.
홈은 통합 검색과 개인 학습 현황을 보여주는 메인 화면이고, `/terms`, `/interviews`, `/scenarios`에서 섹션별 문서를 탐색합니다.
각 멤버는 문서를 즐겨찾기하거나 `숙지함`으로 표시할 수 있고, 검색/섹션 화면에서 `즐겨찾기`, `숙지함`, `미숙지` 필터로 학습 상태를 나눠 볼 수 있습니다.

## Image uploads

Owner/editor members can upload `png`, `jpeg`, `webp`, and `gif` images from the document editor. Uploaded files are stored in the private `devwiki-assets` Supabase Storage bucket and inserted into the document as Markdown image syntax.

## Member management

Users can sign up from `/signup`. Signup creates a confirmed Supabase Auth user on the server and an inactive `members` row with an automatically generated nickname, so no signup confirmation email is sent. Owner members can open `/admin/members`, choose a role for pending users, and activate them. Members can update their nickname and password from `/me`. The first owner account still has to be created in Supabase once before the in-app admin screen can be used.

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
일상 개발 중에는 `verify:mvp-ui` 대신 Browser Use로 핵심 화면만 smoke check하고,
릴리즈 전 회귀 확인이 필요할 때만 `verify:mvp-ui`를 실행합니다.
