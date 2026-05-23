import { ListTree } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractMarkdownHeadings } from "@/lib/markdown-headings";

export function MarkdownToc({ content }: { content: string }) {
  const headings = extractMarkdownHeadings(content).filter(
    (heading) => heading.level > 1,
  );

  if (!headings.length) {
    return null;
  }

  return (
    <Card size="sm" data-testid="markdown-toc">
      <nav aria-label="문서 목차">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree size={16} className="text-muted-foreground" aria-hidden />
            목차
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className={`block rounded-md px-2 py-1 leading-5 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground ${
                    heading.level === 3 ? "ml-3 text-xs" : ""
                  }`}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </nav>
    </Card>
  );
}
