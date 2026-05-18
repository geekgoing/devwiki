import type { DocumentDetail, DocumentSummary } from "@/types/devwiki";

const now = new Date().toISOString();

export const demoDocuments: DocumentSummary[] = [
  {
    id: "demo-idempotency",
    slug: "idempotency",
    title: "멱등성",
    summary: "같은 요청을 여러 번 실행해도 결과가 한 번 실행한 것과 같게 유지되는 성질.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    tags: [
      { id: "tag-http", name: "HTTP", slug: "http" },
      { id: "tag-api", name: "API 설계", slug: "api-design" },
    ],
  },
  {
    id: "demo-transaction",
    slug: "transaction",
    title: "트랜잭션",
    summary: "여러 데이터 변경을 하나의 논리적 작업 단위로 묶어 원자성과 일관성을 지키는 방법.",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    tags: [
      { id: "tag-db", name: "Database", slug: "database" },
      { id: "tag-acid", name: "ACID", slug: "acid" },
    ],
  },
];

export const demoDocumentDetails: Record<string, DocumentDetail> = {
  idempotency: {
    ...demoDocuments[0],
    createdBy: null,
    updatedBy: null,
    bodyMarkdown: `# 멱등성

## 한 줄 정의
멱등성은 같은 요청을 여러 번 보내도 서버의 최종 상태가 한 번 처리한 것과 동일하게 유지되는 성질입니다.

## 면접 답변
네트워크 장애나 클라이언트 재시도 때문에 같은 요청이 중복 도착할 수 있습니다. 결제, 주문, 메시지 처리처럼 부작용이 큰 작업에서는 중복 처리를 막기 위해 idempotency key, unique constraint, 상태 전이 검증 등을 사용합니다.

## 시각 자료
\`\`\`mermaid
sequenceDiagram
  participant Client
  participant API
  participant DB
  Client->>API: POST /payments<br/>Idempotency-Key: abc
  API->>DB: abc 처리 이력 조회
  DB-->>API: 없음
  API->>DB: 결제 결과 저장
  API-->>Client: 201 Created
  Client->>API: 같은 요청 재시도
  API->>DB: abc 처리 이력 조회
  DB-->>API: 기존 결과
  API-->>Client: 기존 결과 반환
\`\`\`

## 꼬리 질문
- POST는 항상 멱등하지 않은가?
- 재시도 정책과 멱등성은 어떤 관계인가?
- 메시지 큐 consumer에서 멱등성을 어떻게 보장할 수 있는가?
`,
  },
  transaction: {
    ...demoDocuments[1],
    createdBy: null,
    updatedBy: null,
    bodyMarkdown: `# 트랜잭션

## 한 줄 정의
트랜잭션은 여러 데이터 변경을 하나의 작업 단위로 묶고, 모두 성공하거나 모두 실패하도록 만드는 데이터베이스 기능입니다.

## 핵심 개념
- Atomicity
- Consistency
- Isolation
- Durability

## 면접에서 자주 이어지는 질문
- 격리 수준별로 어떤 이상 현상이 막히는가?
- 인덱스와 락은 트랜잭션 성능에 어떤 영향을 주는가?
`,
  },
};
