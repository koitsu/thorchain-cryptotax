import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS, type Config } from '../src/config.ts'
import { ADOPT_WINDOW, makePlan, type PlanInput } from '../src/plan.ts'
import type { Row, RunFile } from '../src/run.ts'
import type { Leg } from '../src/snapshot.ts'
import type { Override } from '../src/state.ts'
import { mergeTables } from '../src/state.ts'
import { renderPlan, uploadFiles, writePlan } from '../src/write-plan.ts'
import { categorisedTxids } from '../src/pull.ts'
import { summType } from '../src/summ-types.ts'

// Every value below is made up.
const PERIOD = { from: '2023-07-01', to: '2024-06-30' }
const THOR_FILE = '2023-07-01_2024-06-30_THOR_abcde_Example.csv'
const BTC_FILE = '2023-07-01_2024-06-30_BTC_fghij_Example.csv'
const FILES: RunFile[] = [
    { name: THOR_FILE, chain: 'THOR', period: PERIOD, header: 'HEADER' },
    { name: BTC_FILE, chain: 'BTC', period: PERIOD, header: 'HEADER' },
]
const CONFIG: Config = { ...DEFAULTS, managedSources: ['csv-source'] }
const TX1 = '1'.repeat(64)
const TX2 = '2'.repeat(64)

let next = 0
const legId = () => `leg${String(++next).padStart(4, '0')}`

function row(over: Partial<Row> = {}): Row {
    const r: Row = {
        file: THOR_FILE,
        chain: 'THOR',
        line: '',
        id: '2024-03-01T10:00:00.000Z.out.aaaaaaaaaaaa',
        timestamp: '2024-03-01T10:00:00.000Z',
        type: 'send',
        baseCurrency: 'RUNE',
        baseAmount: '1.5',
        quoteCurrency: '',
        quoteAmount: '',
        feeCurrency: '',
        feeAmount: '',
        from: 'wallet-a',
        to: 'wallet-b',
        blockchain: 'THORChain',
        description: `Sent 1.5 RUNE; ${TX1}`,
        txids: [TX1],
        ...over,
    }
    r.line = `${r.timestamp},${r.type},${r.id}`
    return r
}

/** The legs Summ makes of a managed row: base, quote of a trade, fee. */
function legsOf(r: Row, over: Partial<Leg> = {}, actionId = 'action1'): Leg[] {
    const common = { actionId, id: r.id, timestamp: r.timestamp, from: r.from, to: r.to, blockchain: 'thorchain', description: r.description, source: 'csv-source', importType: 'manual-csv', comments: [] }
    const sides: Record<string, ['incoming' | 'outgoing', string]> = {
        send: ['outgoing', 'withdrawal'],
        receive: ['incoming', 'deposit'],
        sell: ['outgoing', 'sell'],
        staking: ['incoming', 'staking'],
        lost: ['outgoing', 'lost'],
        'receive-lp-token': ['incoming', 'receivingLiquidityProviderToken'],
    }
    const [side, trade] = sides[r.type]
    const legs: Leg[] = [{ ...common, legId: legId(), side, trade, currency: r.baseCurrency, quantity: Number(r.baseAmount), ...over }]
    if (r.quoteCurrency) legs.push({ ...common, legId: legId(), side: side === 'incoming' ? 'outgoing' : 'incoming', trade: 'buy', currency: r.quoteCurrency, quantity: Number(r.quoteAmount) })
    if (r.feeAmount) legs.push({ ...common, legId: legId(), side: 'fees', trade: 'fee', currency: r.feeCurrency, quantity: Number(r.feeAmount) })
    return legs
}

function plan(over: Partial<PlanInput>) {
    return makePlan({
        files: FILES,
        rows: [],
        legs: [],
        history: new Map(),
        txHashes: new Set(),
        config: CONFIG,
        adopted: new Map(),
        overrides: [],
        applyLog: [],
        now: '2024-08-01T00:00:00.000Z',
        ...over,
    })
}

const empty = (p: ReturnType<typeof plan>['plan']) => [p.delete, p.edit, p.upload, p.categorise, p.report, p.overridden].every((s) => s.length === 0)

test('a row Summ holds as the run has it plans nothing', () => {
    const r = row({ feeCurrency: 'RUNE', feeAmount: '0.02' })
    const { plan: p } = plan({ rows: [r], legs: legsOf(r) })
    assert.ok(empty(p), JSON.stringify(p, null, 1))
    assert.equal(p.counts.matchedRows, 1)
})

test('a trade compares its quote leg; amounts within 1e-8 of the amount or at the 8th decimal are equal', () => {
    const r = row({ type: 'sell', quoteCurrency: 'BTC', quoteAmount: '0.001' })
    const legs = legsOf(r)
    legs[0].quantity = 1.5 * (1 + 1e-10)
    assert.ok(empty(plan({ rows: [r], legs }).plan))
    legs[1].quantity = 0.00100000999
    assert.ok(empty(plan({ rows: [r], legs }).plan))
    legs[1].quantity = 0.002
    const { plan: p } = plan({ rows: [r], legs })
    assert.deepEqual(p.edit[0].changes.map((c) => [c.leg, c.field, c.summ, c.desired]), [['quote', 'quantity', 0.002, 0.001]])
})

test('a sell paying its fee in the asset sold matches Summ\'s amount with the fee added; another amount is an edit', () => {
    const r = row({ type: 'sell', baseAmount: '400', quoteCurrency: 'BRUNE', quoteAmount: '399.4', feeCurrency: 'RUNE', feeAmount: '0.24488481' })
    assert.ok(empty(plan({ rows: [r], legs: legsOf(r, { quantity: 400.24488481 }) }).plan))
    assert.ok(empty(plan({ rows: [r], legs: legsOf(r) }).plan))
    const { plan: p } = plan({ rows: [r], legs: legsOf(r, { quantity: 401 }) })
    assert.deepEqual(p.edit[0].changes.map((c) => [c.field, c.summ, c.desired]), [['quantity', 401, 400]])
    const send = row({ feeCurrency: 'RUNE', feeAmount: '0.02' })
    assert.deepEqual(plan({ rows: [send], legs: legsOf(send, { quantity: 1.52 }) }).plan.edit[0].changes.map((c) => c.field), ['quantity'])
})

