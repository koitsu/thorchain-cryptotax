import {THORNODE_API_9R_URL, Configuration, TransactionsApi, TxStatusResponse} from "@xchainjs/xchain-thornode";
import {register9Rheader} from "@xchainjs/xchain-util"
import axios from "axios";
import axiosThrottle from 'axios-request-throttle';
import {Cache} from "../cache/Cache";
import path from "path";

axiosThrottle.use(axios, { requestsPerSecond: 1 });

register9Rheader(axios);

export class ThornodeService {
    cache: Cache;
    api: TransactionsApi;

    constructor() {
        this.cache = new Cache(path.resolve(__dirname, '_cache', 'tx'));
        const apiConfig = new Configuration({basePath: THORNODE_API_9R_URL});
        this.api = new TransactionsApi(apiConfig);
    }

    async getTxStatus(hash: string) {
        if (!hash) {
            throw new Error('No transaction hash');
        }

        if (this.cache.has(hash)) {
            return this.cache.read(hash);
        }

        const response = await this.api.txStatus(hash);
        const tx: TxStatusResponse = response.data;

        this.cache.write(hash, tx);

        return tx;
    }
}

async function test() {
    const hash = '';
    const thornode = new ThornodeService();
    // thornode.cache.clear(hash);
    const tx = await thornode.getTxStatus(hash);
    console.log(tx);
}

if (require.main === module) {
    console.log('Test: ' + __filename);
    test();
}
