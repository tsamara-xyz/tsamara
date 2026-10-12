// The pitch video: seven scenes that follow docs/SUBMISSION.md. It has no narration track; every scene
// carries its own sentence, so it can be watched muted or read over.
import type { ReactElement, ReactNode } from "react";
import { AbsoluteFill, Img, Series, staticFile } from "remotion";
import { TEAM } from "./team";
import { Brand, Caveat, GREEN, MUTED, Stage, seconds, useFade } from "./ui";

const Kicker = ({ children }: { children: ReactNode }) => (
  <div style={{ color: GREEN, fontSize: 28, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>
    {children}
  </div>
);

const Headline = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 68, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1.1 }}>{children}</div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 36, lineHeight: 1.4, color: "#d6d6d6" }}>{children}</div>
);

/** Text on the left; a still of the product on the right when there is one. */
function Scene({ kicker, shot, children }: { kicker: string; shot?: string; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ ...useFade(), flexDirection: "row", alignItems: "center", padding: 110, gap: 70 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 34 }}>
        <Kicker>{kicker}</Kicker>
        {children}
      </div>
      {shot && (
        <Img
          src={staticFile(shot)}
          style={{ width: 860, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.6), 0 0 0 1px #2a2a2a" }}
        />
      )}
    </AbsoluteFill>
  );
}

const List = ({ items }: { items: string[] }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {items.map((item) => (
      <div key={item} style={{ display: "flex", gap: 20, fontSize: 34, lineHeight: 1.3, color: "#e6e6e6" }}>
        <span style={{ color: GREEN }}>—</span>
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const SCENES: [durationSeconds: number, scene: ReactElement][] = [
  [
    20,
    <Scene key="problem" kicker="The problem">
      <Headline>The sovereign sukuk market is large, and almost nobody can buy into it directly.</Headline>
      <Body>
        Dollar sukuk are sold to institutions in large minimum lots, US$200,000 in past issues, and trade over the
        counter.
      </Body>
    </Scene>,
  ],
  [
    15,
    <Scene key="team" kicker="Who we are">
      <Headline>{TEAM.headline}</Headline>
      <Body>{TEAM.body}</Body>
    </Scene>,
  ],
  [
    30,
    <Scene key="what" kicker="What Tsamara is" shot="shot-asset.png">
      <Headline>A sukuk series as a token, in $10 units.</Headline>
      <Body>The rules a regulated instrument needs are properties of the token:</Body>
      <List
        items={[
          "Accounts are frozen until identity verification passes",
          "Every transfer checks the recipient's eligibility and holding cap",
          "Payment and delivery settle in one transaction",
        ]}
      />
    </Scene>,
  ],
  [
    30,
    <Scene key="why" kicker="Why it is different">
      <Headline>Permissioned tokens are becoming a standard on Solana. What is missing is the sukuk itself.</Headline>
      <List
        items={[
          "The structure and the share of tangible assets are published onchain",
          "The return is an expected profit rate, not interest",
          "Distribution to people who cannot meet institutional minimums",
          "We know which parts are not software",
        ]}
      />
    </Scene>,
  ],
  [
    20,
    <Scene key="today" kicker="What is real today" shot="shot-portfolio.png">
      <Headline>A working prototype on devnet.</Headline>
      <List
        items={[
          "A compliance program that runs on every transfer",
          "An indexer and an operator API with identity verification",
          "A web app, docs, and tests that run the compiled program",
          "All open source",
        ]}
      />
    </Scene>,
  ],
  [
    25,
    <Scene key="next" kicker="What a real version needs">
      <Headline>Retail access is the goal. It needs a licensed path we do not have yet.</Headline>
      <Body>
        A realistic first issuance is for professional investors in one jurisdiction, through a tokenization sandbox,
        with a licensed custodian and a sharia board. A unit would be a beneficial share in sukuk held on trust.
      </Body>
    </Scene>,
  ],
  [
    10,
    <AbsoluteFill key="close" style={{ justifyContent: "center", alignItems: "center", gap: 40, padding: 140 }}>
      <Brand size={96} />
      <div style={{ fontSize: 52, fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>
        A sukuk series in $10 units, with the rules of who may hold and transfer them enforced by the token itself.
      </div>
      <div style={{ fontSize: 36, color: GREEN }}>tsamara.xyz</div>
    </AbsoluteFill>,
  ],
];

export const PITCH_FRAMES = SCENES.reduce((sum, [s]) => sum + seconds(s), 0);

export function Pitch() {
  return (
    <Stage>
      <Series>
        {SCENES.map(([duration, scene]) => (
          <Series.Sequence key={scene.key} durationInFrames={seconds(duration)}>
            {scene}
          </Series.Sequence>
        ))}
      </Series>
      <AbsoluteFill style={{ justifyContent: "space-between", padding: "44px 110px", pointerEvents: "none" }}>
        <Brand size={40} />
        <div style={{ color: MUTED }}>
          <Caveat />
        </div>
      </AbsoluteFill>
    </Stage>
  );
}
