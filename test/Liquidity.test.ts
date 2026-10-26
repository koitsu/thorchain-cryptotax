import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runBundle } from "../src/pipeline/run.ts";
import { MAYA, THORCHAIN } from "../src/domain/Protocol.ts";
import { toMidgardNanoTimestamp } from "../src/sources/thorchain/MidgardUtils.ts";

// Midgard reports a savers deposit's coin as the synth, whichever chain it was sent on
const saversDeposit = (address: string) =>
  ({
    date: toMidgardNanoTimestamp(new Date("2022-11-14T00:00:00Z")),
    height: "1",
    status: "success",
    type: "addLiquidity",
    pools: ["BTC/BTC"],
    in: [{ address, txID: "tx-deposit", coins: [{ asset: "BTC/BTC", amount: "100000000" }] }],
    out: [],
    metadata: { addLiquidity: { liquidityUnits: "99000000" } },
  }) as any;

const depositRow = (action: any, thornodeTxs: any[] = []) =>
  runBundle(
    { source: "midgard", protocol: "thorchain", wallet: "", data: action, thornodeTxs, cosmosTxs: [] },
    THORCHAIN,
  ).rows.find((row) => row.type === "add-liquidity")!;

describe("liquidity", () => {
  test("a savers deposit sent from an L1 wallet has no fee without THORNode gas, not the RUNE fee", () => {
    const row = depositRow(saversDeposit("bc1q-user-wallet"));

    assert.equal(row.feeCurrency, "");
    assert.equal(row.feeAmount, "");
  });

  test("a savers deposit sent from an L1 wallet uses the gas THORNode observed", () => {
    const thornodeTx = {
      tx: {
        id: "tx-deposit",
        coins: [{ asset: "BTC.BTC", amount: "100000000" }],
        gas: [{ asset: "BTC.BTC", amount: "2500" }],
      },
    } as any;
    const row = depositRow(saversDeposit("bc1q-user-wallet"), [thornodeTx]);

    assert.equal(row.feeCurrency, "BTC");
    assert.equal(row.feeAmount, "0.000025");
  });

  test("a savers deposit sent from an L1 wallet is the amount THORNode observed sent, not the synth minted", () => {
    const thornodeTx = {
      tx: {
        id: "tx-deposit",
        coins: [{ asset: "BTC.BTC", amount: "100200000" }],
        gas: [{ asset: "BTC.BTC", amount: "2500" }],
      },
    } as any;
    const row = depositRow(saversDeposit("bc1q-user-wallet"), [thornodeTx]);

    assert.equal(row.baseCurrency, "BTC");
    assert.equal(row.baseAmount, "1.002");
  });

  test("without a THORNode inbound, a savers deposit from an L1 wallet is the synth minted, with a warning", () => {
    const result = runBundle(
      {
        source: "midgard",
        protocol: "thorchain",
        wallet: "",
        data: saversDeposit("bc1q-user-wallet"),
        thornodeTxs: [],
        cosmosTxs: [],
      },
      THORCHAIN,
    );

    assert.equal(result.rows.find((row) => row.type === "add-liquidity")!.baseAmount, "1");
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.kind === "warning" &&
          issue.message.includes("THORNode has no inbound for the tx") &&
          issue.message.includes("synth minted"),
      ),
    );
  });

  test("a Maya savers deposit from an L1 wallet keeps the synth minted, saying its inbounds are not looked up", () => {
    const deposit = saversDeposit("bc1q-user-wallet");
    const thornodeTx = { tx: { id: "tx-deposit", coins: [{ asset: "BTC.BTC", amount: "100200000" }], gas: [] } } as any;
    const result = runBundle(
      { source: "midgard", protocol: "maya", wallet: "", data: deposit, thornodeTxs: [thornodeTx], cosmosTxs: [] },
      MAYA,
    );
    const row = result.rows.find((row) => row.type === "add-liquidity")!;

    assert.equal(row.baseCurrency, "BTC");
    assert.equal(row.baseAmount, "1");
    assert.ok(result.issues.some((issue) => issue.message.includes("maya inbounds are not looked up on a node")));
  });

  test("a THORNode inbound without the sent asset's coin also falls back to the synth minted, saying so", () => {
    const thornodeTx = { tx: { id: "tx-deposit", coins: [], gas: [{ asset: "BTC.BTC", amount: "2500" }] } } as any;
    const result = runBundle(
      {
        source: "midgard",
        protocol: "thorchain",
        wallet: "",
        data: saversDeposit("bc1q-user-wallet"),
        thornodeTxs: [thornodeTx],
        cosmosTxs: [],
      },
      THORCHAIN,
    );

    assert.equal(result.rows.find((row) => row.type === "add-liquidity")!.baseAmount, "1");
    assert.ok(result.issues.some((issue) => issue.message.includes("THORNode's inbound has no BTC.BTC coin")));
  });

  test("the sent coin is matched whatever the case of a token contract", () => {
    const deposit = saversDeposit("0x-user-wallet");
    deposit.pools = ["ETH/USDC-0XA0B8"];
    deposit.in[0].coins = [{ asset: "ETH/USDC-0XA0B8", amount: "100000000" }];
    const thornodeTx = {
      tx: {
        id: "tx-deposit",
        coins: [{ asset: "ETH.USDC-0xa0b8", amount: "100200000" }],
        gas: [{ asset: "ETH.ETH", amount: "2500" }],
      },
    } as any;

    assert.equal(depositRow(deposit, [thornodeTx]).baseAmount, "1.002");
  });

  test("a savers deposit of a synth from a THORChain wallet pays the native RUNE fee", () => {
    const row = depositRow(saversDeposit("thor1-user-wallet"));

    assert.equal(row.feeCurrency, "RUNE");
    assert.equal(row.feeAmount, "0.02");
  });
});