test('a changed amount, type or time is an edit of the leg', () => {
    const r = row({ type: 'receive', baseAmount: '2' })
    const legs = legsOf(row({ type: 'receive' }), { trade: 'staking', timestamp: '2024-03-01T10:00:00.900Z' })
    const { plan: p } = plan({ rows: [r], legs })
    assert.equal(p.edit.length, 1)
    assert.deepEqual(p.edit[0].changes.map((c) => [c.field, c.summ, c.desired]), [['trade', 'staking', 'deposit'], ['quantity', 1.5, 2]])
    assert.equal(p.edit[0].changes[0].legId, legs[0].legId)
})

test('a blank blockchain in Summ is not compared (Summ infers it from the wallet); another chain is', () => {
    const r = row()
    assert.ok(empty(plan({ rows: [r], legs: legsOf(r, { blockchain: '' }) }).plan))
    const { plan: p } = plan({ rows: [r], legs: legsOf(r, { blockchain: 'btc' }) })
    assert.deepEqual(p.edit[0].changes.map((c) => [c.field, c.summ, c.desired]), [['blockchain', 'btc', 'thorchain']])
})

test('a categorised row matches a leg whose hash carries an output index', () => {
    const r = btcRow({ type: 'bridge-trade-out' })
    const { plan: p } = plan({ rows: [r], legs: [ownLeg({ id: `${TX1}__1` })] })
    assert.equal(p.categorise.length, 1)
})

test('a changed time moves every leg of the row, in one edit', () => {
    const r = row({ feeCurrency: 'RUNE', feeAmount: '0.02' })
    const legs = legsOf(r).map((l) => ({ ...l, timestamp: '2024-03-01T09:59:50.000Z' }))
    const { plan: p } = plan({ rows: [r], legs })
    assert.equal(p.edit.length, 1)
    assert.deepEqual(p.edit[0].changes.map((c) => [c.leg, c.field, c.desired]), [['base', 'timestamp', r.timestamp], ['fee', 'timestamp', r.timestamp]])

    // a row whose fee leg Summ already split into another action is deleted and uploaded, not edited
    const split = legsOf(r).map((l) => (l.side === 'fees' ? { ...l, actionId: 'action2', timestamp: '2024-03-01T09:59:50.000Z' } : l))
    const remade = plan({ rows: [r], legs: split }).plan
    assert.deepEqual([remade.edit, remade.delete.map((d) => d.reason), remade.upload.map((u) => u.ids)], [[], ['legs in several actions'], [[r.id]]])

    // a fee leg's time the user set by hand is kept (captured), not moved
    const history = new Map([['action1', ['2 Jan 2024 · user · Date: 1 Mar 2024 10:00 → 1 Mar 2024 09:59']]])
    const kept = plan({ rows: [r], legs: legsOf(r).map((l) => (l.side === 'fees' ? { ...l, timestamp: '2024-03-01T09:59:50.000Z' } : l)), history }).plan
    assert.deepEqual([kept.edit, kept.overridden.map((o) => [o.kind, o.override.leg])], [[], [['captured', 'fee']]])
})

test('a changed description, currency or shape deletes the legs and uploads the row', () => {
    const r = row({ feeCurrency: 'RUNE', feeAmount: '0.02' })
    for (const [legs, reason] of [
        [legsOf(r, { description: 'Old wording' }), /description/],
        [legsOf(r, { currency: 'ETH' }), /currency/],
        [legsOf(row()), /shape/],
    ] as const) {
        const { plan: p } = plan({ rows: [r], legs: [...legs] })
        assert.equal(p.delete.length, 1)
        assert.match(p.delete[0].reason, reason)
        assert.deepEqual(p.delete[0].legIds, legs.map((l) => l.legId))
        assert.deepEqual(p.upload, [{ file: THOR_FILE, filed: false, ids: [r.id] }])
        assert.equal(p.edit.length, 0)
    }
})

test('a row with no fee whose Summ legs have one loses only the fee leg: a delete of it alone, no upload', () => {
    const r = row()
    const legs = legsOf(row({ feeCurrency: 'RUNE', feeAmount: '0.02' }))
    const fee = legs.find((l) => l.side === 'fees') as Leg
    const { plan: p } = plan({ rows: [r], legs })
    assert.equal(p.delete.length, 1)
    assert.deepEqual(p.delete[0].legIds, [fee.legId])
    assert.equal(p.delete[0].id, r.id)
    assert.equal(p.delete[0].otherLegs, 1)
    assert.match(p.delete[0].reason, /fee leg lost/)
    assert.deepEqual(p.upload, [])
    assert.equal(p.edit.length, 0)
    // a row that also changed otherwise is still deleted whole and uploaded
    const moved = plan({ rows: [r], legs: legsOf(row({ feeCurrency: 'RUNE', feeAmount: '0.02' }), { description: 'Old wording' }) }).plan
    assert.equal(moved.delete.length, 1)
    assert.equal(moved.delete[0].legIds.length, 2)
    assert.deepEqual(moved.upload, [{ file: THOR_FILE, filed: false, ids: [r.id] }])
})

test('a row Summ lacks is uploaded, filed years apart, with the file header and its line', () => {
    const now = row()
    const old = row({ id: '2023-08-01T00:00:00.000Z.out.bbbbbbbbbbbb', timestamp: '2023-08-01T00:00:00.000Z' })
    const { plan: p } = plan({ rows: [now, old], config: { ...CONFIG, filedBefore: '2024-01-01' } })
    assert.deepEqual(p.upload, [
        { file: THOR_FILE, filed: false, ids: [now.id] },
        { file: THOR_FILE, filed: true, ids: [old.id] },
    ])
    const files = uploadFiles(p, FILES, [now, old])
    assert.deepEqual(files.map((f) => f.name), [THOR_FILE, THOR_FILE.replace('.csv', '_filed.csv')])
    assert.equal(files[0].text, `HEADER\n${now.line}\n`)
})

test('a leg with no row is deleted only inside the run\'s periods', () => {
    const gone = legsOf(row({ id: '2024-02-01T00:00:00.000Z.in.cccccccccccc', timestamp: '2024-02-01T00:00:00.000Z' }))
    const earlier = legsOf(row({ id: '2022-02-01T00:00:00.000Z.in.dddddddddddd', timestamp: '2022-02-01T00:00:00.000Z' }))
    const earlierLegacy = legsOf(row({ id: 'old-file.csv:3', timestamp: '2022-02-01T00:00:00.000Z' }))
    const { plan: p } = plan({ legs: [...gone, ...earlier, ...earlierLegacy] })
    assert.deepEqual(p.delete.map((d) => [d.summId, d.reason]), [['2024-02-01T00:00:00.000Z.in.cccccccccccc', 'no row in the run']])
    assert.equal(p.counts.managedLegsOutOfScope, 2)
})

