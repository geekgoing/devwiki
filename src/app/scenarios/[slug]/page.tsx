import {
  DocumentDetailPage,
  generateDocumentMetadata,
  type DocumentSlugPageProps,
} from "@/components/document-detail-page";

export async function generateMetadata(props: DocumentSlugPageProps) {
  return generateDocumentMetadata({
    ...props,
    expectedContentType: "scenario",
  });
}

export default function ScenarioDocumentPage(props: DocumentSlugPageProps) {
  return <DocumentDetailPage {...props} expectedContentType="scenario" />;
}
