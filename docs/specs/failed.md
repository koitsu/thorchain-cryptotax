# Failed deposits

A failed deposit is a native `MsgDeposit` (a swap, add, withdraw,
THORName, RUNEPool or TCY request sent from a THORChain wallet) that
THORNode rejected while running the message: for example, insufficient
funds, an affiliate set without its address, a name owned by someone
else, or an invalid memo. A failed L1 inbound is a refund (`fees.md`,
Refunds), and a failed send is a send with status `failed` (`sends.md`).

## Source

Midgard lists it as an action of type `failed`, made from THORNode's
`failed_deposit_messages` events (Midgard `internal/db/aggregates.sql`,
view `failed_actions`):

- `in[0]`: the signer's address, the txid, and the coins the deposit asked
  for (none when the coin was 0);
- `out`: empty;
- `metadata.failed`: `code`, `memo`, and `reason` (THORNode's error,
  e.g. `failed to execute message; message index: 0: insufficient funds`);
- `status`: `success` (Midgard sets it so for this type).

It has no fee field. Midgard's `/actions` cannot filter by this type
(`type=failed` is refused), so the actions come from a wallet's listing.

## What it moved

The deposit's coins never left the wallet: the message failed and its
changes were rolled back. The native fee was paid: THORNode's
`DepositAnteHandler` deducts it before the message runs
(`x/thorchain/handler_deposit.go`, `DeductNativeTxFeeFromAccount`), and the
ante handler's changes are kept when the message fails. THORNode shows such
a tx with its code and one transfer of the fee from the signer to a module
account (the Reserve, or the fee collector in later versions). The block
rule is the one for failed sends (`sends.md`, from block 11,637,012,
`failedTxFeeFromHeight` in `src/domain/Protocol.ts`): before it, a failed
message paid nothing.

Midgard lists every `MsgDeposit` that a block holds with a failing code
(`processTx` in `internal/fetch/record/mux.go`), so also one the ante
handler turned away, which may not have paid the fee. Only an error of the
message itself is known to have paid it: the Cosmos SDK prefixes those with
`failed to execute message; message index: N:` (`runMsgs` in `baseapp`).
Every failed deposit seen so far has that prefix. One without it gives no
row and a warning to check on THORNode.

On Maya, `DepositAnteHandler` only tracks the funds and charges no fee
(Mayanode `x/mayachain/handler_deposit.go`), so a failed deposit paid
nothing, as a failed Maya send.

## Activity

Kind `deposit.failed`, status `failed`, on the signer's wallet. One leg:
out: gas, the native fee at the action's height (default 0.02 RUNE). The
details hold `from` (the signer), `to` (the protocol), `failedAction` (what
the memo asked for, e.g. `swap`, `THORName`) and `reason` (THORNode's
error without its `failed to execute message; message index: N:` prefix
and a trailing `: unknown request`, the SDK's generic error class).

No activity, only an `ignored` issue, when the wallet is not the signer,
before the block rule, or on Maya; and only a `warning` when the reason
lacks the message prefix (above).

## Rows

One `fee` row of the native fee, on the signer's wallet, to the protocol:

| Type | Base | From | To | Description |
| --- | --- | --- | --- | --- |
| `fee` | 0.02 RUNE | the signer | `thorchain` | `Fee: failed swap (insufficient funds); <txid>` |

The coins the deposit asked for give no row. This is the shape of a failed
send's row (`sends.md`), and of what a refund's protocol kept (`fees.md`).

## Tests

Golden case `failed/midgard-swap-insufficient-funds`: a public trade-asset
swap of RUNE that failed for insufficient funds; one `fee` row of 0.02 RUNE.
Unit tests (`test/FailedDeposit.test.ts`): the action name and reason,
a signer that is not the wallet, before the block rule, Maya, and a
failure before the message ran.