test('a delete counts the other legs in its actions', () => {
    const gone = legsOf(row({ id: '2024-02-01T00:00:00.000Z.in.cccccccccccc' }), {}, 'shared')
    const other: Leg = { ...gone[0], legId: legId(), side: 'incoming', id: TX1, source: 'btc-wallet', importType: 'wallet' }
    const { plan: p } = plan({ legs: [...gone, other] })
    assert.equal(p.delete[0].otherLegs, 1)
})

test('an old <file>:<n> leg is adopted to the one row with its time, type, currency, amount and txid', () => {
    const r = row({ description: `New wording; ${TX1}` })
    const legs = legsOf(r, { id: 'old-file.csv:7', description: `Old wording; ${TX1.toUpperCase()}` })
    const first = plan({ rows: [r], legs })
    assert.deepEqual(first.plan.adopted, [{ legId: legs[0].legId, id: r.id }])
    assert.ok(empty(first.plan), JSON.stringify(first.plan, null, 1))
    assert.equal(first.adopted.get(legs[0].legId), r.id)

    // Next plan: matched through adopted.csv; a later amount change is an edit, not a re-upload
    const second = plan({ rows: [{ ...r, baseAmount: '1.6' }], legs, adopted: first.adopted })
    assert.deepEqual(second.plan.adopted, [])
    assert.deepEqual(second.plan.edit[0].changes.map((c) => c.field), ['quantity'])
})

test('an old leg with another txid, or none of the row\'s values, is deleted and the row uploaded', () => {
    const r = row()
    for (const over of [{ description: `Old; ${TX2}` }, { quantity: 9 }]) {
        const { plan: p } = plan({ rows: [r], legs: legsOf(r, { id: 'old-file.csv:7', ...over }) })
        assert.equal(p.adopted.length, 0)
        assert.match(p.delete[0].reason, /old ID/)
        assert.deepEqual(p.upload[0].ids, [r.id])
    }
})

test('an old leg that fits two rows is reported, and neither row is uploaded', () => {
    const a = row({ description: 'no txid' })
    const b = row({ id: '2024-03-01T10:00:00.000Z.out.eeeeeeeeeeee', description: 'no txid either' })
    const { plan: p } = plan({ rows: [a, b], legs: legsOf(a, { id: 'old-file.csv:7', description: '' }) })
    assert.equal(p.report[0].kind, 'ambiguous-adoption')
    assert.deepEqual(p.upload, [])
    assert.deepEqual(p.delete, [])
})

test('an old leg a little apart from its row is adopted when it is in the same wallet, and its time edited', () => {
    const r = row({ description: 'no txid' })
    const legs = legsOf(r, { id: 'old-file.csv:7', description: '', timestamp: '2024-03-01T09:59:43.000Z', to: 'vault-address' })
    const { plan: p } = plan({ rows: [r], legs })
    assert.deepEqual(p.adopted, [{ legId: legs[0].legId, id: r.id }])
    assert.deepEqual(p.edit[0].changes.map((c) => c.field), ['timestamp', 'to'])
    assert.deepEqual([p.upload, p.delete], [[], []])

    // In another wallet, or further apart than ADOPT_WINDOW, it is not
    for (const over of [{ from: 'wallet-z', timestamp: '2024-03-01T09:59:43.000Z' }, { timestamp: new Date(Date.parse(r.timestamp) - (ADOPT_WINDOW + 1) * 1000).toISOString() }]) {
        assert.deepEqual(plan({ rows: [r], legs: legsOf(r, { id: 'old-file.csv:7', description: '', ...over }) }).plan.adopted, [])
    }
})

test('an old leg of another type in the same wallet is adopted and its type edited, unless a row of its own type fits', () => {
    const r = row({ description: 'no txid' })
    const legs = legsOf(r, { id: 'old-file.csv:7', description: '', trade: 'outgoingGift', timestamp: '2024-03-01T10:00:10.000Z' })
    const { plan: p } = plan({ rows: [r], legs })
    assert.deepEqual(p.adopted.map((a) => a.id), [r.id])
    assert.deepEqual(p.edit[0].changes.map((c) => [c.field, c.desired]), [['trade', 'withdrawal'], ['timestamp', r.timestamp]])

    // A row of the leg's own type further apart is preferred to one of another type nearer
    const near = row({ id: '2024-03-01T10:00:10.000Z.out.bbbbbbbbbbbb', timestamp: '2024-03-01T10:00:10.000Z', type: 'sell', description: 'no txid' })
    const own = row({ id: '2024-03-01T10:01:00.000Z.out.cccccccccccc', timestamp: '2024-03-01T10:01:00.000Z', description: 'no txid' })
    const both = plan({ rows: [near, own], legs: legsOf(r, { id: 'old-file.csv:7', description: '' }) })
    assert.deepEqual(both.plan.adopted.map((a) => a.id), [own.id])
    assert.deepEqual(both.plan.upload[0].ids, [near.id])
})

test('an old leg with a row\'s currency and amount in the same wallet, but adopted to none, is reported, not deleted', () => {
    const r = row({ description: 'no txid' })
    const legs = legsOf(r, { id: 'old-file.csv:7', description: '', timestamp: '2024-03-01T07:00:00.000Z' })
    const { plan: p } = plan({ rows: [r], legs })
    assert.deepEqual(p.report.map((e) => [e.kind, e.legIds]), [['legacy-lookalike', [legs[0].legId]]])
    assert.match(p.report[0].detail, new RegExp(r.id))
    assert.deepEqual([p.adopted, p.delete, p.upload], [[], [], []])

    // One that names another txid is another tx, and one more than a day apart another event: deleted, and the
    // row uploaded
    for (const over of [{ description: `Old; ${TX2}`, timestamp: '2024-03-01T07:00:00.000Z' }, { description: '', timestamp: '2024-02-28T10:00:00.000Z' }]) {
        const other = plan({ rows: [r], legs: legsOf(r, { id: 'old-file.csv:7', ...over }) }).plan
        assert.deepEqual([other.report, other.delete.length, other.upload[0].ids], [[], 1, [r.id]])
    }

    // A price helper counts nothing, so it doubles nothing: the old leg is deleted and the helper uploaded
    const helper = row({ type: 'spam', description: 'no txid' })
    const old = legsOf(row({ type: 'send', description: 'no txid' }), { id: 'old-file.csv:7', description: '', trade: 'deposit', side: 'incoming', timestamp: '2024-03-01T07:00:00.000Z' })
    const spam = plan({ rows: [helper], legs: old }).plan
    assert.deepEqual([spam.report, spam.delete.length, spam.upload[0].ids], [[], 1, [helper.id]])
})

