import { Action, Coin, Transaction } from '@xchainjs/xchain-midgard';
import {
    CryptoTaxTransaction,
    CryptoTaxTransactionType,
} from '../cryptotax';
import {
    parseMidgardAmount,
    parseMidgardAsset,
    parseMidgardDate,
} from './MidgardUtils';
import { Mapper } from './Mapper';
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

// Switch is an upgrade of BNB.RUNE to THOR.RUNE
//
// This will be converted to 2 transactions, BridgeOut and BridgeIn, as it is crossing from one chain to another (Binance to THORChain) and retaining the
// same asset (and same cost basis). https://help.cryptotaxcalculator.io/en/articles/6268264-bridging-transactions
//
// Both transactions are created here as we have the details from both chains from the Midgard API.
// The Binance transaction also holds the details as well, as it will contain a memo which says, "SWITCH:{to_thorchain_address}".
export class SwitchMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = date.toISOString();
        const idPrefix: string = date.toISOString();

        const date_plus_10 = new Date(date.getTime() + (10 * 1000));
        const timestamp_plus_10: string = date_plus_10.toISOString();

        const transactions: CryptoTaxTransaction[] = [];

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const { blockchain: inputBlockchain, currency: inputCurrency } =
            parseMidgardAsset(inputCoin.asset);

        const txId = input.txID ?? '';

        const output: Transaction = action.out[0];
        const outputCoin: Coin = output.coins[0];
        const { blockchain: outputBlockchain, currency: outputCurrency } =
            parseMidgardAsset(outputCoin.asset);

        // Send BNB.RUNE

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.BridgeOut,
            baseCurrency: inputCurrency,
            baseAmount: parseMidgardAmount(inputCoin.amount),
            from: input.address,
            to: output.address,
            blockchain: inputBlockchain,
            id: `${idPrefix}.bridge-out`,
            description: `1/2 - Upgrade BNB.RUNE to THOR.RUNE (send BNB.RUNE); ${txId}`,
        });

        // Receive THOR.RUNE

        transactions.push({
            walletExchange: output.address,
            timestamp: timestamp_plus_10,
            type: CryptoTaxTransactionType.BridgeIn,
            baseCurrency: outputCurrency,
            baseAmount: parseMidgardAmount(outputCoin.amount),
            from: input.address,
            to: output.address,
            blockchain: outputBlockchain,
            id: `${idPrefix}.bridge-in`,
            description: `2/2 - Upgrade BNB.RUNE to THOR.RUNE (receive THOR.RUNE); ${txId}`,
        });

        return transactions;
    }
}
