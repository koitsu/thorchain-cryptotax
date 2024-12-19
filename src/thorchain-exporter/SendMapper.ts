import {AnyAsset, assetFromStringEx, AssetType} from "@xchainjs/xchain-util";
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

        let isSend = false;

        if (from === this.wallet) {
            ctcTx.type = CryptoTaxTransactionType.Send;
            isSend = true;
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

        const asset: AnyAsset = assetFromStringEx(coin.asset);

        const isSynth = asset.type === AssetType.SYNTH;
        const isTrade = asset.type === AssetType.TRADE;

        // Asset samples
        // THOR.RUNE
        // DOGE/DOGE (synth DOGE)

        ctcTx.baseCurrency = asset.ticker;

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
        ctcTx.description = `${isSend ? 'Send' : 'Receive'} ${isSynth ? 'Synth ' : ''}${isTrade ? 'Trade ' : ''}${asset.ticker}; ${this.tx.hash}`;

        console.log(txToCsv(ctcTx));

        return [ctcTx];
    }
}
