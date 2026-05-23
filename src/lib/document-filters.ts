import type {
  DocumentLearningFilter,
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

export const learningFilterOptions: Array<{
  label: string;
  value: DocumentLearningFilter;
}> = [
  { label: "전체", value: "all" },
  { label: "즐겨찾기", value: "favorite" },
  { label: "숙지함", value: "completed" },
  { label: "미숙지", value: "todo" },
];

export const statusFilterOptions: Array<{
  label: string;
  value: DocumentStatusFilter;
}> = [
  { label: "공개+초안", value: "active" },
  { label: "공개", value: "published" },
  { label: "초안", value: "draft" },
  { label: "보관", value: "archived" },
];

export const interviewCategoryFilterOptions: Array<{
  label: string;
  value?: InterviewCategory;
}> = [
  { label: "전체" },
  { label: "기술", value: "technical" },
  { label: "인성", value: "behavioral" },
];
