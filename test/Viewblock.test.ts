import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { Viewblock } from "../src/sources/viewblock/index.ts";
import { withoutCurrentValues } from "../src/sources/store/Sources.ts";
import { RecordStore } from "../src/sources/store/RecordStore.ts";
import { http } from "../src/sources/http.ts";
import { interpretViewblockSend } from "../src/interpret/viewblock/send.ts";
import { THORCHAIN } from "../src/domain/Protocol.ts";

describe("Viewblock", () => {
  const tx = (hash: string) => ({ hash, timestamp: Date.UTC(2021, 6, 1) });
  const pages = (...docs: object[][]) => {
    const total = docs.flat().length;
    return mock.method(
      http,
      "get",
      async (url: string) =>
        ({
          data: { docs: docs[Number(new URL(url).searchParams.get("page")) - 1] ?? [], pages: docs.length, total },
        }) as any,
    );
  };

  afterEach(() => {
    mock.restoreAll();
  });

  test("reads every page, with viewblock.io as the Origin", async () => {
    const get = pages([tx("A"), tx("B")], [tx("C")]);
    const store = new RecordStore(fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-viewblock-")));

    const txs = await new Viewblock(store).getTxs("thor1-wallet");

    assert.deepEqual(
      txs.map((t) => t.hash),
      ["A", "B", "C"],
    );
    assert.deepEqual(
      get.mock.calls.map((call) => new URL(call.arguments[0] as string).searchParams.get("page")),
      ["1", "2"],
    );
    assert.deepEqual(get.mock.calls[0].arguments[1], { headers: { Origin: "https://viewblock.io" } });
  });

  test("stores an empty result so offline runs can replay it", async () => {
    pages([]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-viewblock-"));

    assert.deepEqual(await new Viewblock(new RecordStore(dir)).getTxs("thor1-empty-wallet"), []);
    assert.deepEqual(await new Viewblock(new RecordStore(dir, { offline: true })).getTxs("thor1-empty-wallet"), []);
  });

  test("refuses a listing shorter than the total it reports", async () => {
    mock.method(http, "get", async () => ({ data: { docs: [tx("A")], pages: 1, total: 2 } }) as any);
    const store = new RecordStore(fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-viewblock-")));

    await assert.rejects(new Viewblock(store).getTxs("thor1-wallet"), /Viewblock listed 1 txs but reports 2/);
  });
});

describe("Viewblock.getInbound", () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "tc-ct-viewblock-"));

  afterEach(() => {
    mock.restoreAll();
  });

  test("keeps only the gas THORNode observed, and replays it offline", async () => {
    const get = mock.method(
      http,
      "get",
      async () =>
        ({
          status: 200,
          data: {
            hash: "H",
            observation: { gas: [{ asset: "BTC.BTC", amount: "5000", decimals: "0" }] },
            input: { usd: "1" },
          },
        }) as any,
    );
    const dir = tmp();

    assert.deepEqual(await new Viewblock(new RecordStore(dir)).getInbound("H"), {
      hash: "H",
      found: true,
      gas: [{ asset: "BTC.BTC", amount: "5000" }],
    });
    assert.equal(new URL(get.mock.calls[0].arguments[0] as string).pathname, "/thorchain/txs/H");
    assert.deepEqual(await new Viewblock(new RecordStore(dir, { offline: true })).getInbound("H"), {
      hash: "H",
      found: true,
      gas: [{ asset: "BTC.BTC", amount: "5000" }],
    });
  });

  test("stores a hash it does not know as not found", async () => {
    mock.method(
      http,
      "get",
      async () => ({ status: 404, data: { message: "Transaction not found.", code: 404 } }) as any,
    );

    assert.deepEqual(await new Viewblock(new RecordStore(tmp())).getInbound("H"), { hash: "H", found: false, gas: [] });
  });
});

describe("withoutCurrentValues", () => {
  test("drops Viewblock's value at today's price and keeps the value at the time of the tx", () => {
    const tx = { input: { amount: "1", usd: "10", usdNew: "12" }, outbounds: [{ usd: "5", usdNew: "6" }] };

    assert.deepEqual(withoutCurrentValues([tx]), [{ input: { amount: "1", usd: "10" }, outbounds: [{ usd: "5" }] }]);
  });
});

describe("interpretViewblockSend", () => {
  const bundle = (code: number, wallet: string) => ({
    source: "viewblock" as const,
    protocol: "thorchain" as const,
    wallet,
    thornodeTxs: [],
    cosmosTxs: [],
    data: {
      hash: "B".repeat(64),
      timestamp: Date.UTC(2021, 6, 1),
      height: 1_000_000,
      code,
      memo: "",
      types: ["send"],
      input: { asset: "THOR.RUNE", amount: "1" },
      msgs: [
        {
          "@type": "/types.MsgSend",
          from_address: "thor1-sender",
          to_address: "thor1-receiver",
          amount: [{ denom: "rune", amount: "100000000" }],
        },
      ],
    } as any,
  });

  test("a failed tx gives nothing: before 2022-04 a failed tx paid no fee", () => {
    assert.deepEqual(interpretViewblockSend(bundle(5, "thor1-sender"), THORCHAIN).activities, []);
    assert.deepEqual(interpretViewblockSend(bundle(5, "thor1-receiver"), THORCHAIN).activities, []);
  });
});
