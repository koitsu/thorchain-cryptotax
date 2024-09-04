import { Action, Coin, Transaction } from '@xchainjs/xchain-midgard';
import {
    CryptoTaxTransaction,
    CryptoTaxTransactionType,
    toCryptoTaxTimestamp,
} from '../cryptotax';
import {
    parseMidgardAmount,
    parseMidgardAsset,
    parseMidgardDate,
    parseMidgardPool,
    toCryptoTaxCurrencyTicker,
} from './MidgardUtils';
import { Mapper } from './Mapper';
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

// https://dev.thorchain.org/concepts/memos.html#swap
const SWAP_DESTADDR = 2;

function isSynth(tx: Transaction): boolean {
    return (
        // tx.address.startsWith('thor1') && !tx.coins[0].asset.startsWith('THOR.')
        tx.coins[0].asset.includes('/')
    );
}

// Wallet-A1 CSV
// * send currency A to thorchain

// Thorchain CSV
// * receive currency A
// * sell currency A for currency B
// * send currency B to wallet-B1

// Wallet B1 CSV
// * receive currency B from thorchain

export class SwapMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[] = []): CryptoTaxTransaction[] {
        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = toCryptoTaxTimestamp(date);

        const date_plus_10 = new Date(date.getTime() + (10 * 1000));
        const date_plus_20 = new Date(date.getTime() + (20 * 1000));
        const timestamp_plus_10: string = toCryptoTaxTimestamp(date_plus_10);
        const timestamp_plus_20: string = toCryptoTaxTimestamp(date_plus_20);

        const idPrefix: string = date.toISOString();

        const transactions: CryptoTaxTransaction[] = [];

        const numAssetsIn: number = action.in.length;

        if (numAssetsIn !== 1) {
            throw this.error(`Expected numAssetsIn to be 1 but was ${numAssetsIn}`, action);
        }

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const { blockchain: inputBlockchain, currency: inputCurrency } =
            parseMidgardAsset(inputCoin.asset);
        const inputAmount: string = parseMidgardAmount(inputCoin.amount);
        const inputIsSynth: boolean = isSynth(input);

        const memo = action.metadata.swap?.memo;

        const output: Transaction = this.getOutput(action, memo);
        const outputCoin: Coin = output.coins[0];
        const { blockchain: outputBlockchain, currency: outputCurrency } =
            parseMidgardAsset(outputCoin.asset);
        const outputAmount: string = parseMidgardAmount(outputCoin.amount);
        const outputIsSynth: boolean = isSynth(output);

        if (!inputCurrency) {
            console.log('action:', JSON.stringify(action, null, 4));
            console.error('in:', JSON.stringify(input, null, 4));
            throw this.error('No input currency', action);
        }

        if (!inputAmount) {
            console.log('action:', JSON.stringify(action, null, 4));
            console.error('in:', JSON.stringify(input, null, 4));
            throw this.error('No input amount', action);
        }

        console.log(
            `${timestamp} swap ${inputBlockchain}.${inputCurrency} ${
                inputIsSynth ? '*synth*' : ''
            } to ${outputBlockchain}.${outputCurrency} ${
                outputIsSynth ? '*synth*' : ''
            } - ${input.txID ?? output.txID}`
        );

        // If synth (eg. BTC/BTC) but address is not thor, then ignore. Likely a savers withdrawal.
        if (inputIsSynth && !input.address.startsWith('thor1')) {
            console.log('SWAP IGNORED')
            return [];
        }

        if (inputCoin.asset === 'THOR.TOR' || outputCoin.asset === 'THOR.TOR') {
            throw this.error('Invalid swap - THOR.TOR', action);
        }

        const { blockchain: feeBlockchain, currency: feeCurrency } =
            parseMidgardAsset(action.metadata.swap?.networkFees[0].asset ?? '');

