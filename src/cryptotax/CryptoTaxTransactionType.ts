export enum CryptoTaxTransactionType {
    /** Purchase of cryptocurrency, which increases the balance remaining and effects cost basis. */
    Buy = 'buy',

    /** A sale of cryptocurrency which decreases the balance remaining and triggers a capital gain event. */
    Sell = 'sell',

    /** A deposit of your local currency into the exchange. Note, if you deposit a currency other then your
    // local currency, you need to have a corresponding buy transaction of that currency. */
    FiatDeposit = 'fiat-deposit',

    /** Use this if you cashed out from an exchange into your bank account. */
    FiatWithdrawal = 'fiat-withdrawal',

    /** Use this if you have disposed of cryptocurrency to cover fee transactions generated as a result of
     *  other transactions, e.g., gas fees paid during on-chain Ethereum swaps. If using this category, don't include this fee amount in the fee column. */
    Fee = 'fee',

    /** A transfer of cryptocurrency to a wallet or exchange. Increases the balance remaining on the receiving
     *  address and decreases the balance remaining on the from address. Does not increase your overall balance remaining. Does not trigger a capital gain event. */
    Receive = 'receive',
    TransferIn = 'transfer-in',

    /** A transfer of cryptocurrency from a wallet or exchange. Increases the balance remaining on the receiving
     *  address and decreases the balance remaining on the from address. Does not decrease your overall balance remaining. Does not trigger a capital gain event. */
    Send = 'send',
    TransferOut = 'transfer-out',

    /** Use this if you acquired a new cryptocurrency as a result of a chain split (such as Bitcoin Cash being received by Bitcoin holders). */
    ChainSplit = 'chain-split',

    /** This acts similar to a sell. However you wish to label this as an expense. You can use this if you want
     *  to categorize an outgoing transaction as an expense (e.g. business paying out a salary). */
    Expense = 'expense',

    /** Triggers a capital loss event with the sale price being zero. */
    Stolen = 'stolen',

    /** Use this if you have lost the crypto, triggers a capital loss event similar to the stolen category. */
    Lost = 'lost',

    /** Use this if you have sent your crypto / NFT to a burner address. It triggers a capital loss event similar to the stolen category. */
    Burn = 'burn',

    /** Triggers an income tax event based on the market value at the time of receipt. Increase the balance
     *  remaining and is used for future cost basis calculations. */
    Income = 'income',

    /** Similar to income but used for interest-bearing activities which don't suit other categories. */
    Interest = 'interest',

    /** Use this if you received mining rewards (as a hobby). */
    Mining = 'mining',

    /** Use this if you received a free token airdrop. */
    Airdrop = 'airdrop',

    /** Use this if you earned interest from staking. */
    Staking = 'staking',

    /** You deposited these coins into a staking pool. This acts similar to a withdrawal. */
    StakingDeposit = 'staking-deposit',

    /** You have withdrawn these coins from the staking pool. This acts similar to a deposit. */
    StakingWithdrawal = 'staking-withdrawal',

    /** Use this if you acquired cryptocurrency as a cash-back (e.g., credit card payment). */
    Cashback = 'cashback',

    /** Use this if you have received payments from secondary sales (e.g., being an NFT creator). */
    Royalty = 'royalty',
    Royalties = 'royalties',

    /** Use this if you spent crypto on personal use and you want to ignore this transaction for tax purposes.
     *  Warning, this is only valid in very specific individual circumstances. Check with your tax professional before using this option. */
    PersonalUse = 'personal-use',

    /** Use this if you have acquired cryptocurrency as a gift. If you have given a gift to someone else, use the sell category. */
    IncomingGift = 'incoming-gift',
    Gift = 'gift',

    /** Use this If you have given a gift to someone else. This is similar to a sell. */
    OutgoingGift = 'outgoing-gift',

    /** Use this if you have received (acquired) a cryptocurrency or cash as a loan. */
    Borrow = 'borrow',
    Loan = 'loan',

    /** Use this if you have repaid a loan. */
    LoanRepayment = 'loan-repayment',

    /** Use this if the lending platform you used has liquidated your collateral. */
    Liquidate = 'liquidate',

    /** Advanced usage only - use this if you have performed margin, futures, derivates, etc. type trades and realized a profit from your trading activity. */
    RealizedProfit = 'realized-profit',

    /** Advanced usage only - use this if you have performed margin, futures, derivates, etc., type trades, and realized a loss of your trading activity. */
    RealizedLoss = 'realized-loss',

    /** Advanced usage only - use this if you have paid fees associated with a realized-profit or realized-loss trades. */
    MarginFee = 'margin-fee',

    /** Used to transfer the cost basis from one blockchain to another. (Note: A "bridge-in" and a "bridge-out" must match.)
     * bridge-out is the send transaction from the source wallet.
     * bridge-in is the receive transaction in the destination wallet.
     */
    BridgeIn = 'bridge-in',
    BridgeOut = 'bridge-out',

    /** This acts similar to a 'buy'. A common use case is when a user is minting NFTs. */
    Mint = 'mint',

    /** You have withdrawn these coins from a borrowing/lending platform. This acts similar to a deposit into your account. */
    CollateralWithdrawal = 'collateral-withdrawal',

    /** You have set these coins aside as collateral for a loan. This acts as a withdrawal from your account. */
    CollateralDeposit = 'collateral-deposit',

    /** You have added these coins into a liquidity pool */
    AddLiquidity = 'add-liquidity',

    /** You have received tokens for adding coins into a liquidity pool. */
    ReceiveLpToken = 'receive-lp-token',

    /** You have removed these coins from a liquidity pool. */
    RemoveLiquidity = 'remove-liquidity',

    /** You have returned tokens for removing coins from a liquidity pool. */
    ReturnLpToken = 'return-lp-token',

    /** A failed transaction. This will be ignored from tax and balance calculations. (Note: Any fees incurred from creating the transaction will be accounted for.) */
    FailedIn = 'failed-in',
    FailedOut = 'failed-out',

    /** Mark the transactions as spam and ignore them from tax and balance calculations. */
    Spam = 'spam',
}
