import { Action, ActionTypeEnum as ActionType } from "@xchainjs/xchain-midgard";
import { CryptoTaxTransaction, toCryptoTaxTimestamp } from "../cryptotax";
import { parseMidgardDate } from "./MidgardUtils";
import { AddLiquidityMapper } from "./AddLiquidityMapper";
import { Mapper } from "./Mapper";
import { SwapMapper } from "./SwapMapper";
import { SwitchMapper } from "./SwitchMapper";
import { WithdrawMapper } from "./WithdrawMapper";
import { RefundMapper } from "./RefundMapper";
import {LoanOpenMapper} from "./LoanOpenMapper";
import {LoanRepaymentMapper} from "./LoanRepaymentMapper";

type ActionMappers = {
    [index in ActionType]: Mapper | null;
}

const actionMappers: ActionMappers = {
    [ActionType.AddLiquidity]: new AddLiquidityMapper(),
    [ActionType.Donate]: null,
    [ActionType.Refund]: new RefundMapper(),
    [ActionType.Swap]: new SwapMapper(),
    [ActionType.Switch]: new SwitchMapper(),
    [ActionType.Withdraw]: new WithdrawMapper()
}

const loanOpenMapper = new LoanOpenMapper();
const loanRepaymentMapper = new LoanRepaymentMapper();

export function getActionDate(action: Action): Date {
    return parseMidgardDate(action.date);
}

export function actionToCryptoTax(action: Action, addReferencePrices: boolean = false): CryptoTaxTransaction[] {
    const date: string = toCryptoTaxTimestamp(getActionDate(action));
    const mapper = getMapper(action);

    const transactions: CryptoTaxTransaction[] = mapper?.toCryptoTax(action, addReferencePrices) ?? [];

    if (mapper) {
        console.log(`${date} ${action.type}: ${transactions.length}`);
    } else {
        console.error(`${date} ${action.type}: no mapper found`);
    }

    return transactions;
}

export function actionsToCryptoTax(actions: Action[]): CryptoTaxTransaction[] {
    return actions.map(action => actionToCryptoTax(action)).flat();
}

function getMapper(action: Action): Mapper | null {
    let mapper: Mapper | null = actionMappers[action.type];

    if (action.type === 'swap') {
        const txType = (action.metadata.swap as any)?.txType;

        if (txType === 'loanOpen') {
            mapper = loanOpenMapper;
        } else if (txType === 'loanRepayment') {
            mapper = loanRepaymentMapper;
        }
    }

    return mapper;
}
