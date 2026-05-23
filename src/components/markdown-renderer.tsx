"use client";

import { Check, Copy, Link2 } from "lucide-react";
import React, { Children, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/mermaid-block";
import { Button } from "@/components/ui/button";

type MarkdownRendererProps = {
  content: string;
};

function extractCode(children: React.ReactNode) {
  const child = Children.toArray(children)[0];

  if (
    React.isValidElement<{
      className?: string;
      children?: React.ReactNode;
    }>(child)
  ) {
    const language = /language-([^\s]+)/.exec(child.props.className ?? "")?.[1];

    return {
      child,
      code: String(child.props.children ?? "").replace(/\n$/, ""),
      language,
    };
  }

  return {
    child: null,
    code: String(children ?? "").replace(/\n$/, ""),
    language: undefined,
  };
}

function CodeBlock({
  children,
  code,
  language,
}: {
  children: React.ReactNode;
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language ?? "code"}</span>
        <Button
          type="button"
          onClick={copyCode}
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-[var(--code-foreground)] hover:bg-[var(--code-border)] hover:text-[var(--code-foreground)]"
        >
          {copied ? (
            <Check size={14} aria-hidden />
          ) : (
            <Copy size={14} aria-hidden />
          )}
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function Heading({
  as,
  children,
  id,
}: {
  as: "h1" | "h2" | "h3";
  children: React.ReactNode;
  id?: string;
}) {
  const Tag = as;

  return (
    <Tag id={id} className="group">
      <span>{children}</span>
      {id ? (
        <a href={`#${id}`} className="heading-anchor" aria-label="헤딩 링크">
          <Link2 size={16} aria-hidden />
        </a>
      ) : null}
    </Tag>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <article className="markdown" data-testid="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1({ children, id }) {
            return (
              <Heading as="h1" id={typeof id === "string" ? id : undefined}>
                {children}
              </Heading>
            );
          },
          h2({ children, id }) {
            return (
              <Heading as="h2" id={typeof id === "string" ? id : undefined}>
                {children}
              </Heading>
            );
          },
          h3({ children, id }) {
            return (
              <Heading as="h3" id={typeof id === "string" ? id : undefined}>
                {children}
              </Heading>
            );
          },
          pre({ children }) {
            const { child, code, language } = extractCode(children);

            if (child && child.props.className?.includes("language-mermaid")) {
              return (
                <MermaidBlock chart={String(child.props.children).trim()} />
              );
            }

            return (
              <CodeBlock code={code} language={language}>
                {children}
              </CodeBlock>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