test('an extra row a run row exports itself is left out, and its leg in Summ adopts to the run row', () => {
    const r = row()
    const extra = row({ id: 'extra-file.csv:1', description: `Hand-made; ${TX1}`, extra: true })
    const legs = legsOf(extra)
    const { plan: p } = plan({ rows: [r, extra], legs })
    assert.deepEqual(p.superseded, [{ extra: extra.id, run: r.id }])
    assert.deepEqual(p.adopted, [{ legId: legs[0].legId, id: r.id }])
    assert.deepEqual([p.upload, p.delete, p.edit, p.report], [[], [], [], []])

    // Neither in Summ yet: the run row is uploaded once
    assert.deepEqual(plan({ rows: [r, extra] }).plan.upload.map((u) => u.ids), [[r.id]])
    // A run without the event keeps the extra row
    assert.deepEqual(plan({ rows: [extra] }).plan.upload.map((u) => u.ids), [[extra.id]])
    // An extra row without a txid is never left out
    const bare = row({ id: 'extra-file.csv:2', description: 'Hand-made', txids: [], extra: true })
    assert.deepEqual(plan({ rows: [r, bare] }).plan.superseded, [])
})

test('an extra row sharing a txid and currency with a run row on its side, but not the same row, is reported and neither is uploaded', () => {
    const r = row()
    const other = row({ id: '2024-03-01T10:00:00.000Z.in.bbbbbbbbbbbb', type: 'receive', baseCurrency: 'ETH', baseAmount: '0.1', description: `Received; ${TX1}` })
    const extra = row({ id: 'extra-file.csv:1', baseAmount: '1', description: `Hand-made; ${TX1}`, extra: true })
    const { plan: p } = plan({ rows: [r, other, extra] })
    assert.deepEqual(p.superseded, [])
    assert.deepEqual(p.report.map((e) => [e.kind, e.id]), [['extra-overlap', extra.id]])
    // The run row of the same txid in another currency is not held back
    assert.deepEqual(p.upload.map((u) => u.ids), [[other.id]])

    // Listed in keepExtra: no report, all uploaded
    const kept = plan({ rows: [r, other, extra], config: { ...CONFIG, keepExtra: [extra.id] } }).plan
    assert.deepEqual([kept.report, kept.upload.flatMap((u) => u.ids)], [[], [r.id, other.id, extra.id]])
    // One on the other side, or in another currency, adds to the run's rows: no report, all uploaded
    for (const over of [{ type: 'receive' }, { baseCurrency: 'BTC' }]) {
        const add = plan({ rows: [r, row({ id: 'extra-file.csv:1', description: `Hand-made; ${TX1}`, extra: true, ...over })] }).plan
        assert.deepEqual([add.report, add.upload.flatMap((u) => u.ids).length], [[], 2])
    }
})

test('an extra row in another wallet is not superseded; both in Summ, the extra row\'s legs are deleted', () => {
    const r = row()
    const elsewhere = row({ id: 'extra-file.csv:1', from: 'wallet-z', description: `Hand-made; ${TX1}`, extra: true })
    assert.deepEqual(plan({ rows: [r, elsewhere] }).plan.superseded, [])
    // Another label for the other side is the same row
    const relabelled = row({ id: 'extra-file.csv:1', to: 'other-label', description: `Hand-made; ${TX1}`, extra: true })
    assert.deepEqual(plan({ rows: [r, relabelled] }).plan.superseded, [{ extra: relabelled.id, run: r.id }])

    // The run row and the extra row both already in Summ: the run row matches, the extra row's legs go
    const extra = row({ id: 'extra-file.csv:1', description: `Hand-made; ${TX1}`, extra: true })
    const legs = [...legsOf(r), ...legsOf(extra, {}, 'action2')]
    const { plan: p } = plan({ rows: [r, extra], legs })
    assert.deepEqual(p.delete.map((d) => [d.summId, d.legIds]), [[extra.id, [legs[1].legId]]])
    assert.deepEqual([p.upload, p.adopted], [[], []])
})

test('a leg adopted to an extra row, and its override, follow the run row that supersedes it', () => {
    const r = row()
    const extra = row({ id: 'extra-file.csv:1', description: `Hand-made; ${TX1}`, extra: true })
    const legs = legsOf(extra, { id: 'old-file.csv:3', trade: 'outgoingGift' })
    const override: Override = { id: extra.id, leg: 'base', field: 'trade', run: 'withdrawal', summ: 'outgoingGift', seenAt: '', reason: 'mine' }
    const { plan: p } = plan({ rows: [r, extra], legs, adopted: new Map([[legs[0].legId, extra.id]]), overrides: [override] })
    assert.deepEqual(p.adopted, [{ legId: legs[0].legId, id: r.id }])
    assert.deepEqual([p.edit, p.overridden.map((o) => o.kind)], [[], []])
    assert.ok(renderPlan(p, 'snap', 'run').includes(`| ${extra.id} | ${r.id} |`))
})

test('a field the user changed in Summ is captured as an override and kept', () => {
    const r = row()
    const legs = legsOf(r, { trade: 'outgoingGift' })
    const history = new Map([['action1', ['1 Jan 2024 · import (original)', '2 Jan 2024 · user · Category: Send → Outgoing Gift']]])
    const first = plan({ rows: [r], legs, history })
    assert.deepEqual(first.plan.edit, [])
    assert.deepEqual(first.plan.overridden.map((o) => [o.kind, o.override.field, o.override.run, o.override.summ]), [['captured', 'trade', 'withdrawal', 'outgoingGift']])

    // Kept on the next plan, and listed again only when the run's value moves under it
    const overrides = first.overrides
    assert.ok(empty(plan({ rows: [r], legs, history, overrides }).plan))
    const moved = plan({ rows: [{ ...r, type: 'receive' }], legs: legsOf(r, { side: 'incoming', trade: 'outgoingGift' }), history, overrides })
    assert.deepEqual(moved.plan.overridden.map((o) => [o.kind, o.runNow]), [['run-changed', 'deposit']])
    assert.deepEqual(moved.plan.edit, [])
})

