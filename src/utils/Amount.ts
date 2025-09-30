import { baseAmount, baseToAsset, trimZeros } from "@xchainjs/xchain-util";

/**
 * Converts a base amount (e.g., from Thorchain API) to a human-readable asset amount string
 * with the specified number of decimals, trimming trailing zeros.
 *
 * @param amount - The base amount as a string (e.g., "1" for 1 base unit)
 * @param decimals - Number of decimals for the asset (default 8 for RUNE)
 * @returns The formatted asset amount string
 */
export function baseToAssetAmountString(amount: string, decimals: number = 8): string {
    const base = baseAmount(amount, decimals);
    const asset = baseToAsset(base);
    return trimZeros(asset.amount().toFixed(asset.decimal));
}
