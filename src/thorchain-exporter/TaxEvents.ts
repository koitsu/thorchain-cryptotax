import {TaxEvent} from "./TaxEvent";
import {ViewblockTx} from "../viewblock";
import {BaseMapper, IThorchainMapper} from "./BaseMapper";
import {IWallet} from "./IWallet";
import {CryptoTaxTransaction} from "../cryptotax";
import {SendMapper} from "./SendMapper";
import {Action} from "@xchainjs/xchain-midgard";
import {getActionDate} from "../cryptotax-thorchain/MidgardActionMapper";
import {deepEqual} from "../utils/DeepEqual";

export class TaxEvents {

    events: TaxEvent[] = [];

    addViewblock(tx: ViewblockTx, wallet: IWallet) {
        const mapper = new BaseMapper(tx, wallet.address);
        const event = new TaxEvent(mapper.datetime, 'viewblock', wallet);
        event.input = tx;
        event.convert();

        // TODO: consolidate events? ie. input from both viewblock and midgard
        this.events.push(event);
    }

    addMidgard(action: Action, wallet: IWallet) {

        const event = new TaxEvent(getActionDate(action), 'midgard', wallet);
        event.input = action;
        event.convert();

        this.events.push(event);
    }

    sortDesc() {
        this.events.sort((a, b) => b.datetime.getTime() - a.datetime.getTime());
    }

    getAllCtcTx(): CryptoTaxTransaction[] {
        return this.events.flatMap(event => event.output);
    }

    filterByWallet(wallet: IWallet): TaxEvent[] {
        return this.events.filter(event => event.wallet.address === wallet.address);
    }

    isDuplicate(newEvent: TaxEvent): boolean {
        let isDuplicate = false;

        if (newEvent.source !== 'midgard') {
            return false;
        }

        const action = newEvent.input as Action;

        this.events.forEach((event) => {
            if (event.source === 'midgard' && (event.input as Action).date === action.date) {
                if (deepEqual(action, event.input as Action)) {
                    console.log(
                        'Excluding duplicate action: ' + JSON.stringify(action)
                    );

                    isDuplicate = true;
                }
            }
        });

        return isDuplicate;
    }

    addEvents(newEvents: TaxEvents) {
        const nonDuplicates = newEvents.events.filter(event => !this.isDuplicate(event));
        this.events.push(...nonDuplicates);
    }
}
