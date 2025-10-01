import {describe, expect, test} from "@jest/globals";
import {actionToCryptoTax} from "../src/cryptotax-thorchain/MidgardActionMapper";
import fs from "fs-extra";

describe('MidgardActionMapper', () => {
    test('should include action context in asset parsing errors', () => {
        const action = fs.readJSONSync('test/testdata/Switch_KUJI.json');

        // Make the asset string invalid
        action.in[0].coins[0].asset = 'INVALID';

        expect(() => actionToCryptoTax(action, [], false, 'some/path')).toThrow(
            '[Midgard] Failed to parse asset string: "INVALID". type: switch, txid: 0000000000000000000000000000000000000000000000000000000000000000'
        );
    });
});
