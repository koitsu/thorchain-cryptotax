import { Action, Coin, Transaction } from '@xchainjs/xchain-midgard';
import {
    CryptoTaxTransaction,
    CryptoTaxTransactionType,
    toCryptoTaxTimestamp,
} from '../cryptotax';
import { getPrice } from "../cmc-scraper";
import {
    parseMidgardAmount,
    parseMidgardAsset,
    parseMidgardDate,
    parseMidgardPool,
} from './MidgardUtils';
import { Mapper } from './Mapper';
import {NetworkFees} from "@xchainjs/xchain-midgard/lib/generated/midgardApi/api";

export class WithdrawMapper implements Mapper {
    toCryptoTax(action: Action): CryptoTaxTransaction[] {
        const numAssetsOut: number = action.out.length;

        if (numAssetsOut === 0 || numAssetsOut > 2) {
            throw new Error(
                `WithdrawMapper: numAssetsIn must either be 1 or 2 but was ${numAssetsOut}`
            );
        }

        const withdrawals = [];

        // Order withdrawals so RUNE is first
        console.log(JSON.stringify(action.out, null, 4));

        if (action.out[0].address.startsWith('thor')) {
            withdrawals.push(action.out[0]);

            if (numAssetsOut === 2) {
                withdrawals.push(action.out[1]);
            }
        } else {
            if (numAssetsOut === 2) {
                withdrawals.push(action.out[1]);
            }

            withdrawals.push(action.out[0]);
        }

        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = toCryptoTaxTimestamp(date);
        const idPrefix: string = date.toISOString();
        const pool: string = parseMidgardPool(action.pools[0]);
        const poolName: string = `ThorLP.${pool}`;
        const liquidityUnits: string = parseMidgardAmount(
            action.metadata.withdraw?.liquidityUnits ?? ''
        ).replace('-', '');
        const isSavers: boolean = action.pools[0].includes('/');
        const symmDesc = isSavers ? 'savers' : (numAssetsOut === 2 ? 'symmetric' : 'asymmetric');

        // For savers the LP units are denominated in the asset used for saving, so we need to ensure it
        // uses a different token name. eg. ThorLP.BTC/BTC
        const lpToken: string = isSavers ? `ThorLP.${action.pools[0]}` : `ThorLP.${pool}`;

        const date_plus_10 = new Date(date.getTime() + (10 * 1000));
        const date_plus_20 = new Date(date.getTime() + (20 * 1000));
        const timestamp_plus_10: string = toCryptoTaxTimestamp(date_plus_10);
        const timestamp_plus_20: string = toCryptoTaxTimestamp(date_plus_20);

        const totalTxs = numAssetsOut + 2;
        let currentTxNum = totalTxs;
        const transactions: CryptoTaxTransaction[] = [];

        // Withdraw asset(s)

        for (let i = 0; i < numAssetsOut; i++) {
            const withdraw: Transaction = withdrawals[i];
            const coin: Coin = withdraw.coins[0];
            const { blockchain, currency } = parseMidgardAsset(coin.asset);

            // NOTE: sometimes there is only 1 item in networkFees even though 2 assets are withdrawn
            // const {feeCurrency, feeAmount} = this.getFee(action.metadata.withdraw?.networkFees[i]);

            // Ignore network fees on withdrawals as they are applied prior to returning the assets.
            // If they are included then it creates negative balances in CTC.
            const feeCurrency = '';
            const feeAmount = '';

            transactions.push({
                walletExchange: withdraw.address,
                timestamp: timestamp_plus_20,
                type: CryptoTaxTransactionType.RemoveLiquidity,
                baseCurrency: currency,
                baseAmount: parseMidgardAmount(coin.amount),
                feeCurrency,
                feeAmount,
                from: 'thorchain',
                to: withdraw.address,
                blockchain,
                id: `${idPrefix}.remove-liquidity.${currency}`,
                description: `${currentTxNum}/${totalTxs} - Remove liquidity ${currency} from ${poolName} (${symmDesc})`,
            });

            currentTxNum--;
        }

        // Use first withdrawal asset (likely to be RUNE)
        const quoteCurrency: string = transactions[0].baseCurrency;
        const quoteAmount: string = (
            parseFloat(transactions[0].baseAmount) * numAssetsOut
        ).toString();

        const totalValue = getPrice(quoteCurrency, date) * parseFloat(quoteAmount);
        const referencePricePerUnit = (totalValue / parseFloat(liquidityUnits)).toString();

        // Market price for LP units

        transactions.unshift({
            walletExchange: action.in[0].address,
            timestamp: timestamp_plus_10,
            type: CryptoTaxTransactionType.Spam,
            baseCurrency: quoteCurrency,
            baseAmount: quoteAmount,
            from: action.in[0].address,
            to: 'thorchain',
            id: `${idPrefix}.spam`,
            description:
                `${currentTxNum}/${totalTxs} - Dummy transaction to get market price to then manually apply to the return LP token transaction ${poolName} (${symmDesc})`,
        });

        currentTxNum--;

        // Return liquidity units

        transactions.unshift({
            walletExchange: action.in[0].address,
            timestamp,
            type: CryptoTaxTransactionType.ReturnLpToken,
            baseCurrency: lpToken,
            baseAmount: liquidityUnits,
            from: action.in[0].address,
            to: 'thorchain',
            blockchain: 'THOR',
            id: `${idPrefix}.return-lp-token`,
            description: `${currentTxNum}/${totalTxs} - Return LP token to ${poolName} (${symmDesc})`,
            referencePriceCurrency: 'USD',
            referencePricePerUnit
        });

        return transactions.reverse();
    }

    getFee(networkFee: Coin | undefined) {
        return networkFee ? {
            feeCurrency: parseMidgardAsset(networkFee.asset).currency,
            feeAmount: parseMidgardAmount(networkFee.amount)
        } : {
            feeCurrency: '',
            feeAmount: ''
        }
    }
}
