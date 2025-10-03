import {ITaxConfig} from "./ITaxConfig";
import path from "path";
import fs from "fs-extra";
import toml from "js-toml";

export class TaxConfig {
    static load(filename: string): ITaxConfig {
        const config = this.loadConfigFile(filename);
        return this.applyDefaults(config);
    }

    private static loadConfigFile(filename: string): ITaxConfig {
        console.log(`Wallets config file: ${filename}\n`);

        const fileExtension = path.extname(filename).toLowerCase();
        const fileContent = fs.readFileSync(filename).toString();

        let config;

        if (fileExtension === '.toml') {
            config = toml.load(fileContent) as ITaxConfig;
        } else if (fileExtension === '.json') {
            config = JSON.parse(fileContent);
        } else {
            throw new Error(`Unsupported config file format: ${fileExtension}`);
        }

        return config;
    }

    static applyDefaults(config: Partial<ITaxConfig>): ITaxConfig {
        const dateToday = new Date().toISOString().substring(0, 10);
        const defaults = {
            outputPath: 'output',
            unsupportedActionsPath: 'unsupported-actions',
            cachePath: 'cache',
            toDate: dateToday
        };

        return {
            ...defaults,
            ...config
        } as ITaxConfig;
    }
}
