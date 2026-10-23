import {http} from "../http.ts";
import {RecordStore} from "../store/RecordStore.ts";
import {VIEWBLOCK_LIST, VIEWBLOCK_TX_RULES} from "../store/Sources.ts";
import type {ViewblockInbound, ViewblockTx} from "./ViewblockTx.ts";

// Viewblock's THORChain API, used for sends Midgard does not list, from before 2022-04 (docs/specs/sends.md),
// and for the gas of an inbound THORNode has pruned (docs/specs/fees.md). It is unofficial: it answers requests that carry viewblock.io as their Origin, as
// its web pages do, and may change without notice.
const BASE_URL = 'https://api.viewblock.io/thorchain';
const HEADERS = {Origin: 'https://viewblock.io'};

interface Page {
    docs: ViewblockTx[];
    pages: number;
    total: number;
}

export class Viewblock {
    private store: RecordStore;
    constructor(store: RecordStore) {
        this.store = store;
    }

    // Every tx of the address, through the store
    async getTxs(address: string): Promise<ViewblockTx[]> {
        const url = `${BASE_URL}/addresses/${address}/txs?network=mainnet`;
        return this.store.list('viewblock', address, async () => ({data: await this.fetchTxs(url), url}), VIEWBLOCK_LIST);
    }

    // The gas THORNode observed for one inbound, through the store; undefined when replaying a run made before
    // this source was read. date: of the action the tx belongs to
    async getInbound(hash: string, date?: Date): Promise<ViewblockInbound | undefined> {
        if (this.store.addedSinceReplay('viewblock-tx')) {
            return undefined;
        }

        const url = `${BASE_URL}/txs/${hash}?network=mainnet`;
        return this.store.record('viewblock-tx', hash, async () => ({data: await this.fetchInbound(url, hash), url}), VIEWBLOCK_TX_RULES, date);
    }

    private async fetchInbound(url: string, hash: string): Promise<ViewblockInbound> {
        const response = await http.get(url, {headers: HEADERS, validateStatus: status => status === 200 || status === 404});

        if (response.status === 404) {
            return {hash, found: false, gas: []};
        }

        const gas = (response.data?.observation?.gas ?? []).map(({asset, amount}: any) => ({asset, amount}));
        return {hash, found: true, gas};
    }

    private async fetchTxs(url: string): Promise<ViewblockTx[]> {
        const first = await this.page(url, 1);
        const txs = [...first.docs];

        for (let page = 2; page <= first.pages; page++) {
            txs.push(...(await this.page(url, page)).docs);
        }

        if (txs.length !== first.total) {
            throw new Error(`Viewblock listed ${txs.length} txs but reports ${first.total}: ${url}`);
        }

        return txs;
    }

    private async page(url: string, page: number): Promise<Page> {
        return (await http.get<Page>(`${url}&page=${page}`, {headers: HEADERS})).data;
    }
}
