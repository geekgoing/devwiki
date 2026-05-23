import {
  DocumentDetailPage,
  generateDocumentMetadata,
  type DocumentSlugPageProps,
} from "@/components/document-detail-page";

export async function generateMetadata(props: DocumentSlugPageProps) {
  return generateDocumentMetadata({
    ...props,
    expectedContentType: "interview_qa",
  });
}

export default function InterviewDocumentPage(props: DocumentSlugPageProps) {
  return <DocumentDetailPage {...props} expectedContentType="interview_qa" />;
}
