# Run using NodeJS

## Prerequisites

- Git
- Node

## Steps

### 1. Clone the repo

`git clone git@github.com:skelethorfi/thorchain-cryptotax.git`

### 2. Install the node packages

`npm install`

### 3. Configure your wallets

Edit [wallets-config.toml](../wallets-config.toml)

Add your wallet addresses, they can be given names using the `name` property.
Which is helpful to identify the wallets when looking at the generated CSV filenames.

Set `fromDate`, `toDate`, and `frequency` ("monthly", "yearly", "none") for how to split up the CSV files.

The `blockchain` property for each wallet is only used in creating the CSV filenames, so it can be anything.
e.g. "THOR", "BTC", "ETH"

### 4. Run the export

`npm run export`

This will get all the transactions for the wallets and create CSV files in the following path:

- `./output/{current_datetime}/csv`

Refer to the [README](../README.md) for importing into Crypto Tax Calculator
