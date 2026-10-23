// The previous defaults (midgard/thornode.thorchain.network and *.ninerealms.com) no longer
// resolve in DNS (checked 2026-10-01).
export const API_URLS = {
    thornode: process.env.THORNODE_API_URL || 'https://gateway.liquify.com/chain/thorchain_api',
    // THORChain v1, for tx statuses up to its last block (ThornodeService)
    thornodeArchive: process.env.THORNODE_API_ARCHIVE_URL || 'https://gateway.liquify.com/chain/thorchain_v1_api',
    midgard: process.env.MIDGARD_API_URL || 'https://gateway.liquify.com/chain/thorchain_midgard',
};

// JSON-RPC endpoints for EVM receipts (docs/specs/fees.md): ones that still serve receipts from the chain's start
export const EVM_RPC_URLS: Record<string, string> = {
    ETH: process.env.ETH_RPC_URL || 'https://eth.drpc.org',
    AVAX: process.env.AVAX_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    BSC: process.env.BSC_RPC_URL || 'https://bsc-dataseed.bnbchain.org',
    BASE: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
};
