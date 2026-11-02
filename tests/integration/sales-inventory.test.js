import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { accountsByName, itemsByName, startTestApp } from '../helpers.js';

let t;
let admin;
let s1; // admin working in Shop 1
let items;
let acc;
const DATE = '2026-11-02';

const stockOf = async (client, itemId) => {
  const res = await client.get(`/inventory/balances?itemId=${itemId}&includeZero=true`).expect(200);
  return res.body.data[0] ?? { qty: 0, avgCost: 0 };
};

before(async () => {
  t = await startTestApp('sales');
  admin = await t.login();
  s1 = t.api(admin, t.branch('S1'));
  items = await itemsByName(s1);
  acc = await accountsByName(s1);
  await t
    .api(admin)
    .patch(`/items/${items['Ferron 10']}`, { salesPrice: 5, priceFloor: 3 })
    .expect(200);
  await t
    .api(admin)
    .put('/settings/fx', { cdfAccountingRate: 2800, cdfSalesRate: 2900 })
    .expect(200);
});
after(() => t.close());

describe('stock ledger and moving average cost', () => {
  test('opening stock adds stock and posts Dr Stock / Cr Opening Balance Equity', async () => {
    const res = await s1
      .post('/inventory/opening-stock', {
        date: DATE,
        items: [{ itemId: items['Ferron 10'], qty: 100, unitCost: 2 }],
      })
      .expect(201);
    assert.equal(res.body.data.voucher.totalDebit, 200);
    const stock = await stockOf(s1, items['Ferron 10']);
    assert.equal(stock.qty, 100);
    assert.equal(stock.avgCost, 2);
  });

  test('a purchase at a higher cost moves the average', async () => {
    const supplier = (await t.api(admin).get('/suppliers?search=Jigar')).body.data[0];
    const res = await s1
      .post('/purchases', {
        date: DATE,
        supplierId: supplier.id,
        items: [{ itemId: items['Ferron 10'], qty: 100, unitCost: 3 }],
      })
      .expect(201);
    assert.equal(res.body.data.invoiceAmount, 300);
    const stock = await stockOf(s1, items['Ferron 10']);
    assert.equal(stock.qty, 200);
    assert.equal(stock.avgCost, 2.5); // (100×2 + 100×3) / 200
  });
});

describe('sales', () => {
  test('a cash sale moves stock out and books COGS at average cost', async () => {
    const res = await s1
      .post('/sales', {
        date: DATE,
        saleType: 'cash',
        items: [{ itemId: items['Ferron 10'], qty: 10 }],
      })
      .expect(201);
    const v = res.body.data;
    assert.match(v.voucherNo, /^CS-00001\/S1\//);
    const line = (name) => v.lines.find((l) => l.accountName === name);
    assert.equal(line('Cash S1 $').debit, 50); // 10 × 5
    assert.equal(line('Sales Revenue').credit, 50);
    assert.equal(line('Cost of Goods Sold').debit, 25); // 10 × 2.5
    assert.equal(line('Stock / Inventory').credit, 25);
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, 190);
  });

  test('a CDF cash sale books the sales-rate vs book-rate difference as FX gain', async () => {
    const res = await s1
      .post('/sales', {
        date: DATE,
        saleType: 'cash',
        paymentCurrency: 'CDF',
        items: [{ itemId: items['Ferron 10'], qty: 28, unitPrice: 5 }],
      })
      .expect(201);
    const lines = res.body.data.lines;
    const cash = lines.find((l) => l.accountName === 'Cash S1 FC');
    // 140 USD × 2900 = 406,000 CDF; booked at 2800 = 145 USD → 5 USD FX gain
    assert.equal(cash.fcAmount, 406000);
    assert.equal(cash.debit, 145);
    assert.equal(lines.find((l) => l.accountName === 'Foreign Exchange Gain').credit, 5);
  });

  test('selling below the minimum price is blocked', async () => {
    const res = await s1
      .post('/sales', {
        date: DATE,
        saleType: 'cash',
        items: [{ itemId: items['Ferron 10'], qty: 1, unitPrice: 2 }],
      })
      .expect(422);
    assert.equal(res.body.details.code, 'BELOW_PRICE_FLOOR');
  });

  test('selling more than is in stock is blocked, and nothing is saved', async () => {
    const before = await stockOf(s1, items['Ferron 10']);
    const res = await s1
      .post('/sales', {
        date: DATE,
        saleType: 'cash',
        items: [{ itemId: items['Ferron 10'], qty: 99999 }],
      })
      .expect(422);
    assert.equal(res.body.details.code, 'INSUFFICIENT_STOCK');
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, before.qty);
  });
});

