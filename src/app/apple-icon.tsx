import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f172a",
          borderRadius: 40,
          color: "white",
          display: "flex",
          fontSize: 88,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        D
      </div>
    ),
    size,
  );
}
