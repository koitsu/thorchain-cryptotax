# thorchain-cryptotax

## What is this?

This is a tool that is intended to assist with doing taxes for THORChain transactions.

It will download all transactions for specified wallets and generate CSV files in
[Crypto Tax Calculator](https://cryptotaxcalculator.io) format [Advanced CSV Import](https://help.cryptotaxcalculator.io/en/articles/5777675-advanced-custom-csv-import).

Currently supported transactions

- sends/receives of Rune
- upgrade BEP Rune to native Rune
- swaps
- LPs (add/remove liquidity)
- savers (supported as LPing but needs more review)

Not currently supported

- lending
- aggregated swaps (i.e. where the swap is routed through more than just THORChain)

## Usage

### Prerequisites

- Git
- Node

Clone the repo

Install the node packages

`npm install`

### Wallet config

Edit [wallets-config.json](wallets-config.json)

Add your wallet addresses, they can be given names which are used when generating the CSV files.

Supported blockchains in wallet config

- THOR
- BTC
- ETH
- BNB
- TERRA
- DOGE
- LTC
- COSMOS

### Run the tool

`npm run export`

This will get all the transactions for the wallets and create reports and CSV files in the following paths:

- `./output/report`
- `./output/csv`

### Import into Crypto Tax Calculator

Go to Integrations

Add THORChain

Import the CSV files.

You only need to import the THORChain specific files.

e.g.
- `YYYY-MM_THOR_xxxxx_Sample_actions.ctc.csv`
- `YYYY-MM_THOR_xxxxx_Sample_sends.ctc.csv`
- `YYYY-MM_Thorchain_swaps.ctc.csv`

## Other notes

- Reference prices are pulled from CoinMarketCap using a script [cmc-scraper.py](./src/cmc-scraper/cmc-scraper.py)
  and saved into [src/cmc-scraper/data](./src/cmc-scraper/data).
  It requires Python to run the script to update the price history files.
- Sends and receives are pulled using the viewblock.io API.
  This is not a public API, so may change without warning which breaks the tool.
