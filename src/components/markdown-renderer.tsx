"use client";

import React, { Children } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/mermaid-block";

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <article className="markdown" data-testid="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          pre({ children }) {
            const child = Children.toArray(children)[0];

            if (
              React.isValidElement<{
                className?: string;
                children?: React.ReactNode;
              }>(child) &&
              child.props.className?.includes("language-mermaid")
            ) {
              return (
                <MermaidBlock chart={String(child.props.children).trim()} />
              );
            }

            return <pre>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
