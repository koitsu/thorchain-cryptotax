import {Mapper} from "./Mapper";
import {Action, Coin, Transaction} from "@xchainjs/xchain-midgard";
import {CryptoTaxTransaction, CryptoTaxTransactionType, toCryptoTaxTimestamp} from "../cryptotax";
import {parseMidgardAmount, parseMidgardAsset, parseMidgardDate} from "./MidgardUtils";
import {isEmpty} from "lodash";

// https://dev.thorchain.org/concepts/memos.html#open-loan
const LOANOPEN_DESTADDR = 2;
const AFFILIATE = 4;

// Wallet-A1 CSV
// * [collateral-deposit] send currency A to thorchain

// Wallet B1 CSV
// * [loan] receive currency B from thorchain

export class LoanOpenMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean): CryptoTaxTransaction[] {

        const numAssetsIn: number = action.in.length;

        if (numAssetsIn !== 1) {
            throw this.error(`numAssetsIn must be 1 but was ${numAssetsIn}`, action);
        }

        const date: Date = parseMidgardDate(action.date);
        const timestamp: string = toCryptoTaxTimestamp(date);

        const idPrefix: string = date.toISOString();

        const transactions: CryptoTaxTransaction[] = [];

        const input: Transaction = action.in[0];
        const inputCoin: Coin = input.coins[0];
        const {blockchain: inputBlockchain, currency: inputCurrency} =
            parseMidgardAsset(inputCoin.asset);
        const inputAmount: string = parseMidgardAmount(inputCoin.amount);
        const txId = input.txID;

        const output = this.getOutput(action);
        const outputCoin: Coin = output.coins[0];
        const {blockchain: outputBlockchain, currency: outputCurrency} =
            parseMidgardAsset(outputCoin.asset);
        const outputAmount: string = parseMidgardAmount(outputCoin.amount);

        if (!inputCurrency) {
            throw this.error('No input currency', action);
        }

        if (!inputAmount) {
            throw this.error('No input amount', action);
        }

        // TODO: could probably add liquidity/affiliate/network fees together and put it all on the 'loan' tx, as the
        // 'collateral' tx won't be imported anyway since it will come from the BTC/ETH wallet

        const liquidityFee = {
            feeCurrency: 'RUNE',
            feeAmount: parseMidgardAmount(action.metadata.swap?.liquidityFee ?? '')
        };
        const affiliateFee = this.getAffiliateFee(action);

        // TODO: if there is an affiliate there will be 2 outs, and 2 network fees
        const networkFee = this.getNetworkFee(action);

        // Wallet A1 - [collateral-deposit] send currency A to thorchain -----------------------------------------------

        transactions.push({
            walletExchange: input.address,
            timestamp,
            type: CryptoTaxTransactionType.CollateralDeposit,
            baseCurrency: inputCurrency,
            baseAmount: inputAmount,
            ...liquidityFee,
            from: input.address,
            to: 'thorchain',
            blockchain: inputBlockchain,
            id: `${idPrefix}.collateral-deposit`,
            description: `1/2 LoanOpen deposit ${inputCurrency} to borrow ${outputCurrency}; ${txId}`,
        });

        // Wallet B1 - [loan] receive currency B from thorchain --------------------------------------------------------

        transactions.push({
            walletExchange: output.address,
            timestamp,
            type: CryptoTaxTransactionType.Loan,
            baseCurrency: outputCurrency,
            baseAmount: outputAmount,
            // Just taking affiliateFee if it's there instead of adding them together in case they are different assets
            ...(!isEmpty(affiliateFee) ? affiliateFee : networkFee),
            from: 'thorchain',
            to: output.address,
            blockchain: outputBlockchain,
            id: `${idPrefix}.loan`,
            description: `2/2 LoanOpen deposit ${inputCurrency} to borrow ${outputCurrency}; ${txId}`,
        });

        return transactions;
    }

    // Find which output is for the user
    getOutput(action: Action): Transaction {
        const memo = action.metadata.swap?.memo;

        if (!memo) {
            throw this.error('No memo', action);
        }

        const destAddress = this.getDestAddress(memo);
        const out = action.out.find(out => out.address == destAddress);

        if (!out) {
            throw this.error('No matching out tx', action);
        }

        return out;
    }

    getDestAddress(memo: string): string {
        return memo.split(':')[LOANOPEN_DESTADDR];
    }

    getAffiliateAddress(memo: string): string {
        return memo.split(':')[AFFILIATE];
    }

    getNetworkFee(action: Action) {
        const {currency: feeCurrency} =
            parseMidgardAsset(action.metadata.swap?.networkFees[0].asset ?? '');

        const feeAmount= parseMidgardAmount(action.metadata.swap?.networkFees[0].amount ?? '');

        return {
            feeCurrency,
            feeAmount
        };
    }

    getAffiliateFee(action: Action) {
        const memo = action.metadata.swap?.memo;

        if (!memo) {
            throw this.error('No memo', action);
        }

        const affiliateAddress = this.getAffiliateAddress(memo);
        const out = action.out.find(out => out.address == affiliateAddress);

        if (!out) {
            return {};
        }

        const {currency: feeCurrency} = parseMidgardAsset(out.coins[0].asset)
        const feeAmount = parseMidgardAmount(out.coins[0].amount)

        return {
            feeCurrency,
            feeAmount
        };
    }

    error(message: string, action: Action) {
        console.log('action:', JSON.stringify(action, null, 4));
        return new Error(`LoanOpenMapper: ${message}`);
    }
}