describe('credit sales, receipts and returns', () => {
  let clientId;
  let saleId;

  before(async () => {
    const res = await t
      .api(admin)
      .post('/clients', { name: 'Mwamba Construction', creditLimit: 100 })
      .expect(201);
    clientId = res.body.data.id;
  });

  test('going over the credit limit needs confirmation', async () => {
    const body = {
      date: DATE,
      saleType: 'credit',
      clientId,
      items: [{ itemId: items['Ferron 10'], qty: 30 }],
    };
    const refused = await s1.post('/sales', body).expect(422);
    assert.equal(refused.body.details.code, 'CREDIT_LIMIT_EXCEEDED');
    const res = await s1.post('/sales', { ...body, confirmCreditLimit: true }).expect(201);
    saleId = res.body.data.id;
    assert.equal(res.body.data.invoiceAmount, 150);
  });

  test('a receipt reduces what the customer owes', async () => {
    await s1
      .post('/vouchers', {
        vType: 'receipt',
        date: DATE,
        party: { kind: 'client', id: clientId },
        billRefs: [{ voucherId: saleId, amount: 50 }],
        lines: [
          { accountId: acc['Cash S1 $'], debit: 50 },
          { accountId: acc['Accounts Receivable'], credit: 50 },
        ],
      })
      .expect(201);
    const open = await s1.get(`/vouchers/outstanding?partyId=${clientId}`).expect(200);
    assert.equal(open.body.data[0].balance, 100);
  });

  test('a return brings stock back at original cost and lowers what is owed', async () => {
    const stockBefore = (await stockOf(s1, items['Ferron 10'])).qty;
    const res = await s1
      .post(`/sales/${saleId}/returns`, {
        date: DATE,
        items: [{ itemId: items['Ferron 10'], qty: 4 }],
      })
      .expect(201);
    const lines = res.body.data.lines;
    assert.equal(lines.find((l) => l.accountName === 'Sales Returns').debit, 20);
    assert.equal(lines.find((l) => l.accountName === 'Accounts Receivable').credit, 20);
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, stockBefore + 4);
    const open = await s1.get(`/vouchers/outstanding?partyId=${clientId}`).expect(200);
    assert.equal(open.body.data[0].balance, 80);

    // Cannot return more than was sold.
    await s1
      .post(`/sales/${saleId}/returns`, {
        date: DATE,
        items: [{ itemId: items['Ferron 10'], qty: 27 }],
      })
      .expect(422);
  });

  test('a sale cannot be voided directly — it must be returned', async () => {
    const res = await s1.post(`/vouchers/${saleId}/void`, { reason: 'Try' }).expect(422);
    assert.match(res.body.message, /created by sales/);
  });
});

describe('transfers and adjustments', () => {
  test('stock only moves when the transfer is approved', async () => {
    const godowns = (await t.api(admin).get('/godowns?limit=50')).body.data;
    const gd = (code) => godowns.find((g) => g.code === code).id;
    const fromQty = (await stockOf(s1, items['Ferron 10'])).qty;

    const created = await s1
      .post('/inventory/transfers', {
        date: DATE,
        fromGodownId: gd('S1'),
        toGodownId: gd('S2'),
        items: [{ itemId: items['Ferron 10'], qty: 5 }],
      })
      .expect(201);
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, fromQty); // still "floating"

    await t.api(admin).post(`/inventory/transfers/${created.body.data.id}/approve`).expect(200);
    const s2 = t.api(admin, t.branch('S2'));
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, fromQty - 5);
    const arrived = await stockOf(s2, items['Ferron 10']);
    assert.equal(arrived.qty, 5);
    assert.equal(arrived.avgCost, 2.5); // moved at the source's average cost
  });

  test("a branch manager's adjustment waits for the GM, then posts stock + journal", async () => {
    const manager = await t.createUser(admin, {
      roleKey: 'branch_manager',
      email: 'mgr@test.local',
      branchIds: [t.branch('S1')],
    });
    const gm = await t.createUser(admin, { roleKey: 'general_manager', email: 'gm@test.local' });
    const before = (await stockOf(s1, items['Ferron 10'])).qty;

    const res = await t
      .api(manager)
      .post('/inventory/adjustments', {
        date: DATE,
        reason: 'damage',
        items: [{ itemId: items['Ferron 10'], qtyChange: -2 }],
      })
      .expect(201);
    assert.equal(res.body.data.status, 'pending');
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, before);

    await t.api(gm).post(`/approvals/${res.body.data.approvalId}/approve`, {}).expect(200);
    assert.equal((await stockOf(s1, items['Ferron 10'])).qty, before - 2);
    const adj = await t.api(gm).get(`/inventory/adjustments/${res.body.data.id}`).expect(200);
    assert.equal(adj.body.data.status, 'approved');
    assert.ok(adj.body.data.voucherId);
  });
});

describe('reports agree with the ledger', () => {
  test('stock value in the books equals the stock ledger', async () => {
    const tb = (await t.api(admin).get('/reports/trial-balance').expect(200)).body.data;
    assert.equal(tb.isBalanced, true);
    const stockRow = tb.rows.find((r) => r.name === 'Stock / Inventory');
    const valuation = (await t.api(admin).get('/reports/stock-valuation').expect(200)).body.data;
    assert.equal(stockRow.closing.debit, valuation.totalValue);
  });

  test('sales summary shows revenue, cost and gross profit', async () => {
    const res = await s1.get('/reports/sales-summary?groupBy=item').expect(200);
    const { revenue, cost, grossProfit } = res.body.data.totals;
    assert.ok(revenue > 0);
    assert.equal(grossProfit, Math.round((revenue - cost) * 100) / 100);
  });

  test('the dashboard loads', async () => {
    const res = await s1.get('/reports/dashboard').expect(200);
    assert.ok(res.body.data.sales.monthToDate > 0);
  });
});
