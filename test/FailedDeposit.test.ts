import {describe, test} from "node:test";
import assert from "node:assert/strict";
import {depositActionName, failureReason, interpretFailedDeposit} from "../src/interpret/midgard/failed.ts";
import {interpret} from "../src/interpret/registry.ts";
import type {RawBundle} from "../src/sources/RawBundle.ts";
import {MAYA, THORCHAIN} from "../src/domain/Protocol.ts";

// Every value below is made up
const WALLET = 'thor1-user-wallet-11111';

const failed = (memo: string, reason: string, height = THORCHAIN.failedTxFeeFromHeight!, protocol = 'thorchain'): RawBundle => ({
    source: 'midgard', protocol: protocol as any, wallet: WALLET, thornodeTxs: [], cosmosTxs: [],
    data: {
        type: 'failed', status: 'success', date: '1700000000000000000', height: String(height), pools: [],
        in: [{address: WALLET, txID: 'A'.repeat(64), coins: [{asset: 'THOR.RUNE', amount: '500000000'}]}],
        out: [],
        metadata: {failed: {code: '5', memo, reason}},
    } as any,
});

describe('interpretFailedDeposit', () => {
    test('a failed deposit is its signer\'s native fee only: the coins it asked for never moved', () => {
        const {activities, issues} = interpretFailedDeposit(failed('=:BTC~BTC:thor1x', 'failed to execute message; message index: 0: insufficient funds'), THORCHAIN);

        assert.deepEqual(issues, []);
        assert.equal(activities.length, 1);
        const [activity] = activities;
        assert.deepEqual([activity.kind, activity.status], ['deposit.failed', 'failed']);
        assert.deepEqual(activity.legs.map(leg => [leg.role, leg.direction, leg.asset.notation, leg.txid]), [['gas', 'out', 'THOR.RUNE', 'A'.repeat(64)]]);
        assert.deepEqual(activity.details, {from: WALLET, to: 'thorchain', failedAction: 'swap', reason: 'insufficient funds'});
    });

    test('names what the memo asked for, and keeps THORNode\'s reason on one line', () => {
        assert.deepEqual(['=:x', 'SWAP:x', '+:x', '~:name', 'POOL-:0', 'tcy-:x', 'trade+:x', 'foo:x', ''].map(depositActionName),
            ['swap', 'swap', 'add liquidity', 'THORName', 'RUNEPool withdraw', 'TCY unstake', 'trade deposit', "'foo' deposit", 'deposit']);
        assert.equal(failureReason('failed to execute message; message index: 0: invalid memo: 2 errors occurred:\n\t* internal error\n\t* MEMO: x'),
            'invalid memo: 2 errors occurred: * internal error * MEMO: x');
        assert.equal(failureReason('failed to execute message; message index: 0: invalid basis points: unknown request'), 'invalid basis points');
    });

    test('gives nothing when the wallet is not the signer, before the fee moved into the ante handler, or on Maya', () => {
        const other = {...failed('=:x', 'insufficient funds'), wallet: 'thor1-other-wallet-2222'};
        for (const [bundle, protocol] of [
            [other, THORCHAIN],
            [failed('=:x', 'insufficient funds', THORCHAIN.failedTxFeeFromHeight! - 1), THORCHAIN],
            [failed('=:x', 'insufficient funds', 30_000_000, 'maya'), MAYA],
        ] as const) {
            const {activities, issues} = interpretFailedDeposit(bundle, protocol);
            assert.deepEqual([activities, issues.map(issue => issue.kind)], [[], ['ignored']]);
        }
    });

    test('the registry maps it on THORChain and on Maya (where it is ignored), so it is never unsupported', () => {
        assert.equal(interpret(failed('=:x', 'insufficient funds'), THORCHAIN).activities.length, 1);
        assert.deepEqual(interpret(failed('=:x', 'insufficient funds', 30_000_000, 'maya'), MAYA).issues.map(issue => issue.kind), ['ignored']);
    });
});
