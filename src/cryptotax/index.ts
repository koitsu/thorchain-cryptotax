// https://help.cryptotaxcalculator.io/en/articles/5777675-advanced-manual-csv-import

import { format, utcToZonedTime } from 'date-fns-tz';
import {CryptoTaxTransaction} from "./CryptoTaxTranaction";

export * from './CryptoTaxCsv';
export * from './CryptoTaxTranaction';
export * from './CryptoTaxTransactionType';

function formatInTimeZone(date: Date, fmt: string, tz: string) {
    return format(utcToZonedTime(date, tz), fmt, { timeZone: tz });
}

export function toCryptoTaxTimestamp(date: Date): string {
    return formatInTimeZone(date, 'dd/MM/yyyy HH:mm:ss', 'UTC');
}

export function fromCryptoTaxTimestamp(timestamp: string): Date {
    const [date, time] = timestamp.split(' ');
    const isoDate = date.split('/').reverse().join('-');
    return new Date(`${isoDate}T${time}Z`);
}

export function ctcSortDesc(txs: CryptoTaxTransaction[]): CryptoTaxTransaction[] {
    return txs.sort((a, b) => {
        return (
            (b.timestamp instanceof Date ? b.timestamp : fromCryptoTaxTimestamp(b.timestamp)).getTime() -
            (a.timestamp instanceof Date ? a.timestamp : fromCryptoTaxTimestamp(a.timestamp)).getTime()
        );
    });
}
