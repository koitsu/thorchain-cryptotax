import { format } from 'date-fns';

export function parseMidgardDate(nanoTimestamp: string): Date {
    return new Date(parseInt(nanoTimestamp) / 1000000);
}

export function toMidgardNanoTimestamp(date: Date): string {
    return (date.getTime() * 1000000).toString();
}

// Simplify currency ticker to be recognised by CryptoTaxCalculator
export function toCryptoTaxCurrencyTicker(currency: string): string {
    if (currency === 'THOR-0XA5F2211B9B8170F694421F2046281775E8468044') {
        // THORSwap token (ETH.THOR)
        return 'THOR';
    } else if (currency === 'LUNA') {
        // Covert LUNA ticker to new LUNC ticker
        // TODO: does this need to be aware of the date of transaction?
        return 'LUNC';
    } else if (currency === 'BUSD-BD1') {
        // Binance BUSD (BNB.BUSD)
        return 'BUSD';
    } else if (currency === 'ETH-1C9') {
        // Binance ETH (BNB.ETH)
        return 'ETH';
    } else if (currency === 'RUNE-B1A') {
        // Binance RUNE (BNB.RUNE)
        return 'RUNE';
    } else if (currency === 'USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E') {
        // Avalanche USDC (AVAX.USDC)
        return 'USDC';
    }

    if (
        currency.includes('-') ||
        currency.includes('.') ||
        currency.includes('/')
    ) {
        throw new Error(`currency should not contain - . / "${currency}"`);
    }

    return currency;
}

export function parseMidgardAsset(asset: string): {
    blockchain: string;
    currency: string;
} {
    const elements: string[] = asset.includes('.')
        ? asset.split('.')
        : asset.split('/');

    if (elements.length !== 2) {
        throw new Error(
            `Unable to determine blockchain and currency from "${asset}"`
        );
    }

    const blockchain: string = elements[0];
    const currency: string = toCryptoTaxCurrencyTicker(elements[1]);

    return {
        blockchain,
        currency,
    };
}

export function parseMidgardPool(pool: string): string {
    const { blockchain, currency } = parseMidgardAsset(pool);
    return `${blockchain}.${currency}`;
}

export function parseMidgardAmount(amount: string): string {
    return (parseInt(amount) / 100000000).toString();
}

export function isThorchainVault(address: string): boolean {
    const vaults = ['bc1qvk5jr06g4kadhep03lpz70kp5ya0j0rjddefcg'];

    return vaults.includes(address.toLowerCase());
}
