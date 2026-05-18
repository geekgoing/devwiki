export function slugify(value: string, maxLength = 80) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

export function toTagSlug(value: string) {
  return slugify(value, 60);
}
