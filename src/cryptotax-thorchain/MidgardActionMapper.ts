import { Action, ActionTypeEnum as ActionType } from "@xchainjs/xchain-midgard";
import { CryptoTaxTransaction, toCryptoTaxTimestamp } from "../cryptotax";
import { parseMidgardDate } from "./MidgardUtils";
import { AddLiquidityMapper } from "./AddLiquidityMapper";
import { Mapper } from "./Mapper";
import { SwapMapper } from "./SwapMapper";
import { SwitchMapper } from "./SwitchMapper";
import { WithdrawMapper } from "./WithdrawMapper";
import { RefundMapper } from "./RefundMapper";

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

export function getActionDate(action: Action): Date {
    return parseMidgardDate(action.date);
}

export function actionToCryptoTax(action: Action, addReferencePrices: boolean = false): CryptoTaxTransaction[] {
    const date: string = toCryptoTaxTimestamp(getActionDate(action));
    const mapper: Mapper | null = actionMappers[action.type];
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
