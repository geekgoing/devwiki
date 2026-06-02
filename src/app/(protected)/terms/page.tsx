import { ContentSectionPage } from "@/components/content-section-page";

type TermsPageProps = {
  searchParams: Promise<{
    favorites?: string;
    status?: string;
  }>;
};

export default function TermsPage({ searchParams }: TermsPageProps) {
  return (
    <ContentSectionPage
      contentType="term"
      routePath="/terms"
      searchParams={searchParams}
    />
  );
}