test('deleting an override reverts the field; an edit apply-log records is the sync\'s own', () => {
    const r = row()
    const legs = legsOf(r, { trade: 'outgoingGift' })
    const history = new Map([['action1', ['2 Jan 2024 · user · Category: Send → Outgoing Gift']]])
    const { plan: p } = plan({ rows: [r], legs, history, applyLog: [{ legId: legs[0].legId, field: 'trade', value: 'outgoingGift' }] })
    assert.deepEqual(p.edit[0].changes.map((c) => [c.field, c.desired]), [['trade', 'withdrawal']])
    assert.deepEqual(p.overridden, [])
})

test('an override whose row left the run is listed as gone', () => {
    const override: Override = { id: 'gone-id', leg: 'base', field: 'trade', run: 'a', summ: 'b', seenAt: '', reason: '' }
    const { plan: p } = plan({ overrides: [override] })
    assert.deepEqual(p.overridden.map((o) => o.kind), ['gone'])
})

function btcRow(over: Partial<Row> = {}): Row {
    return row({ file: BTC_FILE, chain: 'BTC', id: '2024-03-01T10:00:00.000Z.in.ffffffffffff', type: 'send', baseCurrency: 'BTC', baseAmount: '0.01', feeCurrency: 'BTC', feeAmount: '0.0001', blockchain: 'BTC', ...over })
}

function ownLeg(over: Partial<Leg> = {}): Leg {
    return { legId: legId(), actionId: 'l1', side: 'outgoing', id: TX1, trade: 'withdrawal', currency: 'BTC', quantity: 0.0101, timestamp: '2024-03-01T10:00:00.000Z', from: '', to: '', blockchain: 'btc', description: '', source: 'btc-wallet', importType: 'wallet', comments: [], ...over }
}

test('a row no import of its chain can hold (LP token, price helper, kept refund) is managed on an L1 file: uploaded, then matched by ID', () => {
    const lp = btcRow({ id: '2024-03-01T10:00:00.000Z.in.111111111111', type: 'receive-lp-token', baseCurrency: 'ThorLP.BTC.BTC', baseAmount: '2', feeCurrency: '', feeAmount: '' })
    const lost = btcRow({ id: '2024-03-01T10:00:00.000Z.unreturned.222222222222', type: 'lost', feeCurrency: '', feeAmount: '' })
    const add = btcRow({ type: 'add-liquidity' })
    const before = plan({ rows: [lp, lost, add], legs: [ownLeg()] }).plan
    assert.deepEqual(before.upload, [{ file: BTC_FILE, filed: false, ids: [lp.id, lost.id] }])
    assert.deepEqual(before.report.filter((r) => r.id === lp.id || r.id === lost.id), [])
    assert.equal(before.categorise.length, 1)
    assert.match(renderPlan(before, 'snap', 'run'), new RegExp(`${BTC_FILE}: 2 rows \\(into the THORChain or Maya account, not the BTC wallet`))
    // uploaded under a managed source: matched by ID, nothing planned for them (Summ lowercases an L1 address)
    const held = [...legsOf(lp, { blockchain: 'btc' }), ...legsOf(lost, { blockchain: 'btc', from: lost.from.toLowerCase() }, 'action2')]
    const after = plan({ rows: [lp, lost], legs: held }).plan
    assert.deepEqual([after.upload, after.delete, after.edit, after.report], [[], [], [], []])
    assert.deepEqual(categorisedTxids([lp, lost, add], CONFIG), new Set(add.txids))

    // A return whose request paid L1 gas has a tx of its own (Summ's import holds the gas), so it stays categorised;
    // and on THORChain, when the user leaves it to Summ's import, these types are on chain: not uploaded
    const paid = btcRow({ id: '2024-03-01T10:00:00.000Z.out.333333333333', type: 'return-lp-token', baseCurrency: 'ThorLP.BTC.BTC', baseAmount: '2' })
    const thor = row({ id: '2024-03-01T10:00:00.000Z.out.444444444444', type: 'fee', description: `Fee; ${TX2}` })
    const left = plan({ rows: [paid, thor], config: { ...CONFIG, managedChains: ['MAYA'] } }).plan
    assert.deepEqual(left.upload, [])
    assert.deepEqual(left.report.map((r) => r.id).sort(), [paid.id, thor.id].sort())
})

test('a categorised row with no leg of its amount takes the one leg with its txid, side and currency, and reports the difference', () => {
    const r = btcRow({ type: 'bridge-trade-out' })
    const gross = ownLeg({ quantity: 0.01017 })
    const { plan: p } = plan({ rows: [r], legs: [gross] })
    assert.deepEqual(p.categorise.map((c) => [c.id, c.changes.map((x) => [x.field, x.desired])]), [[r.id, [['trade', 'bridgeTradeOut']]]])
    const fee = p.report.find((x) => x.kind === 'fee' && x.id === r.id)
    assert.match(fee?.detail ?? '', /matched by txid: Summ's leg holds 0\.01017 BTC, \+0\.00007 beyond the row's 0\.01 plus its fee 0\.0001/)
    assert.deepEqual(p.report.filter((x) => x.kind === 'no-leg'), [])

    // a leg another row has exactly is not taken by a looser fit
    const exact = btcRow({ id: '2024-03-01T10:00:00.000Z.in.eeeeeeeeeeee', type: 'bridge-trade-out', baseAmount: '0.01017', feeAmount: '', feeCurrency: '' })
    const both = plan({ rows: [r, exact], legs: [ownLeg({ quantity: 0.01017 })] }).plan
    assert.deepEqual(both.categorise.map((c) => c.id), [exact.id])
    assert.deepEqual(both.report.filter((x) => x.kind === 'no-leg').map((x) => x.id), [r.id])

    // two rows that both fit the one leg only loosely: neither takes it
    const other = btcRow({ id: '2024-03-01T10:00:00.000Z.out.dddddddddddd', type: 'failed-out', baseAmount: '0.00002', feeAmount: '', feeCurrency: '' })
    const rivals = plan({ rows: [r, other], legs: [ownLeg({ quantity: 0.01017 })] }).plan
    assert.deepEqual(rivals.categorise, [])
    assert.deepEqual(rivals.report.filter((x) => x.kind === 'no-leg').map((x) => x.id).sort(), [r.id, other.id].sort())

    // a gas the user split off and ignored is not the row's leg
    const split = plan({ rows: [r], legs: [ownLeg({ quantity: 0.0096 }), ownLeg({ quantity: 0.0005, trade: 'ignoreOut', actionId: 'l2' })] }).plan
    assert.deepEqual(split.categorise.map((c) => c.actionId), ['l1'])
    // but not when the legs do not add up to the row: the ignored one may be the row's, ignored on purpose
    const apart = plan({ rows: [r], legs: [ownLeg({ quantity: 0.02 }), ownLeg({ quantity: 0.007, trade: 'ignoreOut', actionId: 'l2' })] }).plan
    assert.deepEqual([apart.categorise, apart.report.map((x) => x.kind)], [[], ['no-leg']])

    // two legs with the txid, side and currency, neither of the row's amount: not guessed
    const two = plan({ rows: [r], legs: [ownLeg({ quantity: 0.02 }), ownLeg({ quantity: 0.03, actionId: 'l2' })] }).plan
    assert.deepEqual([two.categorise, two.report.map((x) => x.kind)], [[], ['no-leg']])
})

