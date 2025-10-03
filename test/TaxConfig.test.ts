import {describe, expect, test} from "@jest/globals";
import {TaxConfig} from "../src/thorchain-exporter/TaxConfig";

describe('TaxConfig', () => {
    test('applyDefaults with empty config', () => {
        const result = TaxConfig.applyDefaults({});

        expect(result).toEqual({
            outputPath: 'output',
            unsupportedActionsPath: 'unsupported-actions',
            cachePath: 'cache',
            toDate: new Date().toISOString().substring(0, 10)
        });
    });

    test('applyDefaults with populated config', () => {
        const config = {
            fromDate: '2020-01-01',
            toDate: '2020-12-31',
            frequency: 'monthly' as const,
            cacheDataSources: true,
            outputPath: 'custom-output',
            unsupportedActionsPath: 'custom-unsupported-actions',
            cachePath: 'custom-cache',
            wallets: []
        };

        const result = TaxConfig.applyDefaults(config);

        expect(result).toEqual({
            fromDate: '2020-01-01',
            toDate: '2020-12-31',
            frequency: 'monthly',
            cacheDataSources: true,
            outputPath: 'custom-output',
            unsupportedActionsPath: 'custom-unsupported-actions',
            cachePath: 'custom-cache',
            wallets: []
        });
    });
});
