import {
  DocumentDetailPage,
  generateDocumentMetadata,
  type DocumentSlugPageProps,
} from "@/components/document-detail-page";

export async function generateMetadata(props: DocumentSlugPageProps) {
  return generateDocumentMetadata({
    ...props,
    expectedContentType: "term",
  });
}

export default function TermDocumentPage(props: DocumentSlugPageProps) {
  return <DocumentDetailPage {...props} expectedContentType="term" />;
}
