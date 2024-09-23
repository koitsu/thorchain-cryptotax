import MarkdownIt from "markdown-it";
import fs from "fs-extra";
import {TaxEvents} from "./TaxEvents";
import {IWallet} from "./IWallet";
import {ViewblockTx} from "../viewblock";
import {Action} from "@xchainjs/xchain-midgard";
import {csvMapping} from "../cryptotax";
import {ViewblockTxV2} from "../viewblock";

export class Reporter {

    report: string;
    markdown: MarkdownIt;

    constructor() {
        this.report = '';
        const md = new MarkdownIt();
        this.markdown = md;
        const markdown_it_collapsible = require("markdown-it-collapsible");
        md.use(markdown_it_collapsible);

        // Remember old renderer, if overridden, or proxy to default renderer
        const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            // If you are sure other plugins can't add `target` - drop check below
            var aIndex = tokens[idx].attrIndex('target');

            if (aIndex < 0) {
                tokens[idx].attrPush(['target', '_blank']); // add new attribute
            } else {
                // @ts-ignore
                tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
            }

            // pass token to default renderer.
            return defaultRender(tokens, idx, options, env, self);
        };
    }

    writeln(content: any) {
        this.report += content + '\n';
    }

    hr() {
        this.writeln('----');
    }

    h1(title: string) {
        this.writeln(`# ${title}`);
    }

    h2(title: string) {
        this.writeln(`## ${title}`);
    }

    h3(title: string) {
        this.writeln(`### ${title}`);
    }

    h4(title: string) {
        this.writeln(`#### ${title}`);
    }

    link(title: string, url: string) {
        this.writeln(`[${title}](${url})`);
    }

    info(message: any) {
        this.writeln(message + '\n');
    }

    beginCollapsible(title: string) {
        this.info(`+++ ${title}`);
    }

    endCollapsible() {
        this.info('+++');
    }

    output(filename: string = 'report.html') {
        const body = this.markdown.render(this.report);
        const html = `
<html lang="en">
<head>
<title>Report</title>
<style>
body {
  font-family: sans-serif;
  font-size: small;
}

table, th, td {
  border-collapse: collapse;
  border: 1px solid black;
  font-size: small;
  padding: 4px;
}
</style>
</head>
<body>
${body}
</body>
</html>
`;

        fs.outputFileSync(filename, html);
    }
}

export function generateReport(allEvents: TaxEvents, wallet: IWallet, outputPath: string) {

    const report = new Reporter();

    report.h1(wallet.address);

    let i = 1;

    const events = allEvents.filterByWallet(wallet);

    for (const event of events) {
        report.h2(event.datetime.toLocaleString('en-AU').replace(', ', ' ').toUpperCase());
        report.info(`${i} / ${events.length}`);

        if (event.source === 'viewblock') {
            report.info(((event.input as any) as ViewblockTxV2).types);

            const hash = (event.input as ViewblockTx).hash;

            if (hash) {
                report.link('Viewblock TX', 'https://viewblock.io/thorchain/tx/' + hash);
            } else {
                report.info('No txID from Viewblock');
            }

            report.beginCollapsible('Viewblock');
            report.info('```');
            report.info(JSON.stringify(event.input, null, 4));
            report.info('```');
            report.endCollapsible();

        } else if (event.source === 'midgard') {
            report.info((event.input as Action).type);

            // TODO: out tx id?
            const txID = (event.input as Action).in[0].txID;

            if (txID) {
                report.link('Midgard TX', 'https://thorchain.net/tx/' + txID);
            } else {
                report.info('No txID from Midgard');
            }

            report.beginCollapsible('Midgard');
            report.info('```');
            report.info(JSON.stringify(event.input, null, 4));
            report.info('```');
            report.endCollapsible();
        }

        if (event.output.length > 0) {
            const ctcTxs = event.output;

            report.beginCollapsible('CTC');

            const header = [
                'Wallet/Exchange',
                ...csvMapping.map(item => item.header)
            ];
            let table = header.join(' | ') + '\n';
            table += header.map(item => '---').join(' | ') + '\n';

            for (const tx of ctcTxs) {
                const values = [
                    tx.walletExchange,
                    ...csvMapping.map(item => (tx as any)[item.field])
                ];
                table += values.join(' | ') + '\n';
            }

            report.info(table);

            report.info('```');
            report.info(JSON.stringify(event.output, null, 4));
            report.info('```');
            report.endCollapsible();
        }

        i++;
    }

    report.output(`${outputPath}/${wallet.address}.html`);
}
