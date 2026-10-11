import { afterEach, expect, mock, test } from "bun:test";
import { api, explain, short, usd } from "./chain";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return calls;
}

// Regression: a content-type header on GET made the browser send a CORS preflight the indexer rejects,
// so holders and activity silently stayed empty.
test("GET requests are simple requests with no content-type header", async () => {
  const calls = captureFetch([]);
  await api.holders();
  expect(calls[0]?.init.method).toBe("GET");
  expect(calls[0]?.init.headers).toEqual({});
});

test("POST requests send JSON, and admin calls carry the token", async () => {
  const calls = captureFetch({ signature: "s" });
  await api.kyc("secret", "wallet", "AE");
  expect(calls[0]?.init.headers).toEqual({ "content-type": "application/json", "x-admin-token": "secret" });
  expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ wallet: "wallet", jurisdiction: "AE" });
});

test("an error response surfaces the API's message", async () => {
  captureFetch({ error: "Holding cap is 100 units" }, 422);
  expect(api.subscribe("wallet", 500)).rejects.toThrow("Holding cap is 100 units");
});

test("program errors are explained in plain language", () => {
  expect(explain(new Error("custom program error: 0x1773"))).toMatch(/holding cap/);
  expect(explain(new Error("custom program error: 0x1772"))).toMatch(/jurisdiction/);
  expect(explain({ logs: ["Program log: Error: Account is frozen"] })).toMatch(/KYC/);
  expect(explain(new Error("AnchorError caused by account: investor. Error Code: AccountNotInitialized"))).toMatch(
    /not a registered investor/,
  );
  expect(explain(new Error("something else"))).toBe("something else");
});

// Regression: these reached the notice bar as an empty red box.
test("errors without a message still say something", () => {
  const missing = Object.assign(new Error(""), { name: "TokenAccountNotFoundError" });
  expect(explain(missing)).toMatch(/no sukuk account/);
  const hookData = Object.assign(new Error(""), { name: "TokenTransferHookAccountDataNotFound" });
  expect(explain(hookData)).toMatch(/no sukuk account/);
  const offCurve = Object.assign(new Error(""), { name: "TokenOwnerOffCurveError" });
  expect(explain(offCurve)).toMatch(/belongs to a program/);
  expect(explain(new Error(""))).toMatch(/without an error message/);
  expect(explain(new Error("Non-base58 character"))).toMatch(/not a valid wallet address/);
});

test("formatting helpers", () => {
  expect(usd("15600000")).toBe("$15.60");
  expect(usd(1_250_000_000n)).toBe("$1,250.00");
  expect(short("97CmXgdYhasqbbwm4svLDas3u3TMrYPAnKQKD8TtyiXK")).toBe("97Cm…yiXK");
});
