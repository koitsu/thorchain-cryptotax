import { assetFromStringEx, AssetType } from "@xchainjs/xchain-util";
import type { Leg } from "../../domain/Activity.ts";
import { parseAmount } from "../../domain/Amount.ts";
import { toAsset } from "../../domain/Asset.ts";
import { type Protocol, THORCHAIN } from "../../domain/Protocol.ts";
import type { RawBundle } from "../../sources/RawBundle.ts";
import { EVM_GAS_ASSETS, receiptFee } from "../../sources/evm/EvmReceipts.ts";

// The txs a bundle holds for its inbounds' gas
export type GasSources = Pick<RawBundle, "thornodeTxs" | "viewblockInbounds" | "evmReceipts">;

const EVM_DECIMALS = 18;

// The gas the wallet paid to send its inbound transaction (docs/specs/fees.md):
// 1. an EVM tx's receipt: gas used at the price charged, plus BASE's L1 data fee (observed);
// 2. THORNode's gas for the tx (observed; on an EVM chain the max fee, so only when there is no receipt);
// 3. Viewblock's copy of THORNode's observation, for a tx THORNode has pruned (observed);
// 4. otherwise the native fee of a tx sent on THORChain (RUNE, a THORChain token, or a synth, trade or
//    secured asset), or of CACAO sent on Maya (default);
// 5. otherwise none.
export function inboundGas(
  txId: string,
  sources: GasSources,
  wallet: string,
  inputAsset: string | undefined,
  protocol: Protocol,
): Leg | undefined {
  const leg = (asset: string, amount: string, decimals: number, basis: Leg["basis"]): Leg => ({
    direction: "out",
    wallet,
    asset: toAsset(asset),
    amount: parseAmount(amount, decimals),
    role: "gas",
    basis,
  });
  const evmHash = `0x${txId.replace(/^0x/i, "")}`.toLowerCase();
  const receipt = sources.evmReceipts?.find((tx) => tx.transactionHash.toLowerCase() === evmHash);

  if (receipt) {
    return leg(EVM_GAS_ASSETS[receipt.chain], receiptFee(receipt).toString(), EVM_DECIMALS, "observed");
  }

  const gasCoin =
    sources.thornodeTxs.find((tx) => tx.tx?.id === txId)?.tx?.gas?.[0] ??
    sources.viewblockInbounds?.find((tx) => tx.hash === txId)?.gas[0];

  if (gasCoin?.asset) {
    // THORNode (and Viewblock's copy) gives every gas amount in 1e8 units
    return leg(gasCoin.asset, gasCoin.amount, 8, "observed");
  }

  if (!inputAsset) {
    return undefined;
  }

  let asset;

  try {
    asset = assetFromStringEx(inputAsset);
  } catch {
    throw new Error(`Failed to parse asset string: "${inputAsset}"`);
  }
  // A tx sent on THORChain pays THORChain's fee, also inside a Maya action (e.g. RUNE swapped on Maya)
  const sentOnThorchain =
    asset.chain === THORCHAIN.nativeChain ||
    (protocol.id === THORCHAIN.id && [AssetType.SYNTH, AssetType.TRADE, AssetType.SECURED].includes(asset.type));

  if (sentOnThorchain) {
    return leg(THORCHAIN.nativeAsset, THORCHAIN.defaultGas!, THORCHAIN.decimals(THORCHAIN.nativeAsset), "default");
  }

  if (inputAsset === protocol.nativeAsset && protocol.defaultGas) {
    return leg(protocol.nativeAsset, protocol.defaultGas, protocol.decimals(protocol.nativeAsset), "default");
  }

  return undefined;
}
