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
});
