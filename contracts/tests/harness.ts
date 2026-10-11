// In-process Solana (LiteSVM) with the compliance program loaded, plus a sukuk series ready to trade.

import { join } from "node:path";
import { address, getTransactionDecoder, lamports } from "@solana/kit";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createThawAccountInstruction,
  TOKEN_2022_PROGRAM_ID as T22,
  unpackAccount,
} from "@solana/spl-token";
import { type Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  approveInvestorIxs,
  ata,
  COMPLIANCE_PROGRAM_ID,
  DEMO_SERIES,
  type ForcedTransferOrder,
  forcedTransferIxs,
  initializeComplianceIx,
  issueSeriesIxs,
  publishTermsIxs,
  type SeriesTerms,
  transferIx,
} from "@tsamara/sukuk";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";

// Built with `bun run build` in contracts/. Rebuild after changing the program, or these tests check stale code.
const PROGRAM = join(import.meta.dir, "fixtures/tsamara_compliance.so");
const SOL = 1_000_000_000n;

export const terms: SeriesTerms = DEMO_SERIES;

export class World {
  svm = new LiteSVM();
  issuer = this.funded();
  compliance = this.funded();
  mint = Keypair.generate();

  constructor() {
    this.svm.addProgramFromFile(address(COMPLIANCE_PROGRAM_ID.toBase58()), PROGRAM);
  }

  /** The two RPC calls our instruction builders make, answered from the in-process ledger. */
  conn = {
    getMinimumBalanceForRentExemption: async (space: number) =>
      Number(this.svm.minimumBalanceForRentExemption(BigInt(space))),
    getAccountInfo: async (key: PublicKey) => {
      const account = this.svm.getAccount(address(key.toBase58()));
      if (!account?.exists) return null;
      return {
        data: Buffer.from(account.data),
        owner: new PublicKey(account.programAddress),
        lamports: Number(account.lamports),
        executable: account.executable,
      };
    },
  } as unknown as Connection;

  funded(): Keypair {
    const keypair = Keypair.generate();
    this.svm.airdrop(address(keypair.publicKey.toBase58()), lamports(10n * SOL));
    return keypair;
  }

  /** Sends a transaction; the first signer pays. Throws with the program logs when it fails. */
  send(ixs: TransactionInstruction[], signers: Keypair[]): void {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = signers[0]?.publicKey;
    tx.recentBlockhash = this.svm.latestBlockhash();
    tx.sign(...signers);
    const result = this.svm.sendTransaction(getTransactionDecoder().decode(tx.serialize()));
    // Identical transactions in one test would otherwise be rejected as duplicates.
    this.svm.expireBlockhash();
    if (result instanceof FailedTransactionMetadata)
      throw new Error(`${result.toString()}\n${result.meta().logs().join("\n")}`);
  }

  async issue(): Promise<void> {
    const { issuer, compliance, mint } = this;
    this.send(
      await issueSeriesIxs(this.conn, {
        issuer: issuer.publicKey,
        compliance: compliance.publicKey,
        mint: mint.publicKey,
        terms,
      }),
      [issuer, mint],
    );
    this.send(publishTermsIxs(issuer.publicKey, mint.publicKey, terms), [issuer]);
  }

  initCompliance(signer = this.compliance): void {
    this.send(
      [
        initializeComplianceIx({
          payer: this.issuer.publicKey,
          compliance: signer.publicKey,
          mint: this.mint.publicKey,
          terms,
        }),
      ],
      [this.issuer, signer],
    );
  }

  /** A funded wallet with a (frozen) sukuk account. */
  investor(): Keypair {
    const wallet = this.funded();
    const account = ata(this.mint.publicKey, wallet.publicKey);
    this.send(
      [
        createAssociatedTokenAccountIdempotentInstruction(
          this.issuer.publicKey,
          account,
          wallet.publicKey,
          this.mint.publicKey,
          T22,
        ),
      ],
      [this.issuer],
    );
    return wallet;
  }

  approve(wallet: Keypair, jurisdiction: string): void {
    this.send(
      approveInvestorIxs({
        sukukMint: this.mint.publicKey,
        investor: { wallet: wallet.publicKey, jurisdiction },
        payer: this.issuer.publicKey,
        compliance: this.compliance.publicKey,
        terms,
      }),
      [this.issuer, this.compliance],
    );
  }

  /** Opens the token account without registering the investor with the program. */
  thawOnly(wallet: Keypair): void {
    const account = ata(this.mint.publicKey, wallet.publicKey);
    this.send(
      [createThawAccountInstruction(account, this.mint.publicKey, this.compliance.publicKey, [], T22)],
      [this.issuer, this.compliance],
    );
  }

  mintTo(wallet: Keypair, units: bigint): void {
    this.send(
      [
        createMintToInstruction(
          this.mint.publicKey,
          ata(this.mint.publicKey, wallet.publicKey),
          this.issuer.publicKey,
          units,
          [],
          T22,
        ),
      ],
      [this.issuer],
    );
  }

  async transfer(from: Keypair, to: Keypair, units: bigint): Promise<void> {
    this.send([await transferIx(this.conn, this.mint.publicKey, from.publicKey, to.publicKey, units)], [from]);
  }

  async forcedTransfer(
    from: Keypair,
    to: Keypair,
    units: bigint,
    order: ForcedTransferOrder,
    signer = this.compliance,
  ): Promise<void> {
    const ixs = await forcedTransferIxs(this.conn, {
      sukukMint: this.mint.publicKey,
      from: from.publicKey,
      to: to.publicKey,
      units,
      compliance: signer.publicKey,
      order,
    });
    this.send(ixs, [signer]);
  }

  async units(wallet: Keypair): Promise<bigint> {
    const address = ata(this.mint.publicKey, wallet.publicKey);
    const info = await this.conn.getAccountInfo(address);
    return info ? unpackAccount(address, info, T22).amount : 0n;
  }
}

/** A series with compliance rules attached and two approved investors, the first holding `units`. */
export async function seriesWithInvestors(units = 60n) {
  const world = new World();
  await world.issue();
  world.initCompliance();
  const [amira, lukas] = [world.investor(), world.investor()];
  world.approve(amira, "AE");
  world.approve(lukas, "DE");
  world.mintTo(amira, units);
  return { world, amira, lukas };
}
