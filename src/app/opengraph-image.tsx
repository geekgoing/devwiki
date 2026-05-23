import { ImageResponse } from "next/og";

import { siteDescription, siteName } from "@/lib/site";

export const alt = "DevWiki";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 24,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#2563eb",
              borderRadius: 18,
              color: "white",
              display: "flex",
              fontSize: 44,
              fontWeight: 800,
              height: 86,
              justifyContent: "center",
              width: 86,
            }}
          >
            D
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 48, fontWeight: 800 }}>{siteName}</div>
            <div style={{ color: "#475569", fontSize: 26 }}>
              Member-only interview knowledge base
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 800 }}>
            기술 면접 지식을 팀으로 정리합니다
          </div>
          <div style={{ color: "#475569", fontSize: 34, lineHeight: 1.35 }}>
            {siteDescription}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
