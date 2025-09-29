import {describe, expect, test} from "@jest/globals";
import fs from 'fs-extra';
import {SendMapper} from "../src/thorchain-exporter/SendMapper";
import {SwapMapper} from "../src/cryptotax-thorchain/SwapMapper";

function getTestData(filename: string) {
    return fs.readJSONSync(`test/testdata/${filename}.json`);
}

describe('SendMapper', () => {
    let mapper: SendMapper;

    test('Send Synth DOGE', () => {
        const tx = getTestData('Send_SynthDOGE');
        mapper = new SendMapper(tx, 'thor1-user-wallet-11111');
        const ctc = mapper.toCtc();

        expect(ctc).toStrictEqual([
            {
                "baseAmount": "1.23",
                "baseCurrency": "DOGE",
                "blockchain": "THOR",
                "description": "Send Synth DOGE; 0000000000000000000000000000000000000000000000000000000000000000",
                "feeAmount": "0.02",
                "feeCurrency": "RUNE",
                "from": "thor1-user-wallet-11111",
                "id": "2020-12-31T13:00:00.000Z.send",
                "timestamp": "2020-12-31T13:00:00.000Z",
                "to": "thor1-user-wallet-22222",
                "type": "send",
                "walletExchange": "thor1-user-wallet-11111"
            }
        ]);
    });

    test('should error on incorrect asset string', () => {
        let tx = getTestData('Send_SynthDOGE');

        // Set invalid asset string
        tx.input.asset = "DOGEDOGE";

        mapper = new SendMapper(tx, 'thor1-user-wallet-11111');

        expect(() => mapper.toCtc()).toThrow(
            'Failed to parse asset string: "DOGEDOGE"'
        );
    });
});
