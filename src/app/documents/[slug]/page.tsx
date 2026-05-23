import { notFound, redirect } from "next/navigation";

import {
  generateDocumentMetadata,
  type DocumentSlugPageProps,
} from "@/components/document-detail-page";
import { documentDetailPath } from "@/lib/content-routes";
import { getCurrentMember, getCurrentUser } from "@/lib/auth";
import { getDocumentBySlug } from "@/lib/documents";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export async function generateMetadata(props: DocumentSlugPageProps) {
  return generateDocumentMetadata(props);
}

export default async function LegacyDocumentPage({
  params,
}: DocumentSlugPageProps) {
  const { slug: encodedSlug } = await params;
  const slug = decodeURIComponent(encodedSlug);
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const member = await getCurrentMember();

  if (configured && !user) {
    redirect(loginHref(`/documents/${encodedSlug}`));
  }

  const document = await getDocumentBySlug(slug, {
    canReadPrivate: !configured || Boolean(member),
    viewerId: user?.id,
  });

  if (!document) {
    notFound();
  }

  redirect(documentDetailPath(document));
}
