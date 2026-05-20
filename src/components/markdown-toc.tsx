import { ListTree } from "lucide-react";

import { extractMarkdownHeadings } from "@/lib/markdown-headings";

export function MarkdownToc({ content }: { content: string }) {
  const headings = extractMarkdownHeadings(content).filter(
    (heading) => heading.level > 1,
  );

  if (!headings.length) {
    return null;
  }

  return (
    <nav
      aria-label="문서 목차"
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
      data-testid="markdown-toc"
    >
      <div className="flex items-center gap-2">
        <ListTree size={16} className="text-slate-500" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-950">목차</h2>
      </div>
      <ol className="mt-3 space-y-1 text-sm">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`block rounded px-2 py-1 leading-5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 ${
                heading.level === 3 ? "ml-3 text-xs" : ""
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
