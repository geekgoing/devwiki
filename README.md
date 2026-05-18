# DevWiki

개발자가 함께 정리하는 기술 면접 위키입니다. Next.js와 Supabase를 사용해 스터디원 5명이 백엔드 면접 개념, 꼬리 질문, 예시, Mermaid 시각 자료를 같이 작성하고 수정할 수 있게 만듭니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, RLS
- Markdown editor with preview
- Mermaid diagrams

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase 연결 전에는 데모 문서가 보입니다. 실제 저장을 사용하려면 `supabase/README.md`를 따라 마이그레이션과 스터디원 이메일을 설정하세요.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
