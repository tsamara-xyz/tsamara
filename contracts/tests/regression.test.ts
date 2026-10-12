// Regression and security tests: ways around the rules that must stay closed, and one known gap pinned down.
import { describe, expect, test } from "bun:test";
import { type PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  ata,
  COMPLIANCE_PROGRAM_ID,
  configPda,
  extraAccountMetasPda,
  investorPda,
  revokeInvestorIx,
  transferIx,
} from "@tsamara/sukuk";
import { seriesWithInvestors, terms } from "./harness";

// spl-transfer-hook-interface:execute, the instruction Token-2022 calls on the hook program.
const EXECUTE = [105, 37, 101, 197, 75, 251, 102, 26];

describe("the hook cannot be bypassed", () => {
  test("it refuses to run outside a real transfer", async () => {
    const { world, amira, lukas } = await seriesWithInvestors();
    const mint = world.mint.publicKey;
    const data = Buffer.alloc(16);
    data.set(EXECUTE, 0);
    data.writeBigUInt64LE(1n, 8);
    const readonly = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: false });
    const direct = new TransactionInstruction({
      programId: COMPLIANCE_PROGRAM_ID,
      keys: [
        ata(mint, amira.publicKey),
        mint,
        ata(mint, lukas.publicKey),
        amira.publicKey,
        extraAccountMetasPda(mint),
        configPda(mint),
        investorPda(mint, lukas.publicKey),
      ].map(readonly),
      data,
    });
    expect(() => world.send([direct], [amira])).toThrow(/NotTransferring/);
  });

  test("another investor's record cannot stand in for an unregistered recipient", async () => {
    const { world, amira, lukas } = await seriesWithInvestors();
    const unregistered = world.investor();
    world.thawOnly(unregistered);
    const mint = world.mint.publicKey;
    // A valid transfer to Lukas, re-pointed at the unregistered wallet while keeping Lukas's investor record.
    const ix = await transferIx(world.conn, mint, amira.publicKey, lukas.publicKey, 1n);
    const forged = new TransactionInstruction({
      ...ix,
      keys: ix.keys.map((k) =>
        k.pubkey.equals(ata(mint, lukas.publicKey)) ? { ...k, pubkey: ata(mint, unregistered.publicKey) } : k,
      ),
    });
    expect(() => world.send([forged], [amira])).toThrow();
    expect(await world.units(unregistered)).toBe(0n);
  });
});

describe("revocation", () => {
  test("a revoked investor can neither send nor receive", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    world.send(
      [revokeInvestorIx(world.mint.publicKey, amira.publicKey, world.compliance.publicKey)],
      [world.issuer, world.compliance],
    );
    await expect(world.transfer(amira, lukas, 1n)).rejects.toThrow(/frozen/i);
    world.mintTo(lukas, 5n);
    await expect(world.transfer(lukas, amira, 1n)).rejects.toThrow(/frozen/i);
    expect(await world.units(amira)).toBe(60n);
  });
});

describe("forced transfer", () => {
  const order = { reason: "lost-key", orderedBy: "Compliance committee, case 2026-014" };

  test("the compliance authority can move units without the holder's signature", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    await world.forcedTransfer(amira, lukas, 60n, order);
    expect(await world.units(amira)).toBe(0n);
    expect(await world.units(lukas)).toBe(60n);
  });

  test("units leave a revoked investor's frozen account, which is frozen again afterwards", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    world.send(
      [revokeInvestorIx(world.mint.publicKey, amira.publicKey, world.compliance.publicKey)],
      [world.issuer, world.compliance],
    );
    await world.forcedTransfer(amira, lukas, 60n, { reason: "court-order", orderedBy: "District court, 12/2026" });
    expect(await world.units(amira)).toBe(0n);
    expect(await world.units(lukas)).toBe(60n);
    world.mintTo(lukas, 1n);
    await expect(world.transfer(lukas, amira, 1n)).rejects.toThrow(/frozen/i);
  });

  test("no other key can, including the issuer", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    await expect(world.forcedTransfer(amira, lukas, 1n, order, world.issuer)).rejects.toThrow();
    await expect(world.forcedTransfer(amira, lukas, 1n, order, lukas)).rejects.toThrow();
    expect(await world.units(amira)).toBe(60n);
  });

  test("it is still bound by the transfer hook", async () => {
    const { world, amira } = await seriesWithInvestors(60n);
    const unregistered = world.investor();
    world.thawOnly(unregistered);
    await expect(world.forcedTransfer(amira, unregistered, 1n, order)).rejects.toThrow(/AccountNotInitialized/);
  });

  test("it is refused without a reason and an ordering authority", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    await expect(world.forcedTransfer(amira, lukas, 1n, { reason: " ", orderedBy: "x" })).rejects.toThrow(
      /needs a reason/,
    );
    await expect(world.forcedTransfer(amira, lukas, 1n, { reason: "lost-key", orderedBy: "" })).rejects.toThrow(
      /needs a reason/,
    );
  });
});

describe("known gap, tracked in issue #21", () => {
  test("minting does not run the hook, so a primary subscription can exceed the cap", async () => {
    const { world, lukas } = await seriesWithInvestors();
    // The operator API checks the cap before co-signing. When the program enforces it, this must start to throw.
    world.mintTo(lukas, terms.maxHolding + 1n);
    expect(await world.units(lukas)).toBe(terms.maxHolding + 1n);
  });
});
