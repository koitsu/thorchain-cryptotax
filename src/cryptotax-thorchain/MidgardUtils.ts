import {assetFromStringEx} from "@xchainjs/xchain-util";
import { baseToAssetAmountString } from '../utils/Amount';

export { baseToAssetAmountString as formatBaseAmount };

export function parseMidgardDate(nanoTimestamp: string): Date {
    return new Date(parseInt(nanoTimestamp) / 1000000);
}

export function toMidgardNanoTimestamp(date: Date): string {
    return (date.getTime() * 1000000).toString();
}

function tickerRename(ticker: string) {
    const renames: {[key: string]: string} = {
        'LUNA': 'LUNC',
        'UST': 'USTC'
    };

    return renames[ticker] ?? ticker;
}

export function parseMidgardAsset(assetStr: string): {
    blockchain: string;
    currency: string;
} {
    let asset;

    try {
        asset = assetFromStringEx(assetStr);
    } catch (e) {
        throw new Error(`Failed to parse asset string: "${assetStr}"`);
    }

    // Update ticker if it has been renamed
    const ticker = tickerRename(asset.ticker);

    return {
        blockchain: asset?.chain,
        currency: ticker
    };
}

export function parseMidgardPool(pool: string): string {
    const { blockchain, currency } = parseMidgardAsset(pool);
    return `${blockchain}.${currency}`;
}
