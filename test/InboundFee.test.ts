import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getInboundFee } from "../src/export/summ/ThorchainUtils.ts";
import { MAYA } from "../src/domain/Protocol.ts";
import type { EvmReceipt } from "../src/sources/evm/EvmReceipts.ts";

const thornode = (id: string, asset: string, amount: string) => ({ tx: { id, gas: [{ asset, amount }] } }) as any;
const none = { thornodeTxs: [] };
const receipt = (chain: string, hash: string, gasUsed: number, price: number, l1Fee?: number): EvmReceipt => ({
  chain,
  transactionHash: hash,
  blockNumber: "0x1",
  status: "0x1",
  gasUsed: `0x${gasUsed.toString(16)}`,
  effectiveGasPrice: `0x${price.toString(16)}`,
  ...(l1Fee !== undefined ? { l1Fee: `0x${l1Fee.toString(16)}` } : {}),
});

describe("getInboundFee (docs/specs/fees.md)", () => {
  test("prefers THORNode gas over any default", () => {
    assert.deepEqual(getInboundFee("tx1", { thornodeTxs: [thornode("tx1", "BTC.BTC", "5000")] }, "BTC.BTC"), {
      feeCurrency: "BTC",
      feeAmount: "0.00005",
    });
    assert.deepEqual(getInboundFee("tx1", { thornodeTxs: [thornode("tx1", "THOR.RUNE", "2000000")] }, "THOR.RUNE"), {
      feeCurrency: "RUNE",
      feeAmount: "0.02",
    });
  });

  test("uses Viewblock's observed gas when THORNode has none", () => {
    const sources = {
      thornodeTxs: [{ tx: undefined } as any],
      viewblockInbounds: [{ hash: "tx1", found: true, gas: [{ asset: "DOGE.DOGE", amount: "12345678" }] }],
    };
    assert.deepEqual(getInboundFee("tx1", sources, "DOGE.DOGE"), { feeCurrency: "DOGE", feeAmount: "0.12345678" });
  });

  test("THORNode's gas wins over Viewblock's", () => {
    const sources = {
      thornodeTxs: [thornode("tx1", "BTC.BTC", "5000")],
      viewblockInbounds: [{ hash: "tx1", found: true, gas: [{ asset: "BTC.BTC", amount: "9999" }] }],
    };
    assert.deepEqual(getInboundFee("tx1", sources, "BTC.BTC"), { feeCurrency: "BTC", feeAmount: "0.00005" });
  });

  test("a hash Viewblock does not know leaves an L1 fee blank", () => {
    assert.deepEqual(
      getInboundFee("tx1", { thornodeTxs: [], viewblockInbounds: [{ hash: "tx1", found: false, gas: [] }] }, "BTC.BTC"),
      { feeCurrency: "", feeAmount: "" },
    );
  });

  test("an EVM inbound takes its receipt's fee, not THORNode's max fee", () => {
    const sources = {
      thornodeTxs: [thornode("ABCD", "ETH.ETH", "300")],
      evmReceipts: [receipt("ETH", "0xabcd", 21000, 50_000_000_000)],
    };
    // 21000 gas × 50 gwei
    assert.deepEqual(getInboundFee("ABCD", sources, "ETH.ETH"), { feeCurrency: "ETH", feeAmount: "0.00105" });
  });

  test("a BASE receipt's fee adds the L1 data fee", () => {
    const sources = { thornodeTxs: [], evmReceipts: [receipt("BASE", "0xbeef", 100_000, 1_000_000, 50_000_000)] };
    assert.deepEqual(getInboundFee("BEEF", sources, "BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913"), {
      feeCurrency: "ETH",
      feeAmount: "0.00000010005",
    });
  });

  test("any THORChain asset without THORNode data pays 0.02 RUNE", () => {
    for (const asset of ["THOR.RUNE", "THOR.TCY", "THOR.KUJI", "BTC/BTC", "BTC~BTC"]) {
      assert.deepEqual(getInboundFee("tx", none, asset), { feeCurrency: "RUNE", feeAmount: "0.02" });
    }
  });

  test("L1 assets and tokens without THORNode, Viewblock or receipt data have no fee", () => {
    for (const asset of ["BTC.BTC", "ETH.ETH", "ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48"]) {
      assert.deepEqual(getInboundFee("tx", none, asset), { feeCurrency: "", feeAmount: "" });
    }
  });

  test("Maya: CACAO pays 0.2 CACAO, RUNE still pays 0.02 RUNE, synths get no RUNE fallback", () => {
    assert.deepEqual(getInboundFee("tx", none, "MAYA.CACAO", MAYA), { feeCurrency: "CACAO", feeAmount: "0.2" });
    assert.deepEqual(getInboundFee("tx", none, "THOR.RUNE", MAYA), { feeCurrency: "RUNE", feeAmount: "0.02" });
    assert.deepEqual(getInboundFee("tx", none, "BTC/BTC", MAYA), { feeCurrency: "", feeAmount: "" });
  });
});