        // Wallet A1 - Send asset A to thorchain --------------------------------------------------

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.Send,
            baseCurrency: inputCurrency,
            baseAmount: inputAmount,
            from: input.address,
            to: 'thorchain',
            blockchain: inputBlockchain,
            id: `${idPrefix}.send-to-thorchain`,
            description: `1/5 Swap ${
                inputIsSynth ? 'Synth ' : ''
            }${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency} (send X to thorchain)`,
        });

        // ----------------------------------------------------------------------------------------

        transactions.push({
            walletExchange: 'thorchain',
            timestamp,
            type: CryptoTaxTransactionType.Receive,
            baseCurrency: inputCurrency,
            baseAmount: inputAmount,
            from: input.address,
            to: 'thorchain',
            id: `${idPrefix}.thorchain.receive`,
            description: `2/5 - Swap ${
                inputIsSynth ? 'Synth ' : ''
            }${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency} (receive X on thorchain)`,
        });

        // Seems that only a Sell or Buy is required for CTC to add it as a Trade.
        // If you add both Sell and Buy then it creates duplicates.

        transactions.push({
            walletExchange: 'thorchain',
            timestamp: timestamp_plus_10,
            type: CryptoTaxTransactionType.Sell,
            baseCurrency: inputCurrency,
            baseAmount: inputAmount,
            quoteCurrency: outputCurrency,
            quoteAmount: parseMidgardAmount(outputCoin.amount),
            feeCurrency,
            feeAmount: parseMidgardAmount(
                action.metadata.swap?.networkFees[0].amount ?? ''
            ),
            from: 'thorchain',
            to: 'thorchain',
            id: `${idPrefix}.thorchain.swap`,
            description: `3/5 - Swap ${
                inputIsSynth ? 'Synth ' : ''
            }${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency} (swap X for Y on thorchain)`,
        });

        // transactions.push({
        //     walletExchange: 'thorchain',
        //     timestamp,
        //     type: CryptoTaxTransactionType.Buy,
        //     baseCurrency: outputCurrency,
        //     baseAmount: outputAmount,
        //     quoteCurrency: inputCurrency,
        //     quoteAmount: parseMidgardAmount(inputCoin.amount),
        //     feeCurrency,
        //     feeAmount: parseMidgardAmount(action.metadata.swap?.networkFees[0].amount ?? ''),
        //     from: output.address,
        //     to: input.address,
        //     blockchain: outputBlockchain,
        //     id: `${idPrefix}.buy`,
        //     description: `Swap ${inputCurrency} to ${outputCurrency}`
        // });

        transactions.push({
            walletExchange: 'thorchain',
            timestamp: timestamp_plus_20,
            type: CryptoTaxTransactionType.Send,
            baseCurrency: outputCurrency,
            baseAmount: outputAmount,
            from: 'thorchain',
            to: output.address,
            blockchain: outputBlockchain,
            id: `${idPrefix}.thorchain.send`,
            description: `4/5 - Swap ${
                inputIsSynth ? 'Synth ' : ''
            }${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency} (send Y from thorchain)`,
        });

        // Wallet B1 - Receive asset B from thorchain ---------------------------------------------

        transactions.push({
            walletExchange: output.address,
            timestamp: timestamp_plus_20,
            type: CryptoTaxTransactionType.Receive,
            baseCurrency: outputCurrency,
            baseAmount: outputAmount,
            from: 'thorchain',
            to: output.address,
            blockchain: outputBlockchain,
            id: `${idPrefix}.receive-from-thorchain`,
            description: `5/5 Swap ${
                inputIsSynth ? 'Synth ' : ''
            }${inputCurrency} to ${
                outputIsSynth ? 'Synth ' : ''
            }${outputCurrency} (receive Y from thorchain)`,
        });

        return transactions;
    }

    // Find which output is for the user
    getOutput(action: Action, memo: string | undefined): Transaction {
        if (!memo) {
            throw this.error('No memo', action);
        }

        const destAddress = this.getDestAddress(memo);
        const out = action.out.find(out => out.address.toLowerCase() === destAddress.toLowerCase());

        if (!out) {
            throw this.error('No matching out tx', action);
        }

        return out;
    }

    getDestAddress(memo: string): string {
        return memo.split(':')[SWAP_DESTADDR];
    }

    error(message: string, action: Action) {
        console.log('action:', JSON.stringify(action, null, 4));
        return new Error(`SwapMapper: ${message}`);
    }
}
