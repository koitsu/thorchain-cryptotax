import {Cache} from "../cache/Cache";
import {register9Rheader} from '@xchainjs/xchain-util';
import axios from "axios";
import axiosThrottle from 'axios-request-throttle';

const MIDGARD_API_9R_V2_URL = 'https://midgard.ninerealms.com/v2';

axiosThrottle.use(axios, { requestsPerSecond: 1 });

register9Rheader(axios);

// Interface for TCY distribution item
export interface TcyDistributionItem {
    /**
     * Int64(e8), amount of RUNE distributed to the TCY holder.
     */
    amount: string;
    /**
     * Int64(e8), RUNE price at the time of distribution.
     */
    price: string;
    /**
     * Int64, Unix timestamp for the TCY distribution.
     */
    date: string;
}

// Interface for TCY distribution response
export interface TcyDistribution {
    /**
     * Float, annual percentage rate of the TCY distribution.
     */
    apr: string;
    /**
     * Int64(e8), total amount of RUNE distributed to the TCY holder.
     */
    total: string;
    /**
     * TCY holder address.
     */
    address: string;
    /**
     * List details of all the TCY distributions.
     */
    distributions: TcyDistributionItem[];
}

export class TcyDistributionService {
    cache: Cache;
    baseUrl: string;

    constructor(cachePath: string = '_cache') {
        this.cache = new Cache(cachePath);
        this.baseUrl = MIDGARD_API_9R_V2_URL;
    }

    async getTcyDistribution(address: string): Promise<TcyDistribution> {
        const cacheKey = `tcy_distribution_${address}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.read(cacheKey);
        }

        const url = `${this.baseUrl}/tcy/distribution/${address}`;
        const response = await axios.get(url);
        const data: TcyDistribution = response.data;

        this.cache.write(cacheKey, data);

        return data;
    }
}

async function test() {
    const address = ''; // Example address
    const service = new TcyDistributionService();
    // service.cache.clear(`tcy_distribution_${address}`);
    const distribution = await service.getTcyDistribution(address);
    console.log(distribution);
}

if (require.main === module) {
    console.log('Test: ' + __filename);
    test();
}
