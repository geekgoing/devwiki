import { ContentSectionPage } from "@/components/content-section-page";

type InterviewsPageProps = {
  searchParams: Promise<{
    category?: string;
    learning?: string;
    status?: string;
  }>;
};

export default function InterviewsPage({ searchParams }: InterviewsPageProps) {
  return (
    <ContentSectionPage
      contentType="interview_qa"
      routePath="/interviews"
      searchParams={searchParams}
    />
  );
}
