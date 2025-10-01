import {IWallet} from "./IWallet";

export interface ITaxConfig {
    fromDate: string;
    toDate: string;
    frequency: 'monthly' | 'yearly' | 'none',
    cacheDataSources: boolean;
    outputPath: string;
    unsupportedActionsPath: string;
    cachePath: string;
    wallets: IWallet[];
}
