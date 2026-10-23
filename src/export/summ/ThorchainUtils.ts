import { parseMidgardAsset, parseMidgardPool } from '../../sources/thorchain/MidgardUtils.ts';
import { type GasSources, inboundGas } from '../../interpret/midgard/gas.ts';
import { formatAmount } from '../../domain/Amount.ts';
import { type Protocol, THORCHAIN } from '../../domain/Protocol.ts';

// The fee columns for an inbound transaction: its gas leg, named for the CSV (docs/specs/fees.md)
export function getInboundFee(
    txId: string,
    sources: GasSources,
    inputAsset?: string,
    protocol: Protocol = THORCHAIN
): { feeCurrency: string; feeAmount: string } {
    const gas = inboundGas(txId, sources, '', inputAsset, protocol);

    if (!gas) {
        return {feeCurrency: '', feeAmount: ''};
    }

    return {feeCurrency: parseMidgardAsset(gas.asset.notation, protocol).currency, feeAmount: formatAmount(gas.amount)};
}

// The token for a liquidity position. Midgard names a savers pool by its synth (BTC/BTC); the token
// avoids the slash, which breaks Summ's ledger view, and differs from the pool's own LP token.
export function getLpTokenName(midgardPool: string, protocol: Protocol): string {
    const isSavers = midgardPool.includes('/');
    const [chain, asset] = midgardPool.split(isSavers ? '/' : '.');

    return isSavers
        ? `${protocol.saversTokenPrefix}.${chain}.${parseMidgardAsset(`${chain}.${asset}`).currency}`
        : `${protocol.lpTokenPrefix}.${parseMidgardPool(midgardPool)}`;
}
