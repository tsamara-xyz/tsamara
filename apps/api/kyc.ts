// What the KYC provider (Sumsub) says about an investor, reduced to the decision the operator needs.
import type { PublicKey } from "@solana/web3.js";
import countries from "i18n-iso-countries";
import { LEVEL, sumsub } from "./sumsub";

export interface Applicant {
  id: string;
  info?: { country?: string; idDocs?: { country?: string }[] };
  fixedInfo?: { country?: string };
  review?: { reviewStatus?: string; reviewResult?: { reviewAnswer?: string; rejectLabels?: string[] } };
}

export type Verdict =
  | { status: "pending" }
  | { status: "rejected"; reason: string }
  | { status: "approved"; jurisdiction: string | undefined };

// The wallet address is the applicant's stable id at the provider.
export const applicant = (wallet: PublicKey) =>
  sumsub<Applicant>("GET", `/resources/applicants/-;externalUserId=${wallet.toBase58()}/one`);

// ponytail: anyone can start verification for any address; require a wallet signature over a nonce
// before minting the token once this is more than a sandbox.
export async function accessToken(wallet: PublicKey): Promise<string> {
  const path = `/resources/accessTokens?userId=${wallet.toBase58()}&levelName=${encodeURIComponent(LEVEL)}&ttlInSecs=600`;
  return (await sumsub<{ token: string }>("POST", path)).token;
}

/**
 * ISO alpha-2 country for an applicant. Sumsub reports alpha-3. With an identity-document level this is
 * the document's country, not proven residence; add a proof-of-address step before relying on it as residence.
 */
export function jurisdictionOf(a: Applicant): string | undefined {
  const alpha3 = a.info?.country ?? a.info?.idDocs?.[0]?.country ?? a.fixedInfo?.country;
  return alpha3 ? countries.alpha3ToAlpha2(alpha3) : undefined;
}

/** Only a completed review with a GREEN answer approves; everything else is pending or rejected. */
export function verdictOf(a: Applicant): Verdict {
  if (a.review?.reviewStatus !== "completed") return { status: "pending" };
  const result = a.review.reviewResult;
  if (result?.reviewAnswer !== "GREEN")
    return { status: "rejected", reason: result?.rejectLabels?.join(", ") || "not approved" };
  return { status: "approved", jurisdiction: jurisdictionOf(a) };
}

/** Sandbox only: stand in for Sumsub's reviewer so a demo does not wait on a human. */
export async function sandboxReview(applicantId: string, reviewAnswer: "GREEN" | "RED"): Promise<void> {
  await sumsub("POST", `/resources/applicants/${applicantId}/status/testCompleted`, {
    reviewAnswer,
    rejectLabels: reviewAnswer === "RED" ? ["FRAUDULENT_PATTERNS"] : [],
    ...(reviewAnswer === "RED" ? { reviewRejectType: "FINAL" } : {}),
  });
}
