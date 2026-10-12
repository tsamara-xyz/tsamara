// Pieces shared by both videos: the palette, the typeface and a fade that every scene uses.
import { loadFont } from "@remotion/google-fonts/Figtree";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
export const FPS = 30;
export const INK = "#0b0b0c";
export const GREEN = "#2fd08a";
export const MUTED = "#9a9a9a";
export const seconds = (s: number) => Math.round(s * FPS);

/** Opacity and a small rise, in over the first half second and out over the last. */
export function useFade(): CSSProperties {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const edge = [0, 15, durationInFrames - 15, durationInFrames];
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return {
    opacity: interpolate(frame, edge, [0, 1, 1, 0], clamp),
    transform: `translateY(${interpolate(frame, [0, 15], [16, 0], clamp)}px)`,
  };
}

export const Stage = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <AbsoluteFill style={{ background: INK, color: "#fff", fontFamily, ...style }}>{children}</AbsoluteFill>
);

export const Brand = ({ size = 44 }: { size?: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, fontSize: size * 0.7, fontWeight: 600 }}>
    <Img src={staticFile("logo.png")} style={{ width: size, height: size, borderRadius: size * 0.24 }} />
    Tsamara
  </div>
);

/** The line that has to be on screen whenever the product is: this is a prototype, not an offer. */
export const Caveat = () => (
  <div style={{ color: MUTED, fontSize: 24 }}>
    Unlicensed devnet prototype with a mock series · not an offer of securities · not certified by any sharia board
  </div>
);
