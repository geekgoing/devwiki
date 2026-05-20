"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

export function MermaidBlock({ chart }: { chart: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    let active = true;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        primaryColor: "#f8fafc",
        primaryTextColor: "#0f172a",
        primaryBorderColor: "#cbd5e1",
        lineColor: "#475569",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
    });

    mermaid
      .render(id, chart)
      .then(({ svg: renderedSvg }) => {
        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      })
      .catch((renderError: unknown) => {
        if (active) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Mermaid 다이어그램을 렌더링하지 못했습니다.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div
        className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        data-testid="mermaid-error"
      >
        <p className="font-medium">Mermaid 다이어그램 문법을 확인하세요.</p>
        <p className="mt-1 text-xs leading-5 text-rose-700">
          코드 블록 안의 Mermaid 문법이 유효하지 않아 미리보기를 만들지
          못했습니다.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-rose-700">
            오류 자세히 보기
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-rose-200 bg-white/70 p-2 text-xs leading-5">
            {error}
          </pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
        data-testid="mermaid-loading"
      >
        다이어그램 렌더링 중
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md border border-slate-200 bg-white p-4"
      data-testid="mermaid-block"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
