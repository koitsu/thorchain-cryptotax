import {BaseMapper} from "./BaseMapper";
import {resolveAmount, ViewblockCoin, ViewblockEvent, ViewblockEventSend, ViewblockTx} from "../viewblock";
import {CryptoTaxTransaction, CryptoTaxTransactionType, txToCsv} from "../cryptotax";
import assert from "assert";

export class SendMapper extends BaseMapper {
    constructor(tx: ViewblockTx, wallet: string) {
        super(tx, wallet);
    }

    toCtc() {
        const ctcTx: CryptoTaxTransaction = {} as any;

        // Set the current wallet. Used for exporting into related CSV
        ctcTx.walletExchange = this.wallet;

        const event: ViewblockEvent = this.getEvent('send') as ViewblockEventSend;
        const from = event.params.fromAddress;
        const to = event.params.toAddress;

        if (from === this.wallet) {
            ctcTx.type = CryptoTaxTransactionType.Send;
        } else if (to === this.wallet) {
            ctcTx.type = CryptoTaxTransactionType.Receive;
        } else {
            assert.fail('failed to determine send or receive');
        }

        ctcTx.timestamp = this.timestamp;

        assert.equal(1, event.params.coins.length);

        const coin: ViewblockCoin = event.params.coins[0];

        // Amount
        ctcTx.baseAmount = resolveAmount(coin.amount);

        assert.ok(coin.asset.includes('THOR.'));

        ctcTx.baseCurrency = coin.asset.replace(
            'THOR.',
            ''
        );

        // Fee
        // Only apply the fee on send (not on receive)
        if (ctcTx.type === CryptoTaxTransactionType.Send) {
            ctcTx.feeCurrency = 'RUNE';
            ctcTx.feeAmount = resolveAmount(event.fee.amount[0].amount);
        }

        ctcTx.from = from;
        ctcTx.to = to;
        ctcTx.blockchain = 'THOR'; // Sends/receives will only be for thorchain
        ctcTx.id = this.getId(ctcTx.type);
        ctcTx.description = ``;

        console.log(txToCsv(ctcTx));

        return [ctcTx];
    }
}
