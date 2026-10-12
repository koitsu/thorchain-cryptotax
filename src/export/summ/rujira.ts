import type {Activity, Leg} from "../../domain/Activity.ts";
import {formatAmount} from "../../domain/Amount.ts";
import {type SummRow, SummRowType} from "./csv/index.ts";
import {parseMidgardAsset} from "../../sources/thorchain/MidgardUtils.ts";
import {formatBlockchain, type Protocol} from "../../domain/Protocol.ts";
import {findLeg, leg, legTrace, plusSeconds, referencePrice} from "./common.ts";

// Rujira rows (docs/specs/rujira.md): an account bond is a staking deposit; liquid bonds, FIN swaps and merges are trades

// The fee columns when the wasm call paid gas; none at all otherwise
function feeIfPaid(activity: Activity, protocol: Protocol): Pick<SummRow, 'feeCurrency' | 'feeAmount'> {
    const gas = findLeg(activity, 'gas');
    return gas ? {feeCurrency: parseMidgardAsset(gas.asset.notation, protocol).currency, feeAmount: formatAmount(gas.amount)} : {};
}

// A leg's asset as the CSV names it; a merge position is RujiraMerge.<chain>.<asset>, counted in pool shares
function name(item: Leg, protocol: Protocol): {currency: string; displayCurrency: string} {
    const {currency, displayCurrency} = parseMidgardAsset(item.asset.notation, protocol);

    return item.asset.position === 'merge'
        ? {currency: `RujiraMerge.${protocol.nativeChain}.${currency}`, displayCurrency: `${displayCurrency} merge shares`}
        : {currency, displayCurrency};
}

export function rujiraStakeRows(activity: Activity, protocol: Protocol): SummRow[] {
    const funds = leg(activity, 'principal', 'out');
    const {currency, displayCurrency} = name(funds, protocol);
    const amount = formatAmount(funds.amount);
    const time = activity.time;

    return [{
        wallet: funds.wallet,
        timestamp: time,
        type: SummRowType.StakingDeposit,
        baseCurrency: currency,
        baseAmount: amount,
        ...feeIfPaid(activity, protocol),
        from: funds.wallet,
        to: protocol.counterparty,
        blockchain: formatBlockchain(protocol.nativeChain),
        trace: legTrace(funds),
        description: `1/1 - Rujira Account bond ${amount} ${displayCurrency}; ${funds.txid ?? ''}`,
    }];
}

const TRADES: {[kind: string]: {label: string}} = {
    'rujira.liquid.bond': {label: 'Liquid bond'},
    'rujira.fin.trade': {label: 'FIN swap'},
    'rujira.merge.deposit': {label: 'Merge deposit'},
    'rujira.merge.withdraw': {label: 'Merge withdraw'},
};

// A trade-out carrying the fee, and the trade-in 10 s later; an amount returned unfilled is netted off
export function rujiraTradeRows(activity: Activity, protocol: Protocol): SummRow[] {
    const {label} = TRADES[activity.kind];
    const sent = leg(activity, 'principal', 'out');
    const received = leg(activity, 'principal', 'in');
    const returned = findLeg(activity, 'returned');
    const input = {...name(sent, protocol), amount: formatAmount({...sent.amount, base: sent.amount.base - (returned?.amount.base ?? 0n)})};
    const output = {...name(received, protocol), amount: formatAmount(received.amount)};
    const description = `Rujira ${label} ${input.amount} ${input.displayCurrency} to ${output.amount} ${output.displayCurrency}; ${sent.txid ?? ''}`;
    const time = activity.time;
    const blockchain = formatBlockchain(protocol.nativeChain);

    return [
        {
            wallet: sent.wallet,
            timestamp: time,
            type: SummRowType.BridgeTradeOut,
            baseCurrency: input.currency,
            baseAmount: input.amount,
            quoteCurrency: output.currency,
            quoteAmount: output.amount,
            ...feeIfPaid(activity, protocol),
            // e.g. bRUNE, which Summ has no price for
            ...referencePrice(activity, 'midgard:history.rune'),
            from: sent.wallet,
            to: protocol.counterparty,
            blockchain,
            trace: legTrace(sent),
            description: `1/2 - ${description}`,
        },
        {
            wallet: sent.wallet,
            timestamp: plusSeconds(activity.time, 10),
            type: SummRowType.BridgeTradeIn,
            baseCurrency: output.currency,
            baseAmount: output.amount,
            from: protocol.counterparty,
            to: sent.wallet,
            blockchain,
            trace: legTrace(received),
            description: `2/2 - ${description}`,
        },
    ];
}
