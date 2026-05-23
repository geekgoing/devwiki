export const siteName = "DevWiki";
export const siteDescription = "개발자가 함께 정리하는 기술 면접 위키";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}
