import * as path from "path";
import fs from "fs-extra";
import {format} from 'date-fns-tz';
import {Exporter} from "./thorchain-exporter/Exporter";
import {generateReport} from "./thorchain-exporter/Reporter";
import {TaxEvents} from "./thorchain-exporter/TaxEvents";

async function main() {

    const configFile = process.argv[process.argv.length - 1];

    if (!configFile.endsWith('.json')) {
        throw new Error('must specify config file');
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd_hh-mm-ss');
    const outputPath = `output/${timestamp}`;
    const cachePath = 'cache';

    console.log(path.resolve(cachePath))

    // Read config
    const exporter = new Exporter(path.resolve(configFile), path.resolve(cachePath));

    if (!exporter.config.cacheDataSources) {
        // Delete all cached data sources
        fs.removeSync(path.resolve(__dirname, cachePath));
    }

    const wallets = exporter.config.wallets;
    const allEvents= new TaxEvents();

    // Import viewblock and midgard into TaxEvents

    for (const wallet of wallets) {
        const events = await exporter.getEvents(wallet);
        events.sortDesc();

        // Generate each report with the events for that wallet only.
        // After calling addEvents then events will be de-duplicated so not all would show up in their wallet report.
        generateReport(events, wallet, `${outputPath}/report`);

        allEvents.addEvents(events);
    }

    allEvents.sortDesc();

    // Convert TaxEvents to CTC
    // Collect all events and then save, otherwise one wallet's TC swaps could overwrite another
    exporter.saveToCsv(allEvents.getAllCtcTx(), `${outputPath}/csv`);
}

main().then(() => {
    process.exit(0);
});
