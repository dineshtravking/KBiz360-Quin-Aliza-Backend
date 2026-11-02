# KBiz360 Quin Aliza — Backend Rules

REST API for **KBiz360 Smart Trade ERP**, a multi-branch import and trading ERP for the
**Quin Aliza Group** (hardware / steel, Democratic Republic of Congo).
The frontend lives next door in `../KBiz360-Quin-Aliza-ERP` (React + Vite, port 5173).

These rules apply to every change in this repo — by a person or by Claude.

---

## 1. Tech stack

| Part        | Choice                                              |
| ----------- | --------------------------------------------------- |
| Runtime     | Node.js ≥ 20.11 (developed on 24), ES Modules       |
| Framework   | Express 5                                           |
| Database    | MongoDB 8 + Mongoose 9 (replica set `rs0`)          |
| Validation  | Zod 4                                               |
| Logging     | pino + pino-http (pino-pretty in development)       |
| Security    | helmet, cors, express-rate-limit                    |
| Auth        | jsonwebtoken (Bearer tokens) + bcryptjs             |
| Tests       | Node built-in test runner (`node:test`) + supertest |
| Lint/format | ESLint 10 (flat config) + Prettier                  |

Do not add a new package without a clear reason. Prefer what is already installed.

## 2. Commands

```bash
npm run dev          # start with auto-restart (node --watch)
npm start            # start for production
npm test             # run all tests in tests/**/*.test.js
npm run lint         # check code
npm run lint:fix     # fix what can be auto-fixed
npm run format       # format all files with Prettier
npm run seed         # indexes, system accounts, roles, branches, settings, first admin
npm run seed:demo    # same + the frontend's sample suppliers, transporters, agents, items
```

Before saying a task is done: `npm test` and `npm run lint` must both pass.
Tests need the local MongoDB replica set; each test file uses its own `kbiz360_test_*` database.

## 3. Current status

- ✅ All core modules built and tested (59 integration tests): auth, users, roles, branches,
  settings, masters (12 types), items, accounts, vouchers, approvals, inventory, sales,
  purchases, imports (plans + shipments), hr, reports, audit-logs.
- ❌ **Not connected to the frontend yet** (the frontend still uses localStorage).
- ⏳ Frontend features not built yet: fixed assets & depreciation, recurring vouchers, bank
  reconciliation / bank import, cycle counts, day-end & shift handover, price change requests,
  reorder requests, delivery notes, budgets & targets, custom/saved/scheduled reports,
  notifications, validation-rules engine, field permissions, print templates, backup/restore.

Update this section when modules are added.

## 4. Folder structure

```
src/
├── config/          env.js (all env vars, validated), database.js, logger.js
├── modules/         ONE folder per business area (see §5)
├── shared/
│   ├── constants/   enums.js (types, statuses), permissions.js (every permission string)
│   ├── crud/        masterResource.js — factory for simple master data (see §5)
│   ├── db/          schema.js (base schemas), transaction.js, counter.js (document numbers)
│   ├── middlewares/ error, notFound, validate, permission (+ blockReadOnly), branchScope
│   └── utils/       ApiError, ApiResponse, money, dates, pagination, schemas (Zod pieces), docNumber
├── routes/index.js  public routes, then authenticate → blockReadOnly → branchScope, then modules
├── app.js           builds the Express app — no listen(), no DB connect (so tests can import it)
└── server.js        connects DB, starts listening, graceful shutdown
scripts/seed.js      database setup (also used by the tests)
tests/helpers.js     startTestApp(): fresh DB + seed + login/api helpers
tests/integration/   HTTP tests with supertest against createApp()
```

Module dependency direction (never import "upwards"):

```
accounts, masters, roles, settings, approvals   (no business dependencies)
  ↑ branches, users, items, auth
    ↑ vouchers            (all posting goes through voucherService.postVoucher)
      ↑ inventory         (all stock changes go through inventoryService.applyMovements)
        ↑ sales, purchases, imports, hr
          ↑ reports, audit-logs   (read-only)
```

## 5. Module rules (the most important part)

Each module is a folder `src/modules/<module-name>/` with these files:

```
item.model.js        Mongoose schema + indexes
item.validation.js   Zod schemas for params / query / body
item.repository.js   ALL database queries for this module
item.service.js      Business rules
item.controller.js   Reads req, calls service, sends res
item.routes.js       URL → middleware → controller
index.js             export { default as itemRoutes } from './item.routes.js';
```

**Layer rules — each layer has one job:**

| Layer      | Does                                             | Never does                  |
| ---------- | ------------------------------------------------ | --------------------------- |
| routes     | URL + middleware chain                           | Any logic                   |
| validation | Shape/format of input (Zod)                      | DB lookups                  |
| controller | `req.valid` → service → `res` with ApiResponse   | DB queries, business rules  |
| service    | Business rules, calls repositories, transactions | Touch `req` / `res`         |
| repository | Mongoose queries                                 | Business rules, HTTP errors |
| model      | Schema, indexes, plugins                         | Business logic              |

