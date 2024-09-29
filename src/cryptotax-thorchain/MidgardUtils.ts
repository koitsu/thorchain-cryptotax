import {assetFromStringEx} from "@xchainjs/xchain-util";

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
    const asset = assetFromStringEx(assetStr);

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

export function parseMidgardAmount(amount: string): string {
    return (parseInt(amount) / 100000000).toString();
}
