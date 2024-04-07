import {ViewblockTx} from "../viewblock";
import {Action} from "@xchainjs/xchain-midgard";
import {CryptoTaxTransaction} from "../cryptotax";
import {IThorchainMapper} from "./BaseMapper";
import {SendMapper} from "./SendMapper";
import {IWallet} from "./IWallet";
import {actionToCryptoTax} from "../cryptotax-thorchain/MidgardActionMapper";

type TaxEventSource = 'viewblock' | 'midgard';

export class TaxEvent {

    datetime: Date;
    source: TaxEventSource;
    input?: ViewblockTx | Action;
    output: CryptoTaxTransaction[] = [];
    wallet: IWallet;

    constructor(datetime: Date, source: TaxEventSource, wallet: IWallet) {
        this.datetime = datetime;
        this.source = source;
        this.wallet = wallet;
    }

    convert() {
        if (this.source === 'viewblock') {
            this.convertViewblock();
        } else if (this.source === 'midgard') {
            this.convertMidgardAction();
        }
    }

    convertViewblock() {
        const tx = this.input as ViewblockTx;

        // const labels = tx.extra.thorLabels;
        const labels = tx.types;

        let mapper: IThorchainMapper | undefined;

        if (labels.includes('send')) {
            mapper = new SendMapper(tx, this.wallet.address);
        }

        if (!mapper) {
            // Commented out warning as I'm currently only getting 'sends' from viewblock.
            // Getting other actions from Midgard

            // warn('####### missing mapper #######');
            // info(labels);
            return [];
        }

        this.output = mapper.toCtc();
    }

    convertMidgardAction() {
        this.output = actionToCryptoTax(this.input as Action);
    }
}
