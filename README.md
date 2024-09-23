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
- lending
- savers

Not currently supported
- THORNames
- RUNEPool
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

Add your wallet addresses, they can be given names using the `name` property.
Which is helpful to identify the wallets when looking at the generated CSV filenames.

Set `fromDate`, `toDate`, and `frequency` ("monthly", "yearly", "none") for how to split up the CSV files.

The `blockchain` property for each wallet is only used in creating the CSV filenames, so it can be anything.
e.g. "THOR", "BTC", "ETH"

### Run the tool

`npm run export`

This will get all the transactions for the wallets and create reports and CSV files in the following paths:

- `./output/{current_datetime}/report`
- `./output/{current_datetime}/csv`

### Import into Crypto Tax Calculator

Go to Integrations

Add THORChain

Import the CSV files.

You only need to import the THORChain specific files.

e.g.
- `YYYY-MM-DD_YYYY-MM-DD_THOR_xxxxx_Sample.csv`
- `YYYY-MM-DD_YYYY-MM-DD_THOR_thorchain_swaps.csv`

## Liquidity Pools

- LP actions are converted to Add/Remove Liquidity transactions for Crypto Tax Calculator
- Also creates Receive/Return LP Token transactions
- LP Token is set to the `liquidityUnits` amount provided by Midgard
  - **Note:** This may not be 100% accurate way of accounting for the LP
- LP token is given the name `ThorLP.{asset}`
  - e.g. ThorLP.BTC.BTC

## Savers

- Savers are converted to Add/Remove Liquidity transactions for Crypto Tax Calculator
  - **Note:** In THORChain when doing a Savers deposit, it goes into the liquidity pool
    and the other side of the LP is provided by the protocol.
    Assumption here is that Savers should be considered as LP rather than staking when
    converting to Crypto Tax Calculator.
- Also creates Receive/Return LP Token transactions
- LP Token is set to the `liquidityUnits` amount provided by Midgard
  - For Savers, this is equal to the asset amount being added
- LP token is given the name `ThorLP.{savers_asset}`
  - e.g. ThorLP.BTC/BTC (savers assets have a slash)

## Other notes

- Reference prices are pulled from CoinMarketCap using a script [cmc-scraper.py](./src/cmc-scraper/cmc-scraper.py)
  and saved into [src/cmc-scraper/data](./src/cmc-scraper/data).
  It requires Python to run the script to update the price history files.
  Reference prices are currently disabled.
- Sends and receives are pulled using the viewblock.io API.
  This is not a public API, so may change without warning which breaks the tool.

## Useful References

- [THORChain Dev Docs - Asset Notation](https://dev.thorchain.org/concepts/asset-notation.html)
- [THORChain Dev Docs - Transaction Memos](https://dev.thorchain.org/concepts/memos.html)
- [Thornode API docs](https://thornode.ninerealms.com/thorchain/doc)
- [XChainJS docs](https://docs.xchainjs.org)
