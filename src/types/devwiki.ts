export type DevWikiUser = {
  id: string;
  email: string;
};

export type MemberRole = "owner" | "editor" | "viewer";

export type Member = {
  email: string;
  displayName: string | null;
  role: MemberRole;
  isActive: boolean;
  createdAt: string;
};

export type AdminMember = Member & {
  createdAt: string;
  authUserId: string | null;
  authConfirmedAt: string | null;
  lastSignInAt: string | null;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type DocumentStatus = "draft" | "published" | "archived";
export type DocumentStatusFilter = "active" | DocumentStatus;
export type DocumentContentType = "term" | "interview_qa" | "scenario";
export type InterviewCategory = "technical" | "behavioral";
export type DocumentLearningFilter =
  | "all"
  | "favorite"
  | "completed"
  | "todo";

export type DocumentLearningState = {
  isFavorite: boolean;
  isCompleted: boolean;
};

export type DocumentSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: DocumentStatus;
  contentType: DocumentContentType;
  interviewCategory: InterviewCategory | null;
  isFavorite: boolean;
  isCompleted: boolean;
  updatedAt: string;
  createdAt: string;
  tags: Tag[];
};

export type DocumentDetail = DocumentSummary & {
  bodyMarkdown: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type RelatedDocument = DocumentSummary;

export type DocumentRevision = {
  id: string;
  title: string;
  summary: string | null;
  bodyMarkdown: string;
  editSummary: string | null;
  createdAt: string;
  editedBy: string | null;
};

export type DocumentComment = {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  authorLabel: string;
};
