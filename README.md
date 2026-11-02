# KBiz360 Quin Aliza — Backend

REST API for the KBiz360 Smart Trade ERP (Quin Aliza Group).
Node.js + Express 5 + MongoDB (Mongoose). All rules are in [CLAUDE.md](CLAUDE.md).

## Quick start

1. Install Node.js 20.11+ and MongoDB 8 running as a **replica set** (needed for transactions).
2. `npm install`
3. `cp .env.example .env` and set `MONGODB_URI`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`.
4. `npm run seed:demo` — creates roles, branches, accounts, the first Super Admin
   (prints a one-time password if `SEED_ADMIN_PASSWORD` is empty) and sample data.
5. `npm run dev` → <http://localhost:5000/api/v1/health>

## Scripts

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start with auto-restart on file save         |
| `npm start`         | Start (production)                           |
| `npm run seed`      | Set up the database (safe to run many times) |
| `npm run seed:demo` | Same + sample suppliers, transporters, items |
| `npm test`          | Run all tests (needs the local MongoDB)      |
| `npm run lint`      | Check code quality                           |
| `npm run format`    | Format code with Prettier                    |

## Using the API

- Log in: `POST /api/v1/auth/login` `{ email, password }` → `data.token`
- Send it on every call: `Authorization: Bearer <token>`
- Choose the view with `X-Branch-Id: <branchId>` (no header = Group view, all branches)
- Responses: `{ success, message, data, meta? }` — errors: `{ success: false, message, details? }`

## Endpoints (all under `/api/v1`)

| Area          | Endpoints                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `POST /auth/login` · `GET /auth/me` · `POST /auth/change-password`                                                                                                                                                                                                  |
| Users & roles | `/users` (CRUD, `/:id/reset-password`, deactivate/reactivate) · `/roles` (CRUD, `GET /roles/permissions`)                                                                                                                                                           |
| Branches      | `/branches` (creating one also creates its cash accounts, godown, cost centre)                                                                                                                                                                                      |
| Settings      | `GET /settings` · `PUT /settings/fx` · `PUT /settings/financial-year` · `PATCH /settings/tax` · `PUT /settings/inventory` · `POST /settings/periods/:YYYY-MM/lock` · `/unlock`                                                                                      |
| Masters       | `/clients` `/suppliers` `/transporters` `/custom-agencies` `/godowns` `/cost-centres` `/bank-accounts` `/tax-codes` `/price-lists` `/leave-types` `/payroll-components` `/item-categories` — each: list, get, create, `PATCH`, `/:id/deactivate`, `/:id/reactivate` |
| Items         | `/items` (same pattern; item codes are generated, e.g. `IC-HD0001`)                                                                                                                                                                                                 |
| Accounts      | `/accounts` (chart of accounts) · `GET /accounts/groups`                                                                                                                                                                                                            |
| Vouchers      | `GET /vouchers` · `GET /vouchers/outstanding` · `POST /vouchers` (201 posted / 202 sent for approval) · `POST /vouchers/:id/void`                                                                                                                                   |
| Approvals     | `GET /approvals` · `POST /approvals/:id/approve` · `POST /approvals/:id/reject`                                                                                                                                                                                     |
| Inventory     | `GET /inventory/balances` `/summary` `/valuation` `/movements` · `POST /inventory/opening-stock` · `/inventory/transfers` (+ `/approve` `/reject` `/cancel`) · `/inventory/adjustments`                                                                             |
| Sales         | `GET /sales` · `POST /sales` (cash USD/CDF or credit) · `POST /sales/:id/returns`                                                                                                                                                                                   |
| Purchases     | `GET /purchases` · `POST /purchases` · `POST /purchases/:id/returns`                                                                                                                                                                                                |
| Imports       | `/import-plans` (+ `/complete` `/cancel`) · `/shipments` · `GET /shipments/stages` · `GET /shipments/pipeline` · `PUT/DELETE /shipments/:id/stages/:stage` · `POST /shipments/:id/deliver` · `POST /shipments/:id/payments` · `POST /shipments/:id/void`            |
| HR            | `/hr/staff` · `/hr/attendance` (`PUT` a day sheet, `GET /monthly`) · `/hr/leave-requests` (+ approve/reject/cancel) · `/hr/salary-advances` · `/hr/payroll-runs` (+ `PATCH` lines, `/post`, `/cancel`)                                                              |
| Reports       | `/reports/dashboard` `/trial-balance` `/profit-loss` `/balance-sheet` `/ledger` `/cash-position` `/aging` `/sales-summary` `/stock-valuation`                                                                                                                       |
| Audit         | `GET /audit-logs`                                                                                                                                                                                                                                                   |
