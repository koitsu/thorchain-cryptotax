import { Action } from "@xchainjs/xchain-midgard";
import { CryptoTaxTransaction } from "../cryptotax";
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

export interface Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean, thornodeTxs: TxStatusResponse[]): CryptoTaxTransaction[];
}
