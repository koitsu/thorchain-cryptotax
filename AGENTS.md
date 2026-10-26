# Agent guide

skeletax turns THORChain and Maya wallet history into CSV files for Summ
(formerly Crypto Tax Calculator). Read [README.md](README.md) first.

## Running it for a user

- Setup and the export command: README, [Run it](README.md#run-it); options in
  [docs/nodejs-instructions.md](docs/nodejs-instructions.md).
- Keep the user's config, output and cache in a folder outside this clone.
  Never commit their wallet addresses, txids or outputs.
- Uploading to Summ: [docs/summ.md](docs/summ.md). For summ-sync, follow
  [packages/summ-sync/README.md](packages/summ-sync/README.md): show the user
  each `plan.md` and apply only after they approve it.
- Never enter the user's credentials (Summ, exchanges, wallets); they log in
  themselves.

## Changing the code

- How to add a transaction type: [docs/contributing.md](docs/contributing.md).
  The behaviour of each action is in [docs/specs/](docs/specs/README.md);
  update the spec with the code.
- Build golden cases from public transactions (`npm run fixture`,
  [docs/specs/fixtures.md](docs/specs/fixtures.md)). Review rows with
  `npm run fixture -- show test/cases/<group/name>` before saving them with
  `--write`.
- Install with `npm ci --ignore-scripts`. Add a dependency only when the work
  needs it, and pin the exact version.
- Before committing: `npm run format`, `npm run typecheck` and `npm test`.
