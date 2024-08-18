import {LoanOpenMapper} from "../src/cryptotax-thorchain/LoanOpenMapper";
import fs from 'fs-extra';
import {describe, expect, test} from '@jest/globals';
const mapper = new LoanOpenMapper();

describe('LoanOpen', () => {
    test('Deposit BTC, borrow RUNE. No affiliate fee', () => {
        const action = fs.readJSONSync('test/testdata/loan-open-btc-to-rune.json');
        const txs = mapper.toCryptoTax(action, false);

        expect(txs.length).toBe(2);

        expect(txs[0]).toStrictEqual({
            walletExchange: 'bc1-user-wallet-aaaaa',
            timestamp: '31/12/2020 13:00:00',
            type: 'collateral-deposit',
            baseCurrency: 'BTC',
            baseAmount: '1.23',
            feeCurrency: 'RUNE',
            feeAmount: '2.22222222',
            from: 'bc1-user-wallet-aaaaa',
            to: 'thorchain',
            blockchain: 'BTC',
            id: '2020-12-31T13:00:00.000Z.collateral-deposit',
            description: '1/2 LoanOpen deposit BTC to borrow RUNE; ' +
                '0000000000000000000000000000000000000000000000000000000000000000'
        });

        expect(txs[1]).toStrictEqual({
            walletExchange: 'thor1-user-wallet-11111',
            timestamp: '31/12/2020 13:00:00',
            type: 'loan',
            baseCurrency: 'RUNE',
            baseAmount: '4000',
            feeCurrency: 'RUNE',
            feeAmount: '0.02',
            from: 'thorchain',
            to: 'thor1-user-wallet-11111',
            blockchain: 'THOR',
            id: '2020-12-31T13:00:00.000Z.loan',
            description: '2/2 LoanOpen deposit BTC to borrow RUNE; ' +
                '0000000000000000000000000000000000000000000000000000000000000000'
        });
    });

    test('Deposit BTC, borrow RUNE. With affiliate fee', () => {
        const action = fs.readJSONSync('test/testdata/loan-open-btc-to-rune-affiliate-fee.json');
        const txs = mapper.toCryptoTax(action, false);

        expect(txs.length).toBe(2);

        expect(txs[0]).toStrictEqual({
            walletExchange: 'bc1-user-wallet-aaaaa',
            timestamp: '31/12/2020 13:00:00',
            type: 'collateral-deposit',
            baseCurrency: 'BTC',
            baseAmount: '1.23',
            feeCurrency: 'RUNE',
            feeAmount: '2.22222222',
            from: 'bc1-user-wallet-aaaaa',
            to: 'thorchain',
            blockchain: 'BTC',
            id: '2020-12-31T13:00:00.000Z.collateral-deposit',
            description: '1/2 LoanOpen deposit BTC to borrow RUNE; ' +
                '0000000000000000000000000000000000000000000000000000000000000000'
        });

        expect(txs[1]).toStrictEqual({
            walletExchange: 'thor1-user-wallet-11111',
            timestamp: '31/12/2020 13:00:00',
            type: 'loan',
            baseCurrency: 'RUNE',
            baseAmount: '4000',
            feeCurrency: 'RUNE',
            feeAmount: '20',
            from: 'thorchain',
            to: 'thor1-user-wallet-11111',
            blockchain: 'THOR',
            id: '2020-12-31T13:00:00.000Z.loan',
            description: '2/2 LoanOpen deposit BTC to borrow RUNE; ' +
                '0000000000000000000000000000000000000000000000000000000000000000'
        });
    });
});
