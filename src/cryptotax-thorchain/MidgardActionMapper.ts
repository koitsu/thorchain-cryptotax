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
import {BondMapper} from "./BondMapper";
import {UnbondMapper} from "./UnbondMapper";
import {TcyClaimMapper} from "./TcyClaimMapper";
import {TxStatusResponse} from "@xchainjs/xchain-thornode";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import {TcyStakeMapper} from "./TcyStakeMapper";

type ActionMappers = {
    [index in ActionType | string]: Mapper | null | any;
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
    [ActionType.Withdraw]: new WithdrawMapper(),
    'bond': new BondMapper(),
    'unbond': new UnbondMapper(),
    'tcy_claim': new TcyClaimMapper(),
    'tcy_stake': new TcyStakeMapper()
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
        console.error(`${date} ${action.type}: unsupported action`);

        // Write unsupported action to JSON
        const txId = action.in?.[0]?.txID;
        const filePath = `unsupported-actions/${action.type}/${txId ? txId : date}.json`;
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, JSON.stringify(action, null, 4));
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
