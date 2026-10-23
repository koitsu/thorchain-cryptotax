import {afterEach, describe, mock, test} from "node:test";
import assert from "node:assert/strict";
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {EvmReceipts, receiptFee} from '../src/sources/evm/EvmReceipts.ts';
import {RecordStore} from '../src/sources/store/RecordStore.ts';
import {SnapshotManifest} from '../src/sources/store/SnapshotManifest.ts';
import {http} from '../src/sources/http.ts';

describe('EvmReceipts', () => {
    const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tc-ct-evm-'));
    const urls = {ETH: 'https://rpc.example/eth', BASE: 'https://rpc.example/base'};
    const result = {transactionHash: '0xabcd', blockNumber: '0x10', status: '0x1', gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00', logs: [{}], from: '0xwallet'};

    afterEach(() => {
        mock.restoreAll();
    });

    test("asks the chain's endpoint for the receipt by the 0x hash, keeps the fee fields, and replays it offline", async () => {
        const post = mock.method(http, 'post', async () => ({data: {jsonrpc: '2.0', id: 1, result}}) as any);
        const dir = tmp();
        const expected = {chain: 'ETH', transactionHash: '0xabcd', blockNumber: '0x10', status: '0x1', gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00'};

        assert.deepEqual(await new EvmReceipts(new RecordStore(dir), urls).getReceipt('ETH', 'ABCD'), expected);
        assert.equal(post.mock.calls[0].arguments[0], urls.ETH);
        assert.deepEqual((post.mock.calls[0].arguments[1] as any).params, ['0xabcd']);
        assert.deepEqual(await new EvmReceipts(new RecordStore(dir, {offline: true}), urls).getReceipt('ETH', 'ABCD'), expected);
    });

    test('a receipt the endpoint does not return is an error, and is not stored', async () => {
        const post = mock.method(http, 'post', async () => ({data: {jsonrpc: '2.0', id: 1, result: null}}) as any);
        // withRetry's waits pass at once
        mock.method(globalThis, 'setTimeout', (resolve: () => void) => resolve());
        const dir = tmp();

        await assert.rejects(new EvmReceipts(new RecordStore(dir), urls).getReceipt('ETH', 'ABCD'), /not returned by .*ETH_RPC_URL/);
        assert.equal(post.mock.callCount(), 4, 'asked again after each of the 3 retry waits');
        await assert.rejects(new EvmReceipts(new RecordStore(dir, {offline: true}), urls).getReceipt('ETH', 'ABCD'), /Offline/);
    });

    test("a rate limit or a missing receipt is retried; another RPC error is not", async () => {
        const {isTransient} = await import('../src/sources/Retry.ts');
        // Called directly (no store retry) to see how withRetry would classify it
        const classify = async (data: object) => {
            mock.method(http, 'post', async () => ({data}) as any);
            return (new EvmReceipts(new RecordStore(tmp()), urls) as any).fetchReceipt('ETH', urls.ETH, '0xabcd').catch((error: any) => isTransient(error));
        };

        assert.equal(await classify({error: {code: -32005, message: 'limit exceeded'}}), true);
        assert.equal(await classify({result: null}), true);
        assert.equal(await classify({error: {code: -32602, message: 'invalid argument'}}), false);
    });

    test('a receipt with an OP-stack operator fee stops the run', async () => {
        mock.method(http, 'post', async () => ({data: {jsonrpc: '2.0', id: 1, result: {...result, l1Fee: '0x10', operatorFeeScalar: '0x1', operatorFeeConstant: '0x0'}}}) as any);

        await assert.rejects(new EvmReceipts(new RecordStore(tmp()), urls).getReceipt('BASE', 'ABCD'), /operator fee/);
    });

    test('replaying a run made before receipts were read gives none', async () => {
        const dir = tmp();
        const manifest = path.join(dir, 'run');
        new SnapshotManifest().write(manifest);
        const store = new RecordStore(dir, {replay: SnapshotManifest.load(manifest)});

        assert.equal(await new EvmReceipts(store, urls).getReceipt('ETH', 'ABCD'), undefined);
    });

    test("the fee is gas used at the price charged, plus BASE's L1 data fee", () => {
        assert.equal(receiptFee({chain: 'ETH', transactionHash: '', blockNumber: '', status: '', gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00'}), 21000n * 1_000_000_000n);
        assert.equal(receiptFee({chain: 'BASE', transactionHash: '', blockNumber: '', status: '', gasUsed: '0x64', effectiveGasPrice: '0x2', l1Fee: '0x10'}), 216n);
    });
});
