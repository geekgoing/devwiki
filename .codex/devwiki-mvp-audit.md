# DevWiki MVP Completion Audit

Last audited: 2026-05-19 KST
Code baseline before this audit update: post-password-auth verification run

## Verdict

Complete.

The connected Supabase app passed the final MVP gate with email/password auth.
The run covered lint, production build, Supabase readiness, authenticated data
E2E, and browser UI E2E.

## Current Environment Evidence

Set in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEVWIKI_E2E_EMAIL`
- `DEVWIKI_E2E_PASSWORD`

Optional verification controls:

- optional `DEVWIKI_E2E_MANAGE_MEMBER`
- optional `DEVWIKI_E2E_BASE_URL`

The latest `npm run verify:mvp` run completed successfully.

## Verification Evidence Already Collected

Passing final gate:

```bash
npm run verify:mvp
```

This command includes:

- `npm run lint`
- `npm run build`
- `npm run verify:supabase`
- `npm run verify:mvp-data`
- `npm run verify:mvp-ui`

`npm run verify:supabase` currently reaches the live Supabase checks and
confirms the following:

- local RLS enable statements are present
- local authenticated Data API grants are present
- local service_role Data API grants are present
- local member RLS policies are present
- local private asset storage policy is present
- local anon table grants are absent
- anonymous document insert is blocked against the configured Supabase project
- anonymous asset upload is blocked against the configured Supabase project
- the configured E2E member can be created/found when
  `DEVWIKI_E2E_MANAGE_MEMBER=1` is used
- the `devwiki-assets` bucket config is valid
- the revision trigger migration is applied

Authenticated data E2E has also proven member session creation,
non-member data/storage blocking, member image upload, document create/update,
revision capture, tag refresh, list/search payload, Markdown source
preservation, and signed URL image access.

The data/UI verification scripts now expect `DEVWIKI_E2E_PASSWORD` and create
Supabase sessions through password login instead of generated magic links.

## Requirement Audit

### 1. Login

Implementation evidence:

- `src/app/actions.ts` signs in through Supabase `signInWithPassword`.
- `/auth/callback` has been removed because password login does not need a
  code-exchange route.
- `src/lib/auth.ts` resolves the current Supabase user and active
  `members` membership.
- `requireAuthenticatedMember` blocks non-members before write operations.

Automated evidence:

- `scripts/verify-devwiki-mvp-ui.mjs` covers password login, generated
  member session, non-member browser gate, logout, and post-logout route/API
  blocking.

Current status: complete.

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

Current status: complete.

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

Current status: complete.

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

Current status: complete.

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

Current status: complete.

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

Current status: complete.

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

Current status: complete.

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

Current status: complete.

## Completion Evidence

Final command:

```bash
npm run verify:mvp
```

Result: pass.
