# Savers

THORChain Savers (2022 until the ThorFi shutdown in January 2025) took a single
L1 asset, held it as the synth inside the pool, and paid yield in that asset.

## What Midgard reports

- Deposit: an `addLiquidity` action whose pool is the synth (`BTC/BTC`), and
  whose input coin is also reported as the synth, even when the wallet sent
  L1 BTC from a `bc1…` address. Its amount is the synth minted, after the
  swap's liquidity fee, so for an L1 deposit it is less than the wallet sent.
  THORNode's status of the inbound tx holds the L1 coin sent (`BTC.BTC`).
- Older deposits also list a `swap` with `metadata.swap.txType: add` for the
  same txid (the L1 coin in, no output), left `pending`. It is not exported:
  the `addLiquidity` of its txid covers it (`pending.md`).
- Withdrawal: a `withdraw` action for the same pool. The request is a dust
  send from the wallet; the output is the L1 asset (`BTC.BTC`).

## Rows

Savers are exported like a liquidity position (`liquidity.md`): an
`AddLiquidity` or `RemoveLiquidity` row for the asset, a `ReceiveLpToken` or
`ReturnLpToken` row for the position, and the `Spam` price-helper row. A
savers deposit goes into the pool, and the protocol provides the pool's other
side, so it is treated as a liquidity position rather than staking (an open
choice, below). The position token's amount is the `liquidityUnits` Midgard
reports, which for savers is close to the synth minted.

| Field | Value | Why |
| --- | --- | --- |
| Asset currency, deposit sent from an L1 wallet | the L1 asset, e.g. `BTC` | the wallet sent real BTC, not the synth (`assets.md`) |
| Asset currency, synth deposited from a THORChain wallet | the synth, e.g. `ThorSynth.BTC.BTC` | the wallet sent the synth |
| Asset amount, deposit sent from an L1 wallet | the L1 amount sent: THORNode's inbound coin; Midgard's coin (the synth minted), with a warning, when THORNode has no status for the tx | the wallet disposed of what it sent; the swap's fee into the synth is netted off inside the protocol, as every protocol fee is (`fees.md`), so it lowers the position's units, not the amount sent |
| Asset amount, synth deposited from a THORChain wallet | Midgard's coin | the synth sent is the synth deposited |
| Position token | `ThorSavers.<chain>.<asset>`, e.g. `ThorSavers.BTC.BTC`, `ThorSavers.ETH.USDC` | savers units are not pool LP units, so it must differ from `ThorLP.BTC.BTC`; no `/`, which breaks Summ's ledger view; the same `<prefix>.<chain>.<asset>` shape as LP tokens |
| Fee on the deposit | the deposit's inbound fee: L1 gas for an L1 wallet (blank when neither THORNode nor Viewblock has it), 0.02 RUNE for a synth from a THORChain wallet | `fees.md` |

The price-helper row has the asset amount, so it values the position at what
was sent: the position's cost base.

Before October 2026 the token was `ThorLP.BTC/BTC`, a deposit sent from an L1
wallet was exported as `BTC.BTC` (then the synth's name) and, briefly, with a
0.02 RUNE fee; until late October 2026 its amount (and the price helper's) was
the synth minted.

An affiliate named in the deposit's memo gets its share as an add of its own,
in the affiliate's name (THORNode's add-liquidity handler). That add is not the
wallet's, so the wallet has one row for the whole amount sent, and the share
leaves inside the protocol, like any protocol fee. Until February 2024
(THORNode 1.128) the affiliate was looked up on THORChain, where a savers add
takes no address, so a deposit naming a THORChain affiliate or THORName failed
and was refunded (`fees.md`, Refunds); only an affiliate on the asset's own chain
was split.

Maya has the same fields with `MayaSavers` as the prefix. Its inbounds are not
looked up on a node, so a Maya savers deposit from an L1 wallet keeps Midgard's
coin, with a warning.

## Open

- Treatment: liquidity position (today) or staking deposit and withdrawal.
- The ThorFi shutdown: savers positions still open in January 2025 were
  converted to TCY. How the conversion is exported is not specified.

## Golden cases

`liquidity/add-btc-savers` and `liquidity/withdraw-btc-savers` (public
transactions).
