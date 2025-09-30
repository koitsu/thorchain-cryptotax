import {describe, expect, test} from "@jest/globals";
import {baseToAssetAmountString} from "../src/utils/Amount";

describe('Amount', () => {
    test('baseToAssetAmountString handles small amounts without scientific notation', () => {
        const result = baseToAssetAmountString("1");
        expect(result).toBe("0.00000001");
    });

    test('baseToAssetAmountString handles large amounts without commas', () => {
        const result = baseToAssetAmountString("12345678900000000");
        expect(result).toBe("123456789");
    });

    test('baseToAssetAmountString handles zero amount', () => {
        const result = baseToAssetAmountString("0");
        expect(result).toBe("0");
    });

    test('baseToAssetAmountString handles different decimals', () => {
        const result = baseToAssetAmountString("1000000000000000000", 18);
        expect(result).toBe("1");
    });

    test('baseToAssetAmountString handles amounts with decimal output', () => {
        const result = baseToAssetAmountString("50000000", 8);
        expect(result).toBe("0.5");
    });

    test('baseToAssetAmountString handles very large amounts', () => {
        const result = baseToAssetAmountString("1000000000000000000000", 8);
        expect(result).toBe("10000000000000");
    });

    test('baseToAssetAmountString handles zero decimals', () => {
        const result = baseToAssetAmountString("123", 0);
        expect(result).toBe("123");
    });

    test('baseToAssetAmountString trims trailing zeros', () => {
        const result = baseToAssetAmountString("100000000", 8);
        expect(result).toBe("1");
    });

    // Error-throwing tests
    test('baseToAssetAmountString throws error for empty string', () => {
        expect(() => baseToAssetAmountString("")).toThrow("Invalid base amount: ");
    });

    test('baseToAssetAmountString throws error for non-numeric string', () => {
        expect(() => baseToAssetAmountString("abc")).toThrow("Invalid base amount: abc");
    });

    test('baseToAssetAmountString throws error for string with invalid characters', () => {
        expect(() => baseToAssetAmountString("123abc")).toThrow("Invalid base amount: 123abc");
    });

    test('baseToAssetAmountString handles negative amounts', () => {
        const result = baseToAssetAmountString("-1");
        expect(result).toBe("-0.00000001");
    });
});