test('a categorised row sets the type of Summ\'s own leg with its txid, currency and gross amount; a fee that differs is reported, not edited', () => {
    const r = btcRow({ type: 'bridge-trade-out' })
    const leg = ownLeg()
    const fee = ownLeg({ side: 'fees', trade: 'fee', quantity: 0.0002 })
    const { plan: p } = plan({ rows: [r], legs: [leg, fee] })
    assert.equal(p.categorise.length, 1)
    assert.deepEqual(p.categorise[0].changes.map((c) => [c.leg, c.field, c.desired]), [['base', 'trade', 'bridgeTradeOut']])
    assert.deepEqual(p.report.map((x) => [x.kind, x.legIds, x.detail]), [['fee', [fee.legId], "Summ's import holds a fee of 0.0002 BTC, the row 0.0001; the fee is not edited"]])
    assert.equal(p.upload.length, 0)
    // the same fee: nothing reported
    assert.deepEqual(plan({ rows: [r], legs: [ownLeg(), ownLeg({ side: 'fees', trade: 'fee', quantity: 0.0001 })] }).plan.report, [])
})

test('the receive Summ made up to pair a categorised send as a transfer is ignored, never matched', () => {
    const made = (over: Partial<Leg> = {}) => ownLeg({ side: 'incoming', trade: 'deposit', quantity: 0.0101, source: 'manual', importType: 'soft-transfer', to: 'THORChain', ...over })
    const fee = () => ownLeg({ side: 'fees', trade: 'fee', quantity: 0.0001 })
    // in the send's action, before the send is categorised
    const soft = made()
    const before = plan({ rows: [btcRow({ type: 'bridge-trade-out' })], legs: [ownLeg(), fee(), soft] }).plan
    assert.deepEqual(before.categorise.map((e) => [e.changes.map((c) => c.desired), e.ignore]), [[['bridgeTradeOut'], [soft.legId]]])
    // left on its own after the send was categorised: ignored without an edit
    const alone = made({ actionId: 'l2' })
    const after = plan({ rows: [btcRow({ type: 'bridge-trade-out' })], legs: [ownLeg({ trade: 'bridgeTradeOut' }), fee(), alone] }).plan
    assert.deepEqual(after.categorise.map((e) => [e.changes, e.ignore]), [[[], [alone.legId]]])
    // already ignored, or the row is a plain send (Summ's transfer is right): nothing to do
    assert.deepEqual(plan({ rows: [btcRow({ type: 'bridge-trade-out' })], legs: [ownLeg({ trade: 'bridgeTradeOut' }), fee(), made({ trade: 'ignoreIn' })] }).plan.categorise, [])
    assert.deepEqual(plan({ rows: [btcRow()], legs: [ownLeg(), fee(), made()] }).plan.categorise, [])
    // a categorised receive is never matched to a made-up leg of the same amount
    const receive = btcRow({ type: 'bridge-trade-in', feeCurrency: '', feeAmount: '' })
    const own = ownLeg({ side: 'incoming', trade: 'deposit', quantity: 0.01 })
    const p = plan({ rows: [receive], legs: [own, made({ quantity: 0.01 })] }).plan
    assert.deepEqual([p.report, p.categorise.map((e) => e.changes[0].legId)], [[], [own.legId]])
})

test('the send Summ made up to pair a categorised receive as a transfer is ignored', () => {
    const receive = btcRow({ type: 'bridge-trade-in', feeCurrency: '', feeAmount: '' })
    const own = ownLeg({ side: 'incoming', trade: 'deposit', quantity: 0.01 })
    const made = ownLeg({ side: 'outgoing', trade: 'withdrawal', quantity: 0.01, source: 'manual', importType: 'soft-transfer', from: 'THORChain' })
    const p = plan({ rows: [receive], legs: [own, made] }).plan
    assert.deepEqual(p.categorise.map((e) => [e.changes.map((c) => [c.legId, c.desired]), e.ignore]), [[[[own.legId, 'bridgeTradeIn']], [made.legId]]])
    assert.deepEqual(p.report, [])
})

test('a categorised row with no or several fitting legs is reported, never guessed', () => {
    const r = btcRow()
    const none = plan({ rows: [r], legs: [ownLeg({ id: TX2 })] }).plan
    assert.deepEqual(none.report.map((e) => e.kind), ['no-leg'])
    // a payout row's report names every txid, so the one Summ's import lists can be searched for
    const payout = btcRow({ type: 'bridge-trade-in', feeCurrency: '', feeAmount: '', txids: [TX1, TX2] })
    assert.deepEqual(plan({ rows: [payout], legs: [] }).plan.report.map((e) => e.txids), [[TX1, TX2]])
    const unfetched = plan({ rows: [r], legs: [], txHashes: new Set([TX1]) }).plan
    assert.deepEqual(unfetched.report.map((e) => e.kind), ['not-in-snapshot'])
    const several = plan({ rows: [r], legs: [ownLeg(), ownLeg({ quantity: 0.01 })] }).plan
    assert.deepEqual(several.report.map((e) => e.kind), ['several-legs'])
    assert.deepEqual(several.categorise, [])
})

