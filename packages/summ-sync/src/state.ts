// The sync's own tables in the state dir:
//
//   adopted.csv       Leg,ID: a leg uploaded with an old <file>:<n> ID, and the row it was adopted to
//   overrides.json    values the user set in Summ, kept over the run's (spec: Drift and overrides)
//
// plan writes both tables as they would be after it to the plan's folder; apply installs them in the state dir,
// so a plan that is never applied changes nothing later plans assume.
//   apply-log.jsonl   one line per call apply made; an edit's lines carry {legId, field, value, ...}

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Value = string | number | null

export interface Override {
    /** The row's ID. */
    id: string
    /** Which of the row's legs: its base leg, the quote leg of a trade, or its fee leg. */
    leg: LegRole
    field: string
    /** The run's value when the override was captured. */
    run: Value
    /** The user's value in Summ: kept. */
    summ: Value
    seenAt: string
    /** For the user to fill in. */
    reason: string
}

export type LegRole = 'base' | 'quote' | 'fee'

export interface AppliedEdit {
    legId: string
    field: string
    value: Value
}

export function readAdopted(stateDir: string): Map<string, string> {
    const file = join(stateDir, 'adopted.csv')
    const adopted = new Map<string, string>()
    if (!existsSync(file)) return adopted
    const [header, ...lines] = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    if (header !== 'Leg,ID') throw new Error(`${file}: expected the header "Leg,ID"`)
    for (const line of lines) {
        const [legId, id] = line.split(',')
        adopted.set(legId, id)
    }
    return adopted
}

export function writeAdopted(stateDir: string, adopted: Map<string, string>): void {
    const lines = [...adopted].sort(([a], [b]) => a.localeCompare(b)).map(([legId, id]) => `${legId},${id}`)
    writeFileSync(join(stateDir, 'adopted.csv'), ['Leg,ID', ...lines].join('\n') + '\n')
}

export function readOverrides(stateDir: string): Override[] {
    const file = join(stateDir, 'overrides.json')
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
}

export function writeOverrides(stateDir: string, overrides: Override[]): void {
    writeFileSync(join(stateDir, 'overrides.json'), JSON.stringify(overrides, null, 2) + '\n')
}

export function readApplyLog(stateDir: string): AppliedEdit[] {
    const file = join(stateDir, 'apply-log.jsonl')
    if (!existsSync(file)) return []
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((e) => typeof e.legId === 'string' && typeof e.field === 'string')
}

/** Copies a plan's adopted.csv and overrides.json, if it has them, into the state dir. */
export function installTables(planDir: string, stateDir: string): string[] {
    const names = ['adopted.csv', 'overrides.json'].filter((name) => existsSync(join(planDir, name)))
    for (const name of names) copyFileSync(join(planDir, name), join(stateDir, name))
    return names
}
