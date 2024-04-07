import { CryptoTaxTransactionType } from './CryptoTaxTransactionType';

export interface CryptoTaxTransaction {
    // Wallet/Exchange
    // The wallet address the transaction is related to or 'thorchain' for swap transactions.
    // Separate CSVs need to be exported/imported for each wallet/exchange.
    walletExchange?: string;

    // Timestamp (UTC)
    // The recognized format defaults to DD/MM/YYYY HH:mm:ss. You can also select the different date formats in the "Advanced Options".
    // MM/DD/YYYY HH:mm:ss
    // DD/MM/YYYY HH:mm:ss
    // YYYY/MM/DD HH:mm:ss
    timestamp: Date | string;

    // Type
    // This is the type of transaction, e.g., buy, sell. You can read more about the valid transaction types below.
    type: CryptoTaxTransactionType;

    // Base Currency
    // The base currency of the trading pair. For example, if you purchase ETH using USD, the base currency is ETH.
    baseCurrency: string;

    // Base Amount
    // The amount excluding fee which corresponds to the base currency.
    baseAmount: string;

    // Quote Currency (Optional)
    // The quote currency of the trading pair. For example, if you purchase ETH using USD, the quote currency is USD.
    quoteCurrency?: string;

    // Quote Amount (Optional)
    // The amount of quote currency that was traded, excluding fees.
    quoteAmount?: string;

    // Fee Currency (Optional)
    // The currency in which the fee was paid.
    feeCurrency?: string;

    // Fee Amount (Optional)
    // The amount of fees that were paid.
    feeAmount?: string;

    // From (Optional)
    // The name of the Exchange/Wallet you are transferring from, if left blank, will default to CSV exchange name.
    from?: string;

    // To (Optional)
    // The name of the Exchange/Wallet you are transferring to if left blank, will default to CSV exchange name.
    to?: string;

    // Blockchain (Optional)
    // The blockchain where the transaction happened. This is particularly important for interacting with wallets that are imported on multiple chains.
    // Note: Only the blockchains we support are valid. If an invalid blockchain is entered, this field will be ignored on the transaction.
    blockchain?: string;

    // ID (Optional)
    // Any transaction ID that you would like to associate to this transaction for easy searching on the review transactions page. It should be unique where possible.
    id?: string;

    // Description (Optional)
    description?: string;

    // Reference Price Per Unit (Optional)
    // The price per unit of the "Base Currency". If left blank, the price defaults to market price.
    referencePricePerUnit?: string;

    // Reference Price Currency (Optional)
    // This is the currency of the Reference Price Per Unit.
    //
    // * Only local currencies are available. Cryptocurrencies (including stablecoins) in this column will be ignored.
    // * Only use this when Reference Price Per Unit is filled.
    // * If left blank but with Reference Price Per Unit filled, this defaults to USD.
    referencePriceCurrency?: 'AUD' | 'USD';
}
