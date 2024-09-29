// https://help.cryptotaxcalculator.io/en/articles/5777675-advanced-manual-csv-import

import {CryptoTaxTransaction} from "./CryptoTaxTranaction";

export * from './CryptoTaxCsv';
export * from './CryptoTaxTranaction';
export * from './CryptoTaxTransactionType';

export function ctcSortDesc(txs: CryptoTaxTransaction[]): CryptoTaxTransaction[] {
    return txs.sort((a, b) => {
        return (
            (b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp)).getTime() -
            (a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp)).getTime()
        );
    });
}
