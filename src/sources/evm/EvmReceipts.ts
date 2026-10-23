import {RecordStore} from "../store/RecordStore.ts";
import {EVM_RECEIPT_RULES} from "../store/Sources.ts";
import {EVM_RPC_URLS} from "../../config/apiUrls.ts";
import {http} from "../http.ts";

// The EVM chains THORChain takes inbounds on, and the coin each pays gas in
export const EVM_GAS_ASSETS: Record<string, string> = {
    ETH: 'ETH.ETH',
    AVAX: 'AVAX.AVAX',
    BSC: 'BSC.BNB',
    BASE: 'BASE.ETH',
};

// An EVM tx's receipt (eth_getTransactionReceipt), trimmed to what its fee is made of. Quantities are the
// RPC's hex strings, in wei.
export interface EvmReceipt {
    chain: string;
    transactionHash: string;
    blockNumber: string;
    status: string;
    gasUsed: string;
    effectiveGasPrice: string;
    // The L1 data fee of an OP-stack chain (BASE)
    l1Fee?: string;
}

// What the wallet paid to send the tx, in wei (docs/specs/fees.md)
export function receiptFee(receipt: EvmReceipt): bigint {
    return BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice) + BigInt(receipt.l1Fee ?? 0);
}

export function isEvmChain(chain: string): boolean {
    return chain in EVM_GAS_ASSETS;
}

export class EvmReceipts {
    private store: RecordStore;
    private urls: Record<string, string>;
    constructor(store: RecordStore, urls: Record<string, string> = EVM_RPC_URLS) {
        this.store = store;
        this.urls = urls;
    }

    // txId: as Midgard gives it (upper case, no 0x). Undefined only when replaying a run made before this source
    // was read. date: of the action the tx belongs to
    async getReceipt(chain: string, txId: string, date?: Date): Promise<EvmReceipt | undefined> {
        if (this.store.addedSinceReplay('evm-receipt')) {
            return undefined;
        }

        const url = this.urls[chain];

        if (!url) {
            throw new Error(`No RPC endpoint for ${chain}`);
        }

        const hash = `0x${txId.replace(/^0x/i, '').toLowerCase()}`;
        return this.store.record('evm-receipt', `${chain}.${hash}`, async () => ({data: await this.fetchReceipt(chain, url, hash), url}),
            EVM_RECEIPT_RULES, date);
    }

    private async fetchReceipt(chain: string, url: string, hash: string): Promise<EvmReceipt> {
        const response = await http.post(url, {jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [hash]});
        const {result, error} = response.data ?? {};

        if (error) {
            throw new Error(`${chain} receipt ${hash}: ${error.message ?? JSON.stringify(error)}`);
        }

        // A pruning node answers null, as it does for a tx it never saw: never stored, so a later run asks again
        if (!result) {
            throw new Error(`${chain} receipt ${hash}: not returned by ${url} (set ${chain}_RPC_URL to an endpoint that keeps old receipts)`);
        }

        const {effectiveGasPrice} = result;

        // Every receipt has it since London (2021), old txs included; an endpoint that leaves it out can't be used
        if (!result.gasUsed || !effectiveGasPrice) {
            throw new Error(`${chain} receipt ${hash}: no gasUsed or effectiveGasPrice`);
        }

        // An OP-stack operator fee (Isthmus) is charged on top; its formula has changed between upgrades, and Base
        // charges none (2026-10): a receipt with one stops the run rather than leave that fee out
        if (BigInt(result.operatorFeeScalar ?? 0) > 0n || BigInt(result.operatorFeeConstant ?? 0) > 0n) {
            throw new Error(`${chain} receipt ${hash}: has an operator fee, which receiptFee does not add yet`);
        }

        return {
            chain,
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
            status: result.status,
            gasUsed: result.gasUsed,
            effectiveGasPrice,
            ...(result.l1Fee ? {l1Fee: result.l1Fee} : {}),
        };
    }
}
