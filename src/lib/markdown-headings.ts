export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
};

function plainText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function headingSlug(value: string) {
  return plainText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractMarkdownHeadings(content: string) {
  const headings: MarkdownHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const level = match[1].length;
    const text = plainText(match[2]);
    const baseId = headingSlug(text);

    if (!text || !baseId) {
      continue;
    }

    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    headings.push({
      id: count ? `${baseId}-${count}` : baseId,
      level,
      text,
    });
  }

  return headings;
}
