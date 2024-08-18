import fs from 'fs-extra';
import { CryptoTaxTransaction } from './CryptoTaxTranaction';
import {ctcSortDesc} from "./index";

export const csvMapping = [
    { header: 'Timestamp (UTC)', field: 'timestamp' },
    { header: 'Type', field: 'type' },
    { header: 'Base Currency', field: 'baseCurrency' },
    { header: 'Base Amount', field: 'baseAmount' },
    { header: 'Quote Currency (Optional)', field: 'quoteCurrency' },
    { header: 'Quote Amount (Optional)', field: 'quoteAmount' },
    { header: 'Fee Currency (Optional)', field: 'feeCurrency' },
    { header: 'Fee Amount (Optional)', field: 'feeAmount' },
    { header: 'From (Optional)', field: 'from' },
    { header: 'To (Optional)', field: 'to' },
    { header: 'Blockchain (Optional)', field: 'blockchain' },
    { header: 'ID (Optional)', field: 'id' },
    { header: 'Description (Optional)', field: 'description' },
    { header: 'Reference Price Per Unit (Optional)', field: 'referencePricePerUnit' },
    { header: 'Reference Price Currency (Optional)', field: 'referencePriceCurrency' },
];

function createHeader(): string {
    return csvMapping.map((item) => item.header).join(',') + '\n';
}

export function txToCsv(tx: CryptoTaxTransaction): string {
    return csvMapping
        .map((column) => replaceNewline((tx as any)[column.field] ?? ''))
        .join(',');
}

function replaceNewline(value: string): string {
    return value.replaceAll('\n', '; ');
}

function toCsv(txs: CryptoTaxTransaction[]): string {
    return createHeader() + txs.map(txToCsv).join('\n');
}

export function writeCsv(
    filename: string,
    txs: CryptoTaxTransaction[]
) {
    if (txs.length === 0) {
        return;
    }

    const filenameOnly = filename.split('/').pop() ?? filename;

    // Using ... to copy txs
    txs = ctcSortDesc([...txs]);
    updateIds(txs, filenameOnly);

    console.log(`Write CSV: ${filename}`);
    const output: string = toCsv(txs);
    fs.outputFileSync(filename, output);
}

function updateIds(txs: CryptoTaxTransaction[], prefix: string) {
    let id = txs.length;

    for (let i = 0; i < txs.length; i++) {
        txs[i].id = prefix + ':' + id;
        id--;
    }
}