- Flow is one direction only: **routes → controller → service → repository → model**.
- A module may call **another module's service**, never another module's repository or model.
- No circular imports between modules. If two modules need the same thing, move it to `shared/`.
- Keep files small. If a service grows past ~300 lines, split it by sub-feature.
- Express 5 passes rejected promises to the error handler automatically:
  **write `async` controllers, do not add try/catch or asyncHandler** just to forward errors.
- Services receive `ctx = { user, scope }` (from `req.user` / `req.scope`), never `req` itself.

**Allowed exceptions (on purpose):**

- **Simple masters** (clients, suppliers, godowns, tax codes...) use the factory
  `shared/crud/masterResource.js` instead of 6 hand-written files each. Only a model + a Zod
  schema are needed. Move a master to a full module as soon as it gets real business rules.
- **Sales and purchases** have no model: a sale/purchase _is_ a voucher with `items` lines.
- **Approvals** never import the modules that use them. A module registers what happens on
  approve/reject with `registerApprovalHandler(type, { onApprove, onReject })` in its `index.js`.
- A module with several entities (inventory, imports, hr) may have one service file per entity.

## 6. Naming

- Folders: `kebab-case`, plural for modules (`import-shipments`, `items`).
- Files: `<singular>.<layer>.js` (`item.service.js`, `auth.middleware.js`).
- Classes: `PascalCase`. Functions/variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Mongoose models: singular PascalCase (`Item`, `ImportShipment`); collections are auto-pluralised.
- Imports: always use the path aliases and always write the `.js` extension:
  `import { ApiError } from '#shared/utils/ApiError.js';`
  Aliases: `#config/*`, `#modules/*`, `#shared/*`, `#routes/*`, `#scripts/*` (package.json `imports`).
- Import another module only through its `index.js` (`#modules/vouchers/index.js`).

## 7. API conventions

- Base path: `/api/v1`. Breaking changes go to `/api/v2`, never silently changed.
- URLs: plural nouns, kebab-case: `GET /api/v1/import-shipments/:id`.
  Actions that are not CRUD use a verb sub-path: `POST /api/v1/vouchers/:id/post`.
- JSON fields: `camelCase`.
- Success response (always via `ApiResponse`):
  ```json
  {
    "success": true,
    "message": "OK",
    "data": {},
    "meta": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 }
  }
  ```
- Error response (always via `ApiError` → error.middleware):
  ```json
  {
    "success": false,
    "message": "Validation failed",
    "details": [{ "in": "body", "field": "price", "message": "..." }]
  }
  ```
- Status codes: 200 read/update, 201 created, 202 accepted but waiting for approval,
  400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict/duplicate/
  already decided, 422 business rule broken, 500 server bug.
- Business-rule errors the frontend must react to carry a `details.code`, e.g.
  `CREDIT_LIMIT_EXCEEDED`, `INSUFFICIENT_STOCK`, `BELOW_PRICE_FLOOR`.
- The view (Group / Head Office / Branch) is sent with the `X-Branch-Id` header.
  No header = Group view (read-only for branch data: creating needs a branch).
- Masters are deactivated/reactivated (`POST /:id/deactivate`); there is no DELETE.
  Transactions are voided with a reason (`POST /:id/void`) or reversed by a return.
- Lists: `?page=1&limit=20` (max 100), `?sort=-createdAt`, `?search=`, filters as plain query keys.
  Every list endpoint is paginated — never return a whole collection.
- Never send internal fields: `password`, `__v`, tokens. Use `toJSON` transforms or `select`.

## 8. Validation & errors

- Every route that takes input uses `validate({ params, query, body })` with Zod schemas.
- Controllers read **only** `req.valid.body / req.valid.query / req.valid.params` — never raw `req.body`.
  (Express 5 makes `req.query` read-only; that is why parsed data lives on `req.valid`.)
- Use `.strict()` on body schemas so unknown fields are rejected.
- Throw `ApiError` for expected problems (`ApiError.notFound('Item not found')`).
  Anything else is treated as a 500 and logged with the stack trace.
- Error messages are for users: short, clear, no stack traces or DB details in production.

## 9. Database rules (ERP-specific)

1. **Branch scope.** Three views: **Group** (all branches), **Head Office**, one **Branch**.
   Every branch-owned document has `branchId`. Services filter with `scope.filter()`, check
   with `scope.assertAccess(id)`, and pick the branch for new records with `scope.writeBranch()`.
   No query on branch-owned data without the scope filter.
2. **Base schemas.** Use `documentSchema` (timestamps + `createdBy`/`updatedBy`) or
   `masterSchema` (same + `isActive`) from `shared/db/schema.js`. API output has `id`, never `_id`.
