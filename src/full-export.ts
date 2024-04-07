import * as path from "path";
import fs from "fs-extra";
import {Exporter} from "./thorchain-exporter/Exporter";
import {generateReport} from "./thorchain-exporter/Reporter";
import {TaxEvents} from "./thorchain-exporter/TaxEvents";

async function main() {

    const configFile = process.argv[process.argv.length - 1];

    if (!configFile.endsWith('.json')) {
        throw new Error('must specify config file');
    }

    // Read config
    const exporter = new Exporter(path.resolve(configFile));

    if (!exporter.config.cacheDataSources) {
        // Clearing Midgard cache
        // Delete everything in src/cryptotax-thorchain/_cache
        fs.removeSync('src/cryptotax-thorchain/_cache');

        // Clearing Viewblock cache
        // Delete everything in src/viewblock/_cache
        fs.removeSync('src/viewblock/_cache');
    }

    const wallets = exporter.config.wallets;
    const allEvents= new TaxEvents();

    // Import viewblock and midgard into TaxEvents

    for (const wallet of wallets) {
        const events = await exporter.getEvents(wallet);
        events.sortDesc();

        // Generate each report with the events for that wallet only.
        // After calling addEvents then events will be de-duplicated so not all would show up in their wallet report.
        generateReport(events, wallet);

        allEvents.addEvents(events);
    }

    allEvents.sortDesc();

    // Convert TaxEvents to CTC
    // Collect all events and then save, otherwise one wallet's TC swaps could overwrite another
    exporter.saveToCsv(allEvents.getAllCtcTx(), 'output/csv');
}

main().then(() => {
    process.exit(0);
});
