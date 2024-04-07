import { Action } from "@xchainjs/xchain-midgard";
import { CryptoTaxTransaction } from "../cryptotax";

export interface Mapper {
    toCryptoTax(action: Action): CryptoTaxTransaction[];
}
