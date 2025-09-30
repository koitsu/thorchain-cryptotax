import fetch from 'node-fetch';
import { range } from '../utils/Range';
import { ViewblockTx } from './ViewblockTx';
import {Cache} from "../cache/Cache";
import { baseToAssetAmountString } from "../utils/Amount";

export const BASE_URL = 'https://api.viewblock.io';
export const ORIGIN = 'https://viewblock.io';

const makeQuery = (params: { [x: string]: string | number | boolean }) => {
    const keys = Object.keys(params).filter((k) => params[k]);

    return `${keys.length ? '?' : ''}${keys
        .map(
            (key) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
            ''
        )
        .join('&')}`;
};

interface PaginatedQueryTxs {
    checksums: any;
    docs: ViewblockTx[];
    limit: number;
    page: string;
    pages: number;
    total: number;
    type: string;
}



export class Viewblock {

    cache: Cache;
    apiKey?: string;

    constructor(cachePath: string = '_cache') {
        this.cache = new Cache(cachePath);
    }

    async query(path: any, { apiKey, query = {}, network, agent = null }: any) {
        const q = makeQuery({ ...query, network });
        const url = `${BASE_URL}${path}${q}`;
        const headers: any = {
            'Content-Type': 'json',
            Origin: ORIGIN,
        };

        if (apiKey) {
            headers['X-APIKEY'] = apiKey;
        }

        return fetch(url, {
            headers,
            agent,
            timeout: 0,
        }).then((response) => response.json());
    }

    async getTxs({
        address,
        page,
        network,
        type,
    }: {
        address: string;
        page: number;
        network: string;
        type?: string;
    }) {
        return this.query(`/thorchain/addresses/${address}/txs`, {
            apiKey: this.apiKey,
            query: { page, type },
            network,
        });
    }

    async getAllTxs({
        address,
        network,
        type,
    }: {
        address: string;
        network: string;
        type?: string;
    }): Promise<ViewblockTx[]> {

        if (this.cache.has(address)) {
            return this.cache.read(address);
        }

        let page: PaginatedQueryTxs = await this.getTxs({
            address,
            network,
            type,
            page: 1,
        });

        const totalPages = page.pages;
        const total = page.total;
        let results = page.docs;

        console.log(`Fetching txs for ${address}`);
        console.log(`Total: ${total}`);

        if (total === 0) {
            console.log(`[WARN] No transactions for ${address}`);
            return [];
        }

        for (const i of range(totalPages - 1, 2)) {
            console.log(`Page ${i} of ${totalPages}`);

            page = await this.getTxs({
                address,
                network,
                type,
                page: i,
            });

            results = results.concat(...page.docs);
        }

        if (total !== results.length) {
            throw new Error(
                `num results is ${results.length} but total should be ${total}`
            );
        }

        this.cache.write(address, results);

        return results;
    }
}
