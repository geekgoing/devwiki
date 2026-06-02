import type {
  DocumentStatusFilter,
  InterviewCategory,
} from "@/types/devwiki";

export const favoriteFilterOptions: Array<{
  label: string;
  value: boolean;
}> = [
  { label: "전체", value: false },
  { label: "즐겨찾기", value: true },
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
