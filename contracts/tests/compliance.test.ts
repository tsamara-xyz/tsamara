// Integration tests: the compliance program and the TypeScript library, run together in-process.
import { describe, expect, test } from "bun:test";
import { initializeComplianceIx, registerInvestorIx } from "@tsamara/sukuk";
import { seriesWithInvestors, terms, World } from "./harness";

describe("initialize_series", () => {
  test("only the mint's freeze authority can attach rules", async () => {
    const world = new World();
    await world.issue();
    expect(() => world.initCompliance(world.issuer)).toThrow(/NotComplianceAuthority/);
    world.initCompliance();
  });
});

describe("register_investor", () => {
  test("rejects a restricted jurisdiction", async () => {
    const { world } = await seriesWithInvestors();
    const wallet = world.investor();
    const ix = registerInvestorIx({
      payer: world.issuer.publicKey,
      compliance: world.compliance.publicKey,
      mint: world.mint.publicKey,
      investor: { wallet: wallet.publicKey, jurisdiction: "US" },
    });
    expect(() => world.send([ix], [world.issuer, world.compliance])).toThrow(/RestrictedJurisdiction/);
  });

  test("rejects a signer that is not the compliance authority", async () => {
    const { world } = await seriesWithInvestors();
    const wallet = world.investor();
    const ix = registerInvestorIx({
      payer: world.issuer.publicKey,
      compliance: world.issuer.publicKey,
      mint: world.mint.publicKey,
      investor: { wallet: wallet.publicKey, jurisdiction: "AE" },
    });
    expect(() => world.send([ix], [world.issuer])).toThrow(/NotComplianceAuthority/);
  });
});

describe("transfer hook", () => {
  test("lets registered investors trade", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    await world.transfer(amira, lukas, 40n);
    expect(await world.units(amira)).toBe(20n);
    expect(await world.units(lukas)).toBe(40n);
  });

  test("rejects a recipient whose account is still frozen", async () => {
    const { world, amira } = await seriesWithInvestors();
    const stranger = world.investor();
    await expect(world.transfer(amira, stranger, 1n)).rejects.toThrow(/frozen/i);
  });

  test("rejects a recipient that was thawed but never registered", async () => {
    const { world, amira } = await seriesWithInvestors();
    const unregistered = world.investor();
    world.thawOnly(unregistered);
    await expect(world.transfer(amira, unregistered, 1n)).rejects.toThrow(/AccountNotInitialized/);
    expect(await world.units(unregistered)).toBe(0n);
  });

  test("enforces the holding cap at the boundary", async () => {
    const { world, amira, lukas } = await seriesWithInvestors(60n);
    world.mintTo(lukas, terms.maxHolding - 10n);
    await expect(world.transfer(amira, lukas, 11n)).rejects.toThrow(/HoldingCapExceeded/);
    await world.transfer(amira, lukas, 10n);
    expect(await world.units(lukas)).toBe(terms.maxHolding);
  });
});

describe("initialize_series rules are fixed once set", () => {
  test("a second initialization fails", async () => {
    const { world } = await seriesWithInvestors();
    const ix = initializeComplianceIx({
      payer: world.issuer.publicKey,
      compliance: world.compliance.publicKey,
      mint: world.mint.publicKey,
      terms: { ...terms, maxHolding: 1_000_000n, restrictedJurisdictions: [] },
    });
    expect(() => world.send([ix], [world.issuer, world.compliance])).toThrow(/already in use/);
  });
});
