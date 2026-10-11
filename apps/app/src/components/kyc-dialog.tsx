"use client";

import { useEffect, useRef, useState } from "react";
import { api, short } from "@/lib/chain";
import { useStore } from "./store";

declare global {
  interface Window {
    // The Sumsub WebSDK builder, loaded from their CDN on demand.
    snsWebSdk?: { init(token: string, refresh: () => Promise<string>): SumsubBuilder };
  }
}
interface SumsubBuilder {
  withConf(conf: object): SumsubBuilder;
  withOptions(options: object): SumsubBuilder;
  on(event: string, handler: (payload: unknown) => void): SumsubBuilder;
  build(): { launch(selector: string): void };
}

const loadSumsub = () =>
  new Promise<void>((resolve, reject) => {
    if (window.snsWebSdk) return resolve();
    const script = document.createElement("script");
    script.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the verification widget"));
    document.head.append(script);
  });

/** Identity verification in a dialog. The widget is only UX: approval is decided by the API from Sumsub's own record. */
export function KycDialog({ onClose }: { onClose: () => void }) {
  const { wallet, refresh } = useStore();
  const address = wallet?.publicKey.toBase58() ?? "";
  const [phase, setPhase] = useState<"loading" | "widget" | "checking" | "approved" | "failed">("loading");
  const [message, setMessage] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // ponytail: asks the API a few times after the widget reports a submission; a webhook replaces this once the API is public.
    const check = async (attempt: number) => {
      if (cancelled) return;
      const result = await api
        .kycComplete(address)
        .catch((e: Error) => ({ status: "error" as const, reason: e.message }));
      if (cancelled) return;
      if (result.status === "approved") {
        setPhase("approved");
        return refresh();
      }
      if (result.status === "rejected" || result.status === "error") {
        setMessage(result.reason ?? "Verification was not approved");
        return setPhase("failed");
      }
      if (attempt >= 36) {
        setMessage("Still in review. Close this window and check again later.");
        return setPhase("failed");
      }
      timer = setTimeout(() => check(attempt + 1), 5000);
    };

    const token = async () => (await api.kycToken(address)).token;
    (async () => {
      await loadSumsub();
      const first = await token();
      if (cancelled || !window.snsWebSdk) return;
      window.snsWebSdk
        .init(first, token)
        .withConf({ lang: "en", theme: "light" })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on("idCheck.onReady", () => setPhase((p) => (p === "loading" ? "widget" : p)))
        .on("idCheck.onApplicantSubmitted", () => {
          setPhase("checking");
          check(0);
        })
        .on("idCheck.onError", (payload) => {
          setMessage(String((payload as { reason?: string })?.reason ?? "The verification widget reported an error"));
          setPhase("failed");
        })
        .build()
        .launch("#sumsub-websdk-container");
    })().catch((e: Error) => {
      setMessage(e.message);
      setPhase("failed");
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // React mounts effects twice in development; without this two widgets stack.
      container.current?.replaceChildren();
    };
  }, [address, refresh]);

  const checkNow = async () => {
    const result = await api.kycComplete(address).catch(() => null);
    if (result?.status !== "approved") return;
    setPhase("approved");
    await refresh();
  };

  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Verify your identity">
        <header>
          <h2>Verify your identity</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="muted small">
          Verification is run by Sumsub in sandbox mode. Approval is recorded onchain for {short(address)}.
        </p>
        {phase === "approved" && (
          <p className="notice ok">Approved. Your investor record is onchain and your sukuk account is open.</p>
        )}
        {phase === "failed" && <p className="notice error">{message}</p>}
        {phase === "checking" && (
          <p className="notice">
            Submitted. Waiting for the review. In the sandbox, the operator can complete it from the Operator page.{" "}
            <button type="button" className="link" onClick={checkNow}>
              Check now
            </button>
          </p>
        )}
        <div className="kyc-stage" hidden={phase === "approved"}>
          <div id="sumsub-websdk-container" ref={container} />
          {phase === "loading" && <div className="kyc-loader">Loading verification…</div>}
        </div>
      </div>
    </div>
  );
}
