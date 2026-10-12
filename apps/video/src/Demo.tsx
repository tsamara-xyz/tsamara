// The demo video: one continuous take of the app, with a caption for each chapter.
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import markers from "../public/markers.json";
import { Brand, Caveat, FPS, GREEN, MUTED, Stage, seconds, useFade } from "./ui";

const CAPTIONS: Record<string, [title: string, text: string]> = {
  explore: [
    "Explore",
    "One series is open on devnet. Two are marked Preview: illustrations, not issued. The figures come from the indexer.",
  ],
  asset: [
    "The series",
    "Structure, maturity, expected profit rate, tangible-asset share and restricted jurisdictions are published in the token's own metadata.",
  ],
  fund: ["Connect and fund", "A test wallet, and $1,000 of test dollars that have no value."],
  approve: [
    "Approval",
    "The sukuk account stays frozen until the compliance authority registers the investor. Here the operator approves by hand; the public deployment verifies identity in Sumsub's sandbox.",
  ],
  subscribe: [
    "Subscribe",
    "10 units for $100. Payment and delivery are two instructions in one transaction, signed by the investor and the issuer.",
  ],
  portfolio: ["Portfolio", "Holdings, allocation and history, built from indexed transactions."],
  refusal: [
    "A refused transfer",
    "Units sent to a wallet that never onboarded are rejected onchain, and the app says why. A restricted country or an over-cap transfer is refused by the program as well.",
  ],
  distribution: [
    "Distribution",
    "The operator pays a period pro rata from the treasury. Each batch is marked onchain, so a period cannot be paid twice.",
  ],
};

const end = markers.at(-1)?.at ?? 0;
const chapters = markers.slice(0, -1).map((m, i) => ({ ...m, until: markers[i + 1]?.at ?? end }));
const INTRO = seconds(5);
const FOOTAGE = seconds(end + 1);
const OUTRO = seconds(7);
export const DEMO_FRAMES = INTRO + FOOTAGE + OUTRO;

function Caption({ index, id }: { index: number; id: string }) {
  const [title, text] = CAPTIONS[id] ?? [id, ""];
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 34px" }}>
      <div style={{ ...useFade(), display: "flex", alignItems: "baseline", gap: 28 }}>
        <div style={{ color: GREEN, fontSize: 26, fontWeight: 600, whiteSpace: "nowrap" }}>
          {index + 1}/{chapters.length} · {title}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.35 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
}

function Card({ title, lines }: { title: string; lines: string[] }) {
  return (
    <AbsoluteFill style={{ ...useFade(), justifyContent: "center", padding: 140, gap: 36 }}>
      <Brand size={72} />
      <div style={{ fontSize: 84, fontWeight: 500, letterSpacing: -2, lineHeight: 1.05 }}>{title}</div>
      {lines.map((line) => (
        <div key={line} style={{ fontSize: 36, color: "#d6d6d6" }}>
          {line}
        </div>
      ))}
      <Caveat />
    </AbsoluteFill>
  );
}

function Progress() {
  const frame = useCurrentFrame();
  return <div style={{ height: 4, width: `${(frame / FOOTAGE) * 100}%`, background: GREEN }} />;
}

export function Demo() {
  return (
    <Stage>
      <Sequence durationInFrames={INTRO}>
        <Card title="Sukuk in $10 units, on Solana" lines={["A walk through the working prototype, in one take."]} />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={FOOTAGE}>
        {/* The take is 1600 by 900; it sits above a caption band rather than under it. */}
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 24 }}>
          <OffthreadVideo
            src={staticFile("demo.mp4")}
            style={{ width: 1568, height: 882, borderRadius: 14, boxShadow: "0 0 0 1px #2a2a2a" }}
          />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: "flex-end" }}>
          <Progress />
        </AbsoluteFill>
        {chapters.map((c, i) => (
          <Sequence key={c.id} from={Math.round(c.at * FPS)} durationInFrames={Math.round((c.until - c.at) * FPS)}>
            <Caption index={i} id={c.id} />
          </Sequence>
        ))}
      </Sequence>
      <Sequence from={INTRO + FOOTAGE} durationInFrames={OUTRO}>
        <Card
          title="Try it yourself"
          lines={["app.tsamara.xyz · docs.tsamara.xyz", "github.com/tsamara-xyz/tsamara"]}
        />
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: 60, color: MUTED, fontSize: 22 }}>
          Every rule shown is covered by tests that run the compiled program.
        </AbsoluteFill>
      </Sequence>
    </Stage>
  );
}
