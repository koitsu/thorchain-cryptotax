import {describe, mock, test} from "node:test";
import assert from "node:assert/strict";
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {http} from '../src/sources/http.ts';
import {RecordStore} from '../src/sources/store/RecordStore.ts';
import {MidgardService} from '../src/sources/thorchain/MidgardService.ts';
import {needsRunePrice} from '../src/sources/thorchain/CosmosTxService.ts';

const store = () => new RecordStore(fs.mkdtempSync(path.join(os.tmpdir(), 'tc-ct-rune-price-')));

describe('RUNE price at a time (docs/specs/rujira.md)', () => {
    test("the 5-minute bucket holding the time, stored once per bucket", async () => {
        const get = mock.method(http, 'get', async () => ({
            data: {intervals: [
                {startTime: '1778288400', endTime: '1778288700', runePriceUSD: '0.5998751190022197'},
                {startTime: '1778288700', endTime: '1778289000', runePriceUSD: '0.599924675910928'},
            ]},
        }) as any);
        const midgard = new MidgardService(store(), 'midgard', 'https://midgard');

        assert.equal((await midgard.getRunePrice(new Date(1778288467819))).runePriceUSD, '0.5998751190022197');
        assert.equal((await midgard.getRunePrice(new Date(1778288599000))).runePriceUSD, '0.5998751190022197');
        assert.deepEqual(get.mock.calls.map(call => call.arguments[0]), [
            'https://midgard/v2/history/rune?interval=5min&from=1778288400&to=1778288700',
        ]);
        get.mock.restore();
    });

    test('only a contract action that sends bRUNE needs it', () => {
        const contract = (funds: string) => ({type: 'contract', metadata: {contract: {funds}}}) as any;

        assert.equal(needsRunePrice(contract('2120049376x/brune')), true);
        assert.equal(needsRunePrice(contract('226901077830x/ruji')), false);
        assert.equal(needsRunePrice(contract('55000000000rune')), false);
        assert.equal(needsRunePrice({type: 'send', metadata: {}} as any), false);
    });
});
