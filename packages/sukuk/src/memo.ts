import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * The memo texts of one transaction, from the `memo` field RPC nodes return with a signature:
 * `"[12] first memo; [5] other"`. Each text is prefixed with its length, which is what makes the split exact.
 */
export function memoTexts(raw: string | null | undefined): string[] {
  const texts: string[] = [];
  let rest = raw ?? "";
  for (let m = /^\[(\d+)\] /.exec(rest); m; m = /^\[(\d+)\] /.exec(rest)) {
    const body = Buffer.from(rest.slice(m[0].length), "utf8");
    texts.push(body.subarray(0, Number(m[1])).toString("utf8"));
    rest = body.subarray(Number(m[1])).toString("utf8").replace(/^; /, "");
  }
  return texts;
}

/** A note written onchain with a transaction, signed by `signer`. RPC nodes return it with the signature list. */
export const memoIx = (signer: PublicKey, text: string) =>
  new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(text, "utf8"),
  });
