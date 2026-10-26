import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { http } from "../src/sources/http.ts";
import { RecordStore } from "../src/sources/store/RecordStore.ts";
import { MidgardService } from "../src/sources/thorchain/MidgardService.ts";
import { needsRunePrice } from "../src/sources/thorchain/MidgardUtils.ts";

const store = () => new RecordStore(fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-rune-price-")));

describe("RUNE price at a time (docs/specs/rujira.md)", () => {
  test("the 5-minute bucket holding the time, stored once per bucket", async () => {
    const get = mock.method(
      http,
      "get",
      async () =>
        ({
          data: {
            intervals: [
              { startTime: "1778288400", endTime: "1778288700", runePriceUSD: "0.5998751190022197" },
              { startTime: "1778288700", endTime: "1778289000", runePriceUSD: "0.599924675910928" },
            ],
          },
        }) as any,
    );
    const midgard = new MidgardService(store(), "midgard", "https://midgard");

    assert.equal((await midgard.getRunePrice(new Date(1778288467819))).runePriceUSD, "0.5998751190022197");
    assert.equal((await midgard.getRunePrice(new Date(1778288599000))).runePriceUSD, "0.5998751190022197");
    assert.deepEqual(
      get.mock.calls.map((call) => call.arguments[0]),
      ["https://midgard/v2/history/rune?interval=5min&from=1778288400&to=1778288700"],
    );
    get.mock.restore();
  });

  test("a bucket still open when fetched is fetched again; a missing bucket is an error", async () => {
    const now = Math.floor(Date.now() / 1000 / 300) * 300;
    const get = mock.method(
      http,
      "get",
      async (url: string) =>
        ({
          data: {
            intervals: url.includes(`from=${now}&`)
              ? [{ startTime: String(now), endTime: String(now + 300), runePriceUSD: "1.1" }]
              : [],
          },
        }) as any,
    );
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-rune-price-"));
    // each run is a new store over the same folder (a store fetches a record at most once per run)
    const run = () => new MidgardService(new RecordStore(dir), "midgard", "https://midgard");

    assert.equal((await run().getRunePrice(new Date(now * 1000))).final, false);
    await run().getRunePrice(new Date(now * 1000));
    assert.equal(get.mock.calls.length, 2);
    await assert.rejects(run().getRunePrice(new Date((now - 3600) * 1000)), /no RUNE price/);
    get.mock.restore();
  });

  test("only a liquid bond of bRUNE needs it", () => {
    const contract = (contractType: string, funds: string) =>
      ({ type: "contract", metadata: { contract: { contractType, funds } } }) as any;

    assert.equal(needsRunePrice(contract("wasm-rujira-staking/liquid.bond", "2120049376x/brune")), true);
    assert.equal(needsRunePrice(contract("wasm-rujira-staking/liquid.bond", "226901077830x/ruji")), false);
    assert.equal(needsRunePrice(contract("wasm-rujira-fin/trade", "4992500000x/brune")), false);
    assert.equal(needsRunePrice(contract("wasm-rujira-staking/account.bond", "100x/brune")), false);
    assert.equal(needsRunePrice({ type: "send", metadata: {} } as any), false);
  });
});
