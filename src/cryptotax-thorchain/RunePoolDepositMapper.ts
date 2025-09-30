import {Action, Coin, Transaction} from '@xchainjs/xchain-midgard';
import {CryptoTaxTransaction, CryptoTaxTransactionType} from '../cryptotax';
import {parseMidgardDate} from './MidgardUtils';
import {baseToAssetAmountString} from '../utils/Amount';
import {Mapper} from './Mapper';
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

export class RunePoolDepositMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = date.toISOString();
        const idPrefix: string = date.toISOString();
        const poolName: string = 'RUNEPool';

        const transactions: CryptoTaxTransaction[] = [];

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const amount = baseToAssetAmountString(inputCoin.amount);
        const liquidityUnits: string = baseToAssetAmountString(
            action.metadata.runePoolDeposit?.units ?? ''
        );
        const txId = input.txID ?? '';

        const lpToken: string = 'ThorLP.RUNE';

        const date_plus_10 = new Date(date.getTime() + (10 * 1000));
        const timestamp_plus_10: string = date_plus_10.toISOString();

        // Deposit asset

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.AddLiquidity,
            baseCurrency: 'RUNE',
            baseAmount: amount,
            from: input.address,
            to: 'thorchain',
            blockchain: 'THOR',
            id: `${idPrefix}.add-liquidity`,
            description: `1/2 - Deposit ${amount} RUNE to ${poolName}; ${txId}`,
        });

        let lpTokenReceivingAddress = action.in[0].address;

        if (!lpTokenReceivingAddress) {
            lpTokenReceivingAddress = 'MISSING-DEPOSIT-ADDRESS';
        }

        // Receive liquidity units

        transactions.push({
            walletExchange: lpTokenReceivingAddress,
            timestamp: timestamp_plus_10,
            type: CryptoTaxTransactionType.ReceiveLpToken,
            baseCurrency: lpToken,
            baseAmount: liquidityUnits,
            from: 'thorchain',
            to: lpTokenReceivingAddress,
            blockchain: 'THOR',
            id: `${idPrefix}.receive-lp-token`,
            description: `2/2 - Receive LP token from ${poolName}; ${txId}`,
        });

        return transactions;
    }
}
