
export const TypeMsgSend = '/types.MsgSend';

export interface ViewblockTxV2 {
    blockIndex: number;
    code: number;
    gas_used: string;     // e8 number
    height: number
    input: {
        chain: string;    // "THOR"
        asset: string;    // "THOR.RUNE"
        amount: string;   // e8 number
        type: any;
    };
    memo?: string;
    msgs: ViewblockMsg[];
    signer: string;
    status: string;       // "success"
    timestamp: number;
    types: string[];      // "network", "send", "main"
    hash: string;
    gas: {
        amount: string;   // e8 number
        asset: string;    // "THOR.RUNE"
    }
}

export interface ViewblockMsg {
    "@type": string;      // "/types.MsgSend"
    from_address: string;
    to_address: string;
    amount: {
        denom: string;    // "rune"
        amount: string;
    }[];
}
