import {IWallet} from "./IWallet";

export interface ITaxConfig {
    cacheDataSources: boolean;
    wallets: IWallet[];
}