test('a manual entry naming a row\'s txid is reported', () => {
    const r = row()
    const manual = ownLeg({ importType: 'manual', source: 'manual', id: 'x-manual', comments: [`see ${TX1}`] })
    const { plan: p } = plan({ rows: [r], legs: [...legsOf(r), manual] })
    assert.deepEqual(p.report.map((e) => [e.kind, e.id]), [['manual-entry', r.id]])
})

test('a row held in summ-sync.json gets nothing planned and is listed under held', () => {
    const edited = row({ id: '2024-03-01T10:00:00.000Z.out.111111111111' })
    const missing = row({ id: '2024-03-01T10:00:00.000Z.in.222222222222', type: 'receive', txids: [TX2], description: `Received; ${TX2}` })
    const clean = row({ id: '2024-03-01T10:00:00.000Z.out.333333333333', txids: [], description: 'Sent' })
    const hold = [edited, missing, clean].map((r) => ({ id: r.id, reason: 'pending a decision' }))
    const legs = [...legsOf(edited, { to: 'wallet-c' }), ...legsOf(clean, {}, 'action2')]
    const free = plan({ rows: [edited, missing, clean], legs }).plan
    assert.deepEqual([free.edit.length, free.upload.length], [1, 1])
    const { plan: p } = plan({ rows: [edited, missing, clean], legs, config: { ...CONFIG, hold: [...hold, { id: '2024-03-02T10:00:00.000Z.out.444444444444', reason: 'gone' }] } })
    assert.deepEqual([p.edit, p.upload, p.counts.uploads], [[], [], 0])
    assert.deepEqual(p.held.map((h) => [h.kind, h.id, h.held.map((x) => x.split(' ')[0])]), [
        ['hold', edited.id, ['edit']],
        ['hold', missing.id, ['upload']],
        ['hold', clean.id, []],
    ])
    assert.deepEqual(p.notes, ['hold: no row 2024-03-02T10:00:00.000Z.out.444444444444 in the run'])
    // a held row that left the run: its legs are not deleted
    const gone = plan({ rows: [], legs: legsOf(edited), config: { ...CONFIG, hold } }).plan
    assert.deepEqual([gone.delete, gone.held.map((h) => [h.kind, h.id, h.summId, h.held])], [[], [['hold', null, edited.id, ['delete (no row in the run)']]]])
    assert.match(renderPlan(p, 'snap', 'run'), /## Held .*\(3\)[\s\S]*\| hold \| 2024-03-01T10:00:00.000Z.out.333333333333 \| pending a decision \| nothing to do \|/)
})

test('an event whose Summ actions hold a manual entry gets nothing planned: the user\'s pairing is held, every row sharing its txids too', () => {
    // A managed send paired in Summ with the user's manual receive, and the categorised receive of the same tx
    const send = row({ to: 'wallet-c' })
    const manual: Leg = { ...legsOf(send)[0], legId: legId(), side: 'incoming', trade: 'bridgeTradeIn', currency: 'BTC', quantity: 0.0099, id: 'entry-manual', source: 'manual', importType: 'manual', description: '' }
    const receive = btcRow({ type: 'bridge-trade-in', feeCurrency: '', feeAmount: '' })
    const deposit = ownLeg({ side: 'incoming', trade: 'deposit', quantity: 0.01 })
    const legs = [...legsOf(send, { to: 'wallet-b' }), manual, deposit]
    const free = plan({ rows: [send, receive], legs: legs.filter((l) => l !== manual) }).plan
    assert.deepEqual([free.edit.length, free.categorise.length], [1, 1])
    const { plan: p } = plan({ rows: [send, receive], legs })
    assert.deepEqual([p.edit, p.categorise], [[], []])
    assert.deepEqual(p.held.map((h) => [h.kind, h.id, h.legIds, h.held.map((x) => x.split(' ')[0])]).sort(), [
        ['manual-pairing', receive.id, [manual.legId], ['categorise']],
        ['manual-pairing', send.id, [manual.legId], ['edit']],
    ].sort())
    // A leg with no row in the run, beside a manual entry: not deleted either
    const orphan = legsOf(row({ id: '2024-03-01T10:00:00.000Z.out.999999999999' }), {}, 'action9')
    const del = plan({ rows: [], legs: [...orphan, { ...manual, actionId: 'action9' }] }).plan
    assert.deepEqual([del.delete, del.held.map((h) => [h.kind, h.id, h.summId, h.held[0]])], [[], [['manual-pairing', null, orphan[0].id, 'delete (no row in the run)']]])
    // A manual entry in an action of its own that names the event's txid (a stand-in for the row): the row is not uploaded
    const named = { ...manual, actionId: 'action7', description: `Payout; ${TX1}` }
    const standIn = plan({ rows: [send], legs: [named] }).plan
    assert.deepEqual([standIn.upload, standIn.held.map((h) => [h.id, h.held])], [[], [[send.id, [`upload into ${THOR_FILE}`]]]])
    // A placeholder txid (all zeros) links no rows
    const ZERO = '0'.repeat(64)
    const a = row({ id: '2024-03-01T10:00:00.000Z.out.aaaaaaaaaaa1', txids: [TX1, ZERO] })
    const b = row({ id: '2024-03-01T10:00:00.000Z.out.aaaaaaaaaaa2', txids: [TX2, ZERO] })
    const apart = plan({ rows: [a, b], legs: [{ ...manual, actionId: 'action7', description: `Payout; ${TX1}` }] }).plan
    assert.deepEqual([apart.upload.flatMap((u) => u.ids), apart.held.map((h) => h.id)], [[b.id], [a.id]])
})

test('a row uploaded under a source not in managedSources is reported, not uploaded again', () => {
    const r = row()
    const { plan: p } = plan({ rows: [r], legs: legsOf(r, { source: 'other-account' }) })
    assert.deepEqual(p.report.map((e) => e.kind), ['other-source'])
    assert.deepEqual(p.upload, [])
})

test('a CSV type with no Summ type stops the plan', () => {
    assert.throws(() => plan({ rows: [row({ type: 'teleport' })] }), /No Summ type for CSV type teleport/)
})

test('plan.md lists each section and keeps filed entries apart', () => {
    const { plan: p } = plan({ rows: [row(), row({ id: '2023-08-01T00:00:00.000Z.out.bbbbbbbbbbbb', timestamp: '2023-08-01T00:00:00.000Z' })], config: { ...CONFIG, filedBefore: '2024-01-01' } })
    const md = renderPlan(p, 'snap', 'run')
    for (const heading of ['## Delete', '## Edit', '## Upload (', '## Categorise', '## Report', '## Overridden', '### Amendments']) assert.ok(md.includes(heading), heading)
})

test('an exact fit is adopted though a looser fit of another old leg claims the same row, and no row is uploaded beside an ambiguous leg', () => {
    const r = row({ description: 'no txid' })
    const r2 = row({ id: '2024-03-01T10:00:30.000Z.out.bbbbbbbbbbbb', timestamp: '2024-03-01T10:00:30.000Z', type: 'sell', description: 'no txid' })
    // a: r at the same second; b: r2 under its old type 17 s off, and r (same type) within the window
    const a = legsOf(r, { id: 'old-file.csv:7', description: '' })
    const b = legsOf(r, { id: 'old-file.csv:8', description: '', timestamp: '2024-03-01T10:00:47.000Z' }, 'action2')
    const { plan: p } = plan({ rows: [r, r2], legs: [...a, ...b] })
    assert.deepEqual(p.adopted.map((x) => [x.legId, x.id]), [[a[0].legId, r.id], [b[0].legId, r2.id]])
    assert.deepEqual([p.upload, p.delete, p.report], [[], [], []])

    // Two old legs both 17 s off r: ambiguous, and r2, which they fit less well, is not uploaded either
    const c = legsOf(r, { id: 'old-file.csv:9', description: '', timestamp: '2024-03-01T09:59:43.000Z' }, 'action3')
    const amb = plan({ rows: [r, r2], legs: [...b, ...c] }).plan
    assert.deepEqual(amb.report.map((x) => x.kind), ['ambiguous-adoption', 'ambiguous-adoption'])
    assert.deepEqual([amb.upload, amb.adopted], [[], []])

    // Two old legs tied at r's exact second hold r back; a third, 50 s off, does not take it
    const x1 = legsOf(r, { id: 'old-file.csv:10', description: '' }, 'action4')
    const x2 = legsOf(r, { id: 'old-file.csv:11', description: '' }, 'action5')
    const z = legsOf(r, { id: 'old-file.csv:12', description: '', timestamp: '2024-03-01T10:00:50.000Z' }, 'action6')
    const tie = plan({ rows: [r], legs: [...x1, ...x2, ...z] }).plan
    assert.deepEqual(tie.report.map((x) => x.kind), ['ambiguous-adoption', 'ambiguous-adoption', 'ambiguous-adoption'])
    assert.deepEqual([tie.upload, tie.adopted, tie.delete], [[], [], []])
})

test('plan writes nothing to the state dir; mergeTables adds its adoptions and captures and keeps hand edits', () => {
    const state = mkdtempSync(join(tmpdir(), 'summ-sync-state-'))
    const runDir = mkdtempSync(join(tmpdir(), 'summ-sync-run-'))
    writeFileSync(join(state, 'summ-sync.json'), JSON.stringify({ managedSources: ['csv-source'] }))
    const header =
        'Timestamp (UTC),Type,Base Currency,Base Amount,Quote Currency (Optional),Quote Amount (Optional),Fee Currency (Optional),Fee Amount (Optional),From (Optional),To (Optional),Blockchain (Optional),ID (Optional),Description (Optional),Reference Price Per Unit (Optional),Reference Price Currency (Optional)'
    const r = row()
    mkdirSync(join(runDir, 'csv'))
    writeFileSync(join(runDir, 'csv', THOR_FILE), `${header}\n${r.timestamp},send,RUNE,1.5,,,,,wallet-a,wallet-b,THORChain,${r.id},${r.description},,\n`)
    // Summ holds the row under an old ID, so the plan adopts its leg
    const leg = { _id: 'leg-old', id: 'old-file.csv:7', trade: 'withdrawal', currency: 'RUNE', quantity: '1.5', timestamp: r.timestamp, from: 'wallet-a', to: 'wallet-b', description: '', source: 'csv-source' }
    mkdirSync(join(state, 'actions'))
    writeFileSync(join(state, 'actions', 'action1.json'), JSON.stringify({ action: { _id: 'action1', outgoing: [leg] }, history: [] }))
    mkdirSync(join(state, 'snapshots'))
    writeFileSync(join(state, 'snapshots', '2024-08-01T00-00-00.json'), JSON.stringify({ takenAt: '2024-08-01T00:00:00.000Z', total: 1, actions: [{ id: 'action1', txHash: 'old-file.csv:7', category: '', tags: [], detail: true }] }))

    const dir = writePlan(state, runDir)
    assert.ok(!existsSync(join(state, 'adopted.csv')) && !existsSync(join(state, 'overrides.json')))
    const saved = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'))
    assert.deepEqual(saved.adopted, [{ legId: 'leg-old', id: r.id }])

    // A reason filled in by hand after the plan is kept when the same override is captured again
    const own: Override = { id: r.id, leg: 'base', field: 'trade', run: 'withdrawal', summ: 'outgoingGift', seenAt: '', reason: 'mine' }
    writeFileSync(join(state, 'overrides.json'), JSON.stringify([own]))
    assert.deepEqual(mergeTables(state, saved.adopted, [{ ...own, reason: '' }]), ['adopted.csv'])
    assert.equal(readFileSync(join(state, 'adopted.csv'), 'utf8'), `Leg,ID\nleg-old,${r.id}\n`)
    assert.equal(JSON.parse(readFileSync(join(state, 'overrides.json'), 'utf8'))[0].reason, 'mine')
    assert.deepEqual(mergeTables(state, saved.adopted, []), [])

    // A value the user set again since replaces the override, still with their reason
    assert.deepEqual(mergeTables(state, [], [{ ...own, summ: 'lost', reason: '' }]), ['overrides.json'])
    assert.deepEqual(JSON.parse(readFileSync(join(state, 'overrides.json'), 'utf8')).map((o: Override) => [o.summ, o.reason]), [['lost', 'mine']])
})

test('CSV types map to the trade Summ holds for them', () => {
    // Summ's enum has `collateral`, not `collateralDeposit`: a CSV collateral-deposit row is held as `collateral`
    assert.deepEqual(summType('collateral-deposit'), { side: 'outgoing', trade: 'collateral' })
    assert.deepEqual(summType('collateral-withdrawal'), { side: 'incoming', trade: 'collateralWithdrawal' })
})
