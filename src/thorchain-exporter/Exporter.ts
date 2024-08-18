import {Viewblock} from "../viewblock";
import fs from "fs-extra";
import {CryptoTaxTransaction, CryptoTaxTransactionType, writeCsv} from "../cryptotax";
import {MidgardService} from "../cryptotax-thorchain/MidgardService";
import {Action, ActionStatusEnum} from "@xchainjs/xchain-midgard";
import {ITaxConfig} from "./ITaxConfig";
import {Reporter} from "./Reporter";
import {IWallet} from "./IWallet";
import {TaxEvents} from "./TaxEvents";

const info = console.info;

export class Exporter {
    config: ITaxConfig;
    viewblock: Viewblock;
    midgard: MidgardService;
    report: Reporter;

    constructor(filename: string) {
        this.config = this.loadConfig(filename);
        this.viewblock = new Viewblock();
        this.midgard = new MidgardService();
        this.report = new Reporter();
    }

    loadConfig(filename: string): ITaxConfig {
        info(`Load config: ${filename}`);
        return JSON.parse(fs.readFileSync(filename).toString());
    }

    async getEvents(wallet: IWallet): Promise<TaxEvents> {
        const events = new TaxEvents();

        const txs = await this.viewblock.getAllTxs({
            address: wallet.address,
            network: 'mainnet'
            // type: 'all',
        });

        for (const tx of txs) {
            events.addViewblock(tx, wallet);
        }

        // Get Midgard actions
        let actions: Action[] = await this.midgard.getActions(wallet.address);

        actions = this.excludeNonSuccess(actions);

        for (const action of actions) {
            events.addMidgard(action, wallet);
        }

        return events;
    }

    excludeNonSuccess(actions: Action[]): Action[] {
        // loan repayments will show as 'pending' if the loan is not closed
        return actions.filter(
            (action: Action) => {
                return action.status === ActionStatusEnum.Success || (action.metadata.swap as any)?.txType === 'loanRepayment'
            }
        );
    }

    saveToCsv(txs: CryptoTaxTransaction[], outputPath: string) {

        const walletExchanges = this.getAllWalletExchanges(txs);

        const allYearsFromTxs = txs.map((tx) => {
            return (tx.timestamp as string).split(' ')[0].split('/')[2];
        });

        const years = [...new Set(allYearsFromTxs)].sort();
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

        for (const year of years) {
            for (const month of months) {
                const monthTxs = this.getTxsForMonth(txs, year, month);

                if (monthTxs.length === 0) {
                    continue;
                }

                console.log(`${year}-${month}`);
                console.log(monthTxs.length);

                for (const walletExchange of walletExchanges) {
                    const walletTxs = this.getTxsForWallet(monthTxs, walletExchange);

                    if (walletTxs.length) {
                        console.log(`${year}-${month}`);
                        console.log(walletTxs.length);

                        if (walletExchange === 'thorchain') {
                            // validate txs
                            const badTxs = walletTxs.filter(tx => tx.from !== 'thorchain' && tx.to !== 'thorchain');
                            if (badTxs.length > 0) {
                                console.error(badTxs);
                                throw new Error('bad txs');
                            }

                            writeCsv(
                                `${outputPath}/${year}-${month}_Thorchain_swaps.ctc.csv`,
                                walletTxs
                            );
                        } else {
                            const sends = this.getSends(walletTxs);
                            const notSends = this.getNotSends(walletTxs);

                            if (sends.length + notSends.length !== walletTxs.length) {
                                throw new Error('what!');
                            }

                            writeCsv(
                                `${outputPath}/${this.makeFilename(walletExchange, year, month)}_sends.ctc.csv`,
                                sends
                            );

                            writeCsv(
                                `${outputPath}/${this.makeFilename(walletExchange, year, month)}_actions.ctc.csv`,
                                notSends
                            );
                        }
                    }
                }
            }
        }

        // if (walletExchange === 'thorchain') {
        //     writeCsv(
        //         `${outputPath}/thorchain_swaps.ctc.csv`,
        //         txs.filter((tx) => tx.walletExchange === walletExchange)
        //     );
        // } else {
        //     writeCsv(
        //         `${outputPath}/${this.makeFilename(walletExchange)}_sends.ctc.csv`,
        //         this.getSends(txs).filter((tx) => tx.walletExchange === walletExchange)
        //     );
        //
        //     writeCsv(
        //         `${outputPath}/${this.makeFilename(walletExchange)}_actions.ctc.csv`,
        //         this.getNotSends(txs).filter((tx) => tx.walletExchange === walletExchange)
        //     );
        // }
    }

    private getTxsForWallet(monthTxs: CryptoTaxTransaction[], walletExchange: string) {
        return monthTxs.filter(tx => tx.walletExchange === walletExchange);
    }

    private getTxsForMonth(txs: CryptoTaxTransaction[], year: string, month: string) {
        return txs.filter((tx) => {
            const dateParts = (tx.timestamp as string).split(' ')[0].split('/').reverse();
            return dateParts[0] === year && dateParts[1] === month;
        });
    }

    private getAllWalletExchanges(txs: CryptoTaxTransaction[]): string[] {
        const walletExchanges: any = {};

        txs.map((tx) => {
            if (!tx.walletExchange) {
                console.warn(tx);
            }

            walletExchanges[tx.walletExchange ?? ''] = true;
        });

        // if (walletExchanges['']) {
        //     throw new Error('IWallet/exchange not provided');
        // }

        return Object.keys(walletExchanges);
    }

    txIsSendOrReceive(tx: CryptoTaxTransaction): boolean {
        return [
            CryptoTaxTransactionType.Send,
            CryptoTaxTransactionType.Receive
        ].includes(tx.type);
    }

    getSends(txs: CryptoTaxTransaction[]): CryptoTaxTransaction[] {
        return txs.filter(tx => this.txIsSendOrReceive(tx));
    }

    getNotSends(txs: CryptoTaxTransaction[]): CryptoTaxTransaction[] {
        return txs.filter(tx => !this.txIsSendOrReceive(tx));
    }

    private findWalletByAddress(address: string) {
        return this.config.wallets.find(wallet => wallet.address.toLowerCase() === address.toLowerCase());
    }

    private makeFilename(walletExchange: string, year: string, month: string) {
        const wallet = this.findWalletByAddress(walletExchange);

        if (!wallet) {
            console.warn(`wallet not found in config: ${walletExchange}`);
            return walletExchange;
        }

        return `${year}-${month}_${wallet.blockchain}_${this.shortenAddress(wallet.address)}_${wallet.name}`;
    }

    private shortenAddress(address: string): string {
        return address.slice(-5);
    }
}
