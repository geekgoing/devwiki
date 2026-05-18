export const DEVWIKI_ASSETS_BUCKET = "devwiki-assets";

export const ALLOWED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function encodeAssetPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function sanitizeAssetName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension
    .trim()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return normalized || "image";
}

export function sanitizeMarkdownAlt(value: string) {
  return value.replace(/[[\]\n\r]/g, " ").trim() || "uploaded image";
}
