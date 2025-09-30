import {Action, Coin, Transaction} from '@xchainjs/xchain-midgard';
import {CryptoTaxTransaction, CryptoTaxTransactionType} from '../cryptotax';
import {parseMidgardDate} from './MidgardUtils';
import {baseToAssetAmountString} from '../utils/Amount';
import {Mapper} from './Mapper';
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

// This is only mapping the receive tx of TCY.
// Not the signing with a dust amount from the original wallet.
export class TcyStakeMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = date.toISOString();
        const idPrefix: string = date.toISOString();

        const transactions: CryptoTaxTransaction[] = [];

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const amount = baseToAssetAmountString(inputCoin.amount);
        const txId = input.txID ?? '';

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.StakingDeposit,
            baseCurrency: 'TCY',
            baseAmount: amount,
            from: input.address,
            to: 'thorchain',
            blockchain: 'THOR',
            id: `${idPrefix}.tcy_stake`,
            description: `1/1 - Stake ${amount} TCY; ${txId}`,
        });

        return transactions;
    }
}
