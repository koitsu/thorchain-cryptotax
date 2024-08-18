import {Mapper} from "./Mapper";
import {Action} from "@xchainjs/xchain-midgard";
import {CryptoTaxTransaction} from "../cryptotax";

// Wallet-A1 CSV
// * [loan-repayment] send currency A to thorchain

// If loan is closed...
// Wallet B1 CSV
// * [collateral-withdrawal] receive currency B from thorchain

export class LoanRepaymentMapper implements Mapper {
    toCryptoTax(action: Action, addReferencePrices: boolean): CryptoTaxTransaction[] {


        return [];
    }
}
