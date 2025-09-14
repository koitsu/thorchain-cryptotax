import { Action, ActionTypeEnum as ActionType } from "@xchainjs/xchain-midgard";
import { CryptoTaxTransaction } from "../cryptotax";
import { parseMidgardDate } from "./MidgardUtils";
import { AddLiquidityMapper } from "./AddLiquidityMapper";
import { Mapper } from "./Mapper";
import { SwapMapper } from "./SwapMapper";
import { SwitchMapper } from "./SwitchMapper";
import { WithdrawMapper } from "./WithdrawMapper";
import { RefundMapper } from "./RefundMapper";
import {LoanOpenMapper} from "./LoanOpenMapper";
import {LoanRepaymentMapper} from "./LoanRepaymentMapper";
import {TxStatusResponse} from "@xchainjs/xchain-thornode";

type ActionMappers = {
    [index in ActionType]: Mapper | null | any;
}

const actionMappers: ActionMappers = {
    [ActionType.AddLiquidity]: new AddLiquidityMapper(),
    [ActionType.Donate]: null,
    [ActionType.Send]: null,
    [ActionType.Thorname]: null,
    [ActionType.RunePoolDeposit]: null,
    [ActionType.RunePoolWithdraw]: null,
    [ActionType.Refund]: new RefundMapper(),
    [ActionType.Swap]: SwapMapper,
    [ActionType.Switch]: new SwitchMapper(),
    [ActionType.Withdraw]: new WithdrawMapper()
}

const loanOpenMapper = new LoanOpenMapper();
const loanRepaymentMapper = new LoanRepaymentMapper();

export function getActionDate(action: Action): Date {
    return parseMidgardDate(action.date);
}

export function actionToCryptoTax(action: Action, thornodeTxs: TxStatusResponse[], addReferencePrices: boolean = false): CryptoTaxTransaction[] {
    const date: string = getActionDate(action).toISOString();
    let mapper = getMapper(action);

    if (typeof mapper === 'function') {
        mapper = new (mapper as any)(action, addReferencePrices, thornodeTxs);
    }

    const transactions: CryptoTaxTransaction[] = mapper?.toCryptoTax(action, addReferencePrices, thornodeTxs) ?? [];

    if (mapper) {
        console.log(`${date} ${action.type}: ${transactions.length}`);
    } else {
        // TODO: currently using viewblock/runescan for sends, but looks like midgard supports it so could try switching
        // TODO: could also support thorname, runePoolDeposit txs
        if (!['send', 'thorname', 'runePoolDeposit'].includes(action.type as string)) {
            console.log(action);
            console.error(`${date} ${action.type}: no mapper found`);
        }
    }

    return transactions;
}

function getMapper(action: Action): Mapper | null {
    let mapper: Mapper | null = actionMappers[action.type];

    if (action.type === 'swap') {
        const txType = (action.metadata.swap as any)?.txType;

        if (txType === 'loanOpen') {
            mapper = loanOpenMapper;
        } else if (txType === 'loanRepayment') {
            mapper = loanRepaymentMapper;
        } else if (txType === 'noOp' && action.in[0].coins[0].asset === 'THOR.TOR') {
            // Some loan open shows as a noOp swap from midgard
            // With the swap output being the loan
            mapper = loanOpenMapper;
        }
    }

    return mapper;
}
