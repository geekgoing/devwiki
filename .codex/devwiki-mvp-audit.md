# DevWiki MVP Completion Audit

Last audited: 2026-05-18 23:35 KST
Code baseline: `3d74bf0`

## Verdict

Not complete yet.

The implementation and local static checks are in place, but the goal requires
the connected Supabase app to pass authenticated data and browser verification.
That final evidence is still missing because `.env.local` does not currently
contain `SUPABASE_SERVICE_ROLE_KEY` or `DEVWIKI_E2E_EMAIL`.

## Current Environment Evidence

Set in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Missing in `.env.local`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DEVWIKI_E2E_EMAIL`
- optional `DEVWIKI_E2E_MANAGE_MEMBER`
- optional `DEVWIKI_E2E_BASE_URL`

`npm run verify:mvp` currently fails at preflight with:

```text
MVP verification env is not ready: Missing SUPABASE_SERVICE_ROLE_KEY; Missing DEVWIKI_E2E_EMAIL
```

## Verification Evidence Already Collected

Passing commands on the current worktree:

```bash
npm run lint
npm run build
npm run verify:supabase
```

`npm run verify:supabase` confirms:

- local RLS enable statements are present
- local authenticated Data API grants are present
- local service_role Data API grants are present
- local member RLS policies are present
- local private asset storage policy is present
- local anon table grants are absent
- anonymous document insert is blocked against the configured Supabase project
- anonymous asset upload is blocked against the configured Supabase project

Service-role checks are intentionally skipped until `SUPABASE_SERVICE_ROLE_KEY`
is configured.

## Requirement Audit

### 1. Login

Implementation evidence:

- `src/app/actions.ts` requests Supabase OTP magic links through
  `signInWithEmail`.
- `src/app/auth/callback/route.ts` exchanges the callback code for a session.
- `src/lib/auth.ts` resolves the current Supabase user and active
  `study_members` membership.
- `requireAuthenticatedMember` blocks non-members before write operations.

Automated evidence:

- `scripts/verify-devwiki-mvp-ui.mjs` covers magic link request, generated
  member session, non-member browser gate, logout, and post-logout route/API
  blocking.

Current status: implemented, not fully proven in the live app until
`verify:mvp-ui` runs with service-role test credentials.

### 2. Document List

Implementation evidence:

- `src/app/page.tsx` renders the document list/search page.
- `src/lib/documents.ts` fetches documents with title, summary, status, tags,
  and updated time.
- `src/components/empty-state.tsx` handles empty states.

Automated evidence:

- `scripts/verify-devwiki-mvp-data.mjs` checks list payload includes searchable
  title, summary, status, updated time, and tags.
- `scripts/verify-devwiki-mvp-ui.mjs` checks list cards, empty search state, and
  that demo mode disappears once Supabase is connected.

Current status: implemented, final proof pending `verify:mvp`.

### 3. Document Create/Edit

Implementation evidence:

- `src/components/document-editor.tsx` exposes title, slug, summary, tags, body,
  status, and edit-summary inputs.
- `src/app/actions.ts` validates and saves create/update payloads.
- `uniqueSlug` auto-generates and de-duplicates slugs.
- `syncTags` updates document/tag relations on create and edit.
- `requireAuthenticatedMember` guards create/update Server Actions.

Automated evidence:

- `scripts/verify-devwiki-mvp-data.mjs` checks member create/update, non-member
  direct insert block, status/title/summary/body/tag persistence, and Markdown
  raw preservation.
- `scripts/verify-devwiki-mvp-ui.mjs` checks create/edit browser flows, auto
  slug generation, and duplicate slug avoidance.

Current status: implemented, final proof pending `verify:mvp`.

### 4. Markdown Preview

Implementation evidence:

- `src/components/document-editor.tsx` supports edit, split, and preview modes.
- `src/components/markdown-renderer.tsx` renders Markdown through
  `react-markdown`, `remark-gfm`, and `rehype-slug`.
- `src/app/globals.css` styles headings, lists, code blocks, tables, links, and
  images.

Automated evidence:

- `scripts/verify-devwiki-mvp-data.mjs` checks persisted Markdown source
  contains lists, tables, code blocks, links, Mermaid source, long text, and
  image Markdown.
- `scripts/verify-devwiki-mvp-ui.mjs` checks rendered headings, lists, table,
  link, code block, long document content, preview switching, and detail-page
  rendering.

Current status: implemented, final proof pending `verify:mvp`.

### 5. Mermaid Rendering

Implementation evidence:

- `src/components/markdown-renderer.tsx` routes `language-mermaid` code blocks
  to `MermaidBlock`.
- `src/components/mermaid-block.tsx` renders Mermaid SVG and shows an inline
  error message when parsing/rendering fails.

Automated evidence:

- `scripts/verify-devwiki-mvp-ui.mjs` checks `flowchart` and
  `sequenceDiagram` render as SVGs in preview/detail flows.
- `scripts/verify-devwiki-mvp-ui.mjs` also injects invalid Mermaid syntax and
  verifies the page still renders with a Mermaid error message.

Current status: implemented, final proof pending `verify:mvp`.

### 6. Revision History

Implementation evidence:

- `supabase/migrations/20260518123000_initial_devwiki.sql` creates
  `document_revisions` and the initial revision trigger.
- `supabase/migrations/20260518221215_capture_every_document_update.sql`
  updates the trigger so every document update creates a revision.
- `src/app/documents/[slug]/page.tsx` renders recent revision history.

Automated evidence:

- `scripts/verify-supabase-readiness.mjs` checks the service-role grant and
  revision trigger when `SUPABASE_SERVICE_ROLE_KEY` is present.
- `scripts/verify-devwiki-mvp-data.mjs` checks create, content update, and
  edit-summary-only revisions with required snapshot fields.
- `scripts/verify-devwiki-mvp-ui.mjs` checks revision history appears on the
  detail page after edit.

Current status: implemented, live trigger proof pending service-role verification.

### 7. Tags/Search

Implementation evidence:

- `src/app/actions.ts` parses comma-separated tags, upserts tags, and refreshes
  document/tag links.
- `src/lib/documents.ts` fetches documents and filters by title, summary, and
  tag names for list search.

Automated evidence:

- `scripts/verify-devwiki-mvp-data.mjs` checks tag creation, tag refresh, and
  searchable list payload.
- `scripts/verify-devwiki-mvp-ui.mjs` checks tag display, tag search, and empty
  search state.

Current status: implemented, final proof pending `verify:mvp`.

### 8. Image Upload

Implementation evidence:

- `src/app/api/assets/upload/route.ts` requires active membership, limits MIME
  types to png/jpeg/webp/gif, stores files in `devwiki-assets`, and returns
  Markdown image syntax.
- `src/app/api/assets/[...path]/route.ts` requires active membership and
  redirects to a short-lived signed URL.
- `src/components/document-editor.tsx` uploads selected images and inserts the
  returned Markdown into the editor.
- `supabase/migrations/20260518123000_initial_devwiki.sql` creates the private
  `devwiki-assets` bucket with MIME and size limits plus member-only storage
  policies.

Automated evidence:

- `scripts/verify-devwiki-mvp-data.mjs` checks member upload, non-member upload
  block, non-member signed URL block, invalid MIME block, and signed URL read.
- `scripts/verify-devwiki-mvp-ui.mjs` checks browser upload, Markdown insertion,
  preview/detail image rendering, invalid MIME rejection, anonymous asset read
  block, and anonymous upload block.

Current status: implemented, final proof pending `verify:mvp`.

## Remaining Completion Steps

1. Apply all files in `supabase/migrations` to the Supabase project in filename
   order:
   - `20260518123000_initial_devwiki.sql`
   - `20260518141600_grant_service_role_data_api_access.sql`
   - `20260518221215_capture_every_document_update.sql`
2. Add a server-only `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.
3. Add `DEVWIKI_E2E_EMAIL` to `.env.local`; it must be a lowercase active
   `study_members.email`.
4. Run:

```bash
npm run verify:mvp
```

Only after that command passes should this Goal be marked complete.