describe("Maya liquidity auction", () => {
  test("a RUNE side less than the deposits adds no RUNE at the end and asks for it by hand", async () => {
    const path = await import("path");
    const { readCaseInput, toBundle } = await import("../src/fixtures/GoldenCase.ts");
    const { runBundle } = await import("../src/pipeline/run.ts");
    const { MAYA } = await import("../src/domain/Protocol.ts");
    const input = readCaseInput(path.join(import.meta.dirname, "cases", "maya", "liquidity-auction-rune"));
    const bigDeposit = {
      ...input.inbounds![0],
      in: [{ ...input.inbounds![0].in[0], coins: [{ asset: "THOR.RUNE", amount: "200000000000" }] }],
    };

    const { rows, issues } = runBundle(
      toBundle({ ...input, inbounds: [bigDeposit, ...input.inbounds!.slice(1)] }),
      MAYA,
      { mayaLiquidityAuction: "income" },
    );

    assert.deepEqual(
      issues.map((issue) => issue.kind),
      ["manual"],
    );
    assert.deepEqual(
      rows.filter((row) => row.type === "income").map((row) => row.baseCurrency),
      ["CACAO"],
    );
  });

  const auction = async () => {
    const path = await import("path");
    const { readCaseInput, toBundle } = await import("../src/fixtures/GoldenCase.ts");
    const { runBundle } = await import("../src/pipeline/run.ts");
    const { MAYA } = await import("../src/domain/Protocol.ts");
    const bundle = toBundle(readCaseInput(path.join(import.meta.dirname, "cases", "maya", "liquidity-auction-rune")));
    return (mayaLiquidityAuction?: "income" | "pool-units") => runBundle(bundle, MAYA, { mayaLiquidityAuction }).rows;
  };

  test("with 'pool-units', the end gives only the LP token and the price-helper; the deposits and their IDs are as with 'income'", async () => {
    const rows = await auction();
    const income = rows("income");
    const poolUnits = rows("pool-units");

    assert.deepEqual(
      poolUnits.map((row) => row.type),
      ["add-liquidity", "add-liquidity", "spam", "receive-lp-token"],
    );
    assert.equal(
      poolUnits.map((row) => row.id).every((id) => income.some((other) => other.id === id)),
      true,
    );
  });

  test("without the config key, the run stops and says what to set", async () => {
    const rows = await auction();
    assert.throws(() => rows(), /Set mayaLiquidityAuction = "income"/);
  });
});
