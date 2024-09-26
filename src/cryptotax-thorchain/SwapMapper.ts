import { Action, Coin, Transaction } from '@xchainjs/xchain-midgard';
import { CryptoTaxTransaction, CryptoTaxTransactionType, toCryptoTaxTimestamp } from '../cryptotax';
import { parseMidgardAmount, parseMidgardAsset } from './MidgardUtils';
import { TxStatusResponse } from '@xchainjs/xchain-thornode';
import { BaseMapper } from './BaseMapper';

// https://dev.thorchain.org/concepts/memos.html#swap
const SWAP_DESTADDR = 2;

function isSynth(tx: Transaction): boolean {
    return tx.coins[0].asset.includes('/');
}

// Wallet-A1 CSV
// * send currency A to thorchain

// Wallet B1 CSV
// * receive currency B from thorchain

export class SwapMapper extends BaseMapper {
    protected mapperName: string = 'SwapMapper';

    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        super.action = action;
        super.addReferencePrices = addReferencePrices;
        super.thornodeTxs = thornodeTxs;

        const date_plus_10 = new Date(this.datetime.getTime() + 10 * 1000);
        const timestamp_plus_10: string = toCryptoTaxTimestamp(date_plus_10);

        const transactions: CryptoTaxTransaction[] = [];

        const numAssetsIn: number = action.in.length;

        if (numAssetsIn !== 1) {
            throw this.error(`Expected numAssetsIn to be 1 but was ${numAssetsIn}`);
        }

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const { blockchain: inputBlockchain, currency: inputCurrency, amountParsed: inputAmount } = this.parseCoin(inputCoin.asset, inputCoin.amount);
        const inputIsSynth: boolean = isSynth(input);

        const txId = action.in[0].txID ?? '';
        const memo = action.metadata.swap?.memo;

        const output: Transaction = this.getOutput(action, memo);
        const outputCoin: Coin = output.coins[0];
        const { blockchain: outputBlockchain, currency: outputCurrency, amountParsed: outputAmount } = this.parseCoin(outputCoin.asset, outputCoin.amount);
        const outputIsSynth: boolean = isSynth(output);

        if (!inputCurrency) {
            throw this.error('No input currency');
        }

        if (!inputAmount) {
            throw this.error('No input amount');
        }

        console.log(
            `${this.timestamp} swap ${inputBlockchain}.${inputCurrency}${
                inputIsSynth ? ' *synth*' : ''
            } to ${outputBlockchain}.${outputCurrency}${outputIsSynth ? ' *synth*' : ''} - ${input.txID ?? output.txID}`
        );

        // If synth (eg. BTC/BTC) but address is not thor, then ignore. Likely a savers withdrawal.
        if (inputIsSynth && !input.address.startsWith('thor1')) {
            console.log('SWAP IGNORED');
            return [];
        }

        // Can appear with lending transactions
        if (inputCoin.asset === 'THOR.TOR' || outputCoin.asset === 'THOR.TOR') {
            throw this.error('Invalid swap - THOR.TOR');
        }

        const { blockchain: feeBlockchain, currency: feeCurrency } = parseMidgardAsset(action.metadata.swap?.networkFees[0].asset ?? '');

        // Wallet A1 - Send asset A to thorchain --------------------------------------------------

        transactions.push({
            walletExchange: input.address,
            timestamp: this.timestamp,
            type: CryptoTaxTransactionType.BridgeTradeOut,
            baseCurrency: inputCurrency,
            baseAmount: inputAmount,
            quoteCurrency: outputCurrency,
            quoteAmount: parseMidgardAmount(outputCoin.amount),
            feeCurrency,
            feeAmount: parseMidgardAmount(action.metadata.swap?.networkFees[0].amount ?? ''),
            from: input.address,
            to: 'thorchain',
            blockchain: inputBlockchain,
            id: `${this.idPrefix}.thorchain.bridge-trade-out`,
            description: `1/2 - Swap ${inputIsSynth ? 'Synth ' : ''}${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency}; ${txId}`,
        });

        // Wallet B1 - Receive asset B from thorchain ---------------------------------------------

        transactions.push({
            walletExchange: output.address,
            timestamp: this.timestamp,
            type: CryptoTaxTransactionType.BridgeTradeIn,
            baseCurrency: outputCurrency,
            baseAmount: outputAmount,
            from: 'thorchain',
            to: output.address,
            blockchain: outputBlockchain,
            id: `${this.idPrefix}.thorchain.bridge-trade-in`,
            description: `2/2 - Swap ${inputIsSynth ? 'Synth ' : ''}${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency}; ${txId}`,
        });

        return transactions;
    }

    // Find which output is for the user. As there may also be an output for an affiliate.
    getOutput(action: Action, memo: string | undefined): Transaction {
        if (!memo) {
            throw this.error('No memo');
        }

        const destAddress = this.getDestAddress(memo);
        const out = action.out.find((out) => out.address.toLowerCase() === destAddress.toLowerCase());

        if (!out) {
            throw this.error('No matching out tx');
        }

        return out;
    }

    getDestAddress(memo: string): string {
        return memo.split(':')[SWAP_DESTADDR];
    }
}
