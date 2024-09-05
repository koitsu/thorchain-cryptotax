import {IWallet} from "./IWallet";

export interface ITaxConfig {
    fromDate: string;
    toDate: string;
    frequency: 'monthly' | 'yearly' | 'none',
    cacheDataSources: boolean;
    wallets: IWallet[];
}