3. **Nothing is hard-deleted.** Masters → `isActive: false`. Vouchers → `status: 'voided'` +
   reason (manual vouchers only, open period only). Sales/purchases → returns (credit/debit notes).
4. **Money.** Amounts are stored as numbers rounded to **2 decimals** (USD); unit costs keep
   **4 decimals**. All money maths goes through `shared/utils/money.js` (it works in integer
   cents internally) — never add money with plain `+`. The books are in **USD**; CDF amounts
   are kept on each line (`fcAmount`, `fcCurrency`, `fxRate`) with the rate used at that moment.
5. **One posting function.** Every accounting entry goes through
   `voucherService.postVoucher(input, ctx, options)`. It checks: balanced, open period,
   accounts active + right branch, AR/AP lines have a party, credit limit, approval limit
   (manual vouchers only, limit stored on the role), bill settlement, numbering.
6. **System accounts by key, not by name.** Code finds accounts with
   `accountService.getSystem(SYSTEM_KEYS.X, { branchId })`. Renaming an account never breaks
   a posting. Branch cash: `cash_usd` / `cash_cdf` with `branchId`.
7. **One stock ledger.** Every stock change goes through `inventoryService.applyMovements()`.
   It writes a `StockMovement` and updates the `StockBalance` (item + godown) with the moving
   average cost, in the same transaction. Stock never goes below zero unless the setting
   `inventory.allowNegativeStock` is on. Stock in the books must always equal the ledger.
8. **Transactions.** Anything that changes more than one document runs in `inTransaction()`
   (`shared/db/transaction.js`). Pass the `session` down to every repository call.
   Inside a transaction only touch the database (it may be retried).
9. **Document numbers** come from `nextSequence(key)` (`shared/db/counter.js`, atomic `$inc`),
   formats in `shared/utils/docNumber.js` (e.g. `CS-00001/S1/1126`, `IMPO SEA0001/Nov/2026`).
10. **Dates.** Business dates (voucher, stock, stage dates) are `'YYYY-MM-DD'` strings in the
    business time zone (`BUSINESS_TIMEZONE`); periods are `'YYYY-MM'`. Timestamps
    (`createdAt`, `decidedAt`...) are normal `Date`s in UTC.
11. **Indexes** are declared in the model file. Production does not auto-build them:
    `npm run seed` syncs them.

## 10. Security

- Secrets only in `.env` (never committed). Every new variable is added to **both**
  `src/config/env.js` (schema) and `.env.example` (with a safe example value).
- Read config only from `env` (`#config/env.js`), never `process.env` elsewhere.
- Passwords hashed (bcrypt), never logged or returned (`passwordHash` has `select: false`).
  Tokens issued before a password change stop working.
- Every route after `authenticate` needs `requirePermission(...)` with permissions from
  `shared/constants/permissions.js`. Read-only roles are blocked from any non-GET request.
- Sensitive staff fields (salary, bank account, national ID) only go to `payroll:manage` users.
- The audit log records every successful change (who, what path, branch) — never bodies.
- Never build Mongo queries from raw user objects (prevents `$` operator injection) —
  validated input only.
- The logger already redacts `authorization`, `cookie`, `password`, `token`. Do not log full
  request bodies.

## 11. Logging

- Use `req.log` inside request handling, `logger` elsewhere. Never `console.log` (lint warns).
- Levels: `error` = needs fixing, `warn` = unusual but handled, `info` = important events,
  `debug` = details for development.

## 12. Testing

- Test files: `tests/**/<name>.test.js`, using `node:test` and `node:assert/strict`.
- Integration tests use `startTestApp('<unique-name>')` from `tests/helpers.js`: it creates
  a fresh database, runs the seed, and gives `login`, `createUser`, `api(token, branchId)`.
- Every new endpoint gets at least: one success test, one rule/validation-failure test,
  one permission test.
- Accounting changes must end with "the trial balance / balance sheet still balance";
  stock changes with "book stock = stock ledger".

## 13. Code style

- Prettier decides formatting (single quotes, semicolons, 100 chars). Don't fight it.
- `const` by default, `===` always, `async/await` (no `.then` chains).
- Comments explain **why**, not what. No commented-out code.
- No magic strings for statuses/roles — put them in `shared/constants/`.

## 14. How to work in this repo (for Claude and for developers)

- Explain things in simple, easy English, step by step. Separate: what works, what the problem
  is, and what to fix (file + line).
- **Do not build API / business logic unless it is asked for.** Build one module at a time.
- **Do not change the frontend** (`../KBiz360-Quin-Aliza-ERP`) unless asked — it is not
  connected to this API yet.
- Before a big change (new module, schema change, new package, folder moves), explain the plan
  and wait for approval.
- When adding a module, check the matching frontend page in `../KBiz360-Quin-Aliza-ERP/src`
  so field names and flows match what the screens expect.
- After a change: run `npm test` and `npm run lint`, and report the real results.
- Update §3 "Current status" when a module is added.
