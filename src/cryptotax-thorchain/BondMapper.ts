import {Action, BondMetadata, Coin, Transaction} from '@xchainjs/xchain-midgard';
import {CryptoTaxTransaction, CryptoTaxTransactionType,} from '../cryptotax';
import {parseMidgardDate,} from './MidgardUtils';
import {baseToAssetAmountString} from '../utils/Amount';
import {Mapper} from './Mapper';
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

// 0.02 RUNE
const DEFAULT_RUNE_GAS = '2000000';

export class BondMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = date.toISOString();
        const idPrefix: string = date.toISOString();

        const transactions: CryptoTaxTransaction[] = [];

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const txId = input.txID ?? '';

        const bondMetadata: BondMetadata = action.metadata.bond as BondMetadata;
        const nodeAddress: string = bondMetadata.nodeAddress;

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.StakingDeposit,
            baseCurrency: 'RUNE',
            baseAmount: baseToAssetAmountString(inputCoin.amount),
            feeCurrency: 'RUNE',
            feeAmount: baseToAssetAmountString(DEFAULT_RUNE_GAS),
            from: input.address,
            to: 'thorchain',
            blockchain: 'THOR',
            id: `${idPrefix}.bond`,
            description: `1/1 - Bond RUNE to ${nodeAddress}; ${txId}`,
        });

        return transactions;
    }
}
