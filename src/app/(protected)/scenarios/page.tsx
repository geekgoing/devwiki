import { ContentSectionPage } from "@/components/content-section-page";

type ScenariosPageProps = {
  searchParams: Promise<{
    learning?: string;
    status?: string;
  }>;
};

export default function ScenariosPage({ searchParams }: ScenariosPageProps) {
  return (
    <ContentSectionPage
      contentType="scenario"
      routePath="/scenarios"
      searchParams={searchParams}
    />
  );
}
