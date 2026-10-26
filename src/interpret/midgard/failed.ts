import type { Action } from "@xchainjs/xchain-midgard";
import type { Activity } from "../../domain/Activity.ts";
import type { Issue } from "../../domain/Issue.ts";
import { failedTxPaidFee, type Protocol } from "../../domain/Protocol.ts";
import { getActionDate } from "../../sources/thorchain/MidgardUtils.ts";
import { getBundleKey, type RawBundle } from "../../sources/RawBundle.ts";
import { nativeGas } from "./bond.ts";

// What a deposit memo asked for, by its prefix, for the description (docs/specs/failed.md)
const DEPOSIT_ACTIONS: [RegExp, string][] = [
  [/^(=|swap|s)$/i, "swap"],
  [/^=[<>]$/, "limit swap"],
  [/^(\+|add|a)$/i, "add liquidity"],
  [/^(-|wd|withdraw)$/i, "withdraw liquidity"],
  [/^(~|n|name)$/i, "THORName"],
  [/^pool\+$/i, "RUNEPool deposit"],
  [/^pool-$/i, "RUNEPool withdraw"],
  [/^(loan\+|\$\+)$/i, "loan open"],
  [/^(loan-|\$-)$/i, "loan repayment"],
  [/^trade\+$/i, "trade deposit"],
  [/^trade-$/i, "trade withdraw"],
  [/^secure\+$/i, "secure deposit"],
  [/^secure-$/i, "secure withdraw"],
  [/^(bond|b)$/i, "bond"],
  [/^(unbond|ub)$/i, "unbond"],
  [/^tcy$/i, "TCY claim"],
  [/^tcy\+$/i, "TCY stake"],
  [/^tcy-$/i, "TCY unstake"],
];

export function depositActionName(memo: string): string {
  const prefix = memo.split(":")[0].trim();
  return DEPOSIT_ACTIONS.find(([pattern]) => pattern.test(prefix))?.[1] ?? (prefix ? `'${prefix}' deposit` : "deposit");
}

// The Cosmos SDK's prefix of an error the message handler returned: the ante handler, which takes the fee, had run
const MESSAGE_FAILED = /^failed to execute message; message index: \d+: /;
// The message ran out of gas: also after the ante handler
const OUT_OF_GAS = /^out of gas/i;

// THORNode's error without the SDK's prefix and its generic error class, on one line
export function failureReason(reason: string): string {
  return reason
    .replace(MESSAGE_FAILED, "")
    .replace(/: unknown request$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A native deposit THORNode rejected (Midgard type `failed`): its coins never moved; from the protocol's
// failedTxFeeFromHeight it still paid the native fee, in the ante handler (docs/specs/failed.md)
export function interpretFailedDeposit(
  bundle: RawBundle,
  protocol: Protocol,
): { activities: Activity[]; issues: Issue[] } {
  const action = bundle.data as Action;
  const input = action.in[0];
  const failed = (action.metadata as any)?.failed ?? {};

  if (input?.address !== bundle.wallet) {
    return {
      activities: [],
      issues: [{ kind: "ignored", message: "failed deposit of another wallet: it moved nothing of this one" }],
    };
  }

  if (!failedTxPaidFee(protocol, Number(action.height))) {
    return {
      activities: [],
      issues: [
        {
          kind: "ignored",
          message:
            "failed deposit that paid no native fee (before the fee moved into the ante handler, or on Maya): it moved nothing",
        },
      ],
    };
  }

  // Midgard lists every deposit with a failing code, also one the ante handler turned away, which may not have
  // paid the fee: only a failure of the message itself is known to have paid it
  if (!MESSAGE_FAILED.test(failed.reason ?? "") && !OUT_OF_GAS.test(failed.reason ?? "")) {
    return {
      activities: [],
      issues: [
        {
          kind: "warning",
          message: `failed deposit that did not reach its message (${failed.reason || "no reason"}): no fee exported; check on THORNode whether the native fee was paid`,
        },
      ],
    };
  }

  return {
    activities: [
      {
        id: getBundleKey(bundle),
        protocol: protocol.id,
        kind: "deposit.failed",
        status: "failed",
        time: getActionDate(action),
        memo: failed.memo || undefined,
        legs: [{ ...nativeGas(bundle.wallet, protocol), txid: input.txID }],
        prices: [],
        details: {
          from: input.address,
          to: protocol.counterparty,
          failedAction: depositActionName(failed.memo ?? ""),
          reason: failureReason(failed.reason ?? ""),
        },
      },
    ],
    issues: [],
  };
}
