import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { accountsByName, startTestApp } from '../helpers.js';

let t;
let admin;
let ho; // admin client working in Head Office
let acc;
const DATE = '2026-11-02';

before(async () => {
  t = await startTestApp('finance');
  admin = await t.login();
  ho = t.api(admin, t.branch('HO'));
  acc = await accountsByName(ho);
});
after(() => t.close());

const journal = (amount, extra = {}) => ({
  vType: 'journal',
  date: DATE,
  narration: 'Test',
  lines: [
    { accountId: acc['Rent'], debit: amount },
    { accountId: acc['Cash HO $'], credit: amount },
  ],
  ...extra,
});

describe('posting vouchers', () => {
  test('a balanced voucher is posted with a branch number', async () => {
    const res = await ho.post('/vouchers', journal(120)).expect(201);
    const v = res.body.data.voucher;
    assert.equal(res.body.data.status, 'posted');
    assert.match(v.voucherNo, /^JV-00001\/HO\/1126$/);
    assert.equal(v.totalDebit, 120);
    assert.equal(v.lines[0].accountName, 'Rent');
  });

  test('an unbalanced voucher is refused', async () => {
    const body = journal(100);
    body.lines[1].credit = 99.99;
    const res = await ho.post('/vouchers', body).expect(400);
    assert.match(res.body.message, /does not balance/);
  });

  test('a line with both debit and credit is refused', async () => {
    const body = journal(10);
    body.lines[0].credit = 10;
    await ho.post('/vouchers', body).expect(400);
  });

  test('cash of another branch cannot be used', async () => {
    const body = journal(10);
    body.lines[1].accountId = acc['Cash S1 $'];
    const res = await ho.post('/vouchers', body).expect(400);
    assert.match(res.body.message, /belongs to another branch/);
  });

  test('Accounts Receivable lines need a customer', async () => {
    const res = await ho
      .post('/vouchers', {
        vType: 'sales',
        date: DATE,
        lines: [
          { accountId: acc['Accounts Receivable'], debit: 50 },
          { accountId: acc['Sales Revenue'], credit: 50 },
        ],
      })
      .expect(400);
    assert.match(res.body.message, /customer or supplier/);
  });

  test('a CDF voucher is converted to USD line by line', async () => {
    const res = await ho
      .post('/vouchers', journal(28000, { currency: 'CDF', fxRate: 2800 }))
      .expect(201);
    const v = res.body.data.voucher;
    assert.equal(v.totalDebit, 10);
    assert.equal(v.lines[0].fcAmount, 28000);
    assert.equal(v.lines[0].fcCurrency, 'CDF');
  });
});

describe('locked periods', () => {
  test('nothing can be posted into a locked month', async () => {
    await t.api(admin).post('/settings/periods/2026-10/lock').expect(200);
    const res = await ho.post('/vouchers', journal(5, { date: '2026-10-15' })).expect(422);
    assert.match(res.body.message, /locked/);
    await t.api(admin).post('/settings/periods/2026-10/unlock').expect(200);
    await ho.post('/vouchers', journal(5, { date: '2026-10-15' })).expect(201);
  });
});

describe('approval limits (stored on the role, not looked up by name)', () => {
  test('an accountant over their limit waits for the General Manager', async () => {
    const accountantToken = await t.createUser(admin, {
      roleKey: 'accountant',
      email: 'acc@test.local',
    });
    const gmToken = await t.createUser(admin, {
      roleKey: 'general_manager',
      email: 'gm@test.local',
    });
    const accountant = t.api(accountantToken, t.branch('HO'));

    // Under the 10,000 limit: posted directly.
    await accountant.post('/vouchers', journal(500)).expect(201);

    // Over the limit: 202 + approval request, no voucher yet.
    const res = await accountant.post('/vouchers', journal(15000)).expect(202);
    const approvalId = res.body.data.approval.id;
    assert.equal(res.body.data.status, 'pending_approval');

    // The accountant cannot approve.
    await accountant.post(`/approvals/${approvalId}/approve`, {}).expect(403);

    // The GM approves → the voucher is posted, created by the accountant.
    const approved = await t
      .api(gmToken)
      .post(`/approvals/${approvalId}/approve`, { note: 'OK' })
      .expect(200);
    assert.equal(approved.body.data.status, 'approved');
    const voucher = await t
      .api(gmToken)
      .get(`/vouchers/${approved.body.data.result.refId}`)
      .expect(200);
    assert.equal(voucher.body.data.totalDebit, 15000);
    assert.equal(voucher.body.data.approvedBy !== undefined, true);

    // Approving twice is refused.
    await t.api(gmToken).post(`/approvals/${approvalId}/approve`, {}).expect(409);
  });
});

describe('invoices, receipts and voiding', () => {
  let clientId;
  let invoiceId;

  before(async () => {
    const res = await t.api(admin).post('/clients', { name: 'Kasongo Hardware' }).expect(201);
    clientId = res.body.data.id;
  });

  test('a receipt settles part of an invoice', async () => {
    const inv = await ho
      .post('/vouchers', {
        vType: 'sales',
        date: DATE,
        party: { kind: 'client', id: clientId },
        lines: [
          { accountId: acc['Accounts Receivable'], debit: 300 },
          { accountId: acc['Sales Revenue'], credit: 300 },
        ],
      })
      .expect(201);
    invoiceId = inv.body.data.voucher.id;
    assert.equal(inv.body.data.voucher.invoiceAmount, 300);

    await ho
      .post('/vouchers', {
        vType: 'receipt',
        date: DATE,
        party: { kind: 'client', id: clientId },
        billRefs: [{ voucherId: invoiceId, amount: 200 }],
        lines: [
          { accountId: acc['Cash HO $'], debit: 200 },
          { accountId: acc['Accounts Receivable'], credit: 200 },
        ],
      })
      .expect(201);

    const open = await ho.get(`/vouchers/outstanding?partyId=${clientId}`).expect(200);
    assert.equal(open.body.data[0].balance, 100);
  });

  test('settling more than is owed is refused', async () => {
    const res = await ho
      .post('/vouchers', {
        vType: 'receipt',
        date: DATE,
        party: { kind: 'client', id: clientId },
        billRefs: [{ voucherId: invoiceId, amount: 150 }],
        lines: [
          { accountId: acc['Cash HO $'], debit: 150 },
          { accountId: acc['Accounts Receivable'], credit: 150 },
        ],
      })
      .expect(400);
    assert.match(res.body.message, /only has 100 left/);
  });

  test('an invoice with receipts cannot be voided; a plain voucher can', async () => {
    await ho.post(`/vouchers/${invoiceId}/void`, { reason: 'Mistake' }).expect(422);
    const v = await ho.post('/vouchers', journal(42)).expect(201);
    const res = await ho
      .post(`/vouchers/${v.body.data.voucher.id}/void`, { reason: 'Entered twice' })
      .expect(200);
    assert.equal(res.body.data.status, 'voided');
  });
});

describe('reports', () => {
  test('the trial balance balances', async () => {
    const res = await t.api(admin).get('/reports/trial-balance').expect(200);
    assert.equal(res.body.data.isBalanced, true);
    assert.ok(res.body.data.rows.length > 0);
  });

  test('the balance sheet balances', async () => {
    const res = await t.api(admin).get('/reports/balance-sheet').expect(200);
    assert.equal(res.body.data.isBalanced, true);
  });

  test('the ledger shows a running balance', async () => {
    const res = await ho.get(`/reports/ledger?accountId=${acc['Accounts Receivable']}`).expect(200);
    assert.deepEqual(res.body.data.closing, { debit: 100, credit: 0 });
  });

  test('receivables aging shows what the customer owes', async () => {
    const res = await ho.get('/reports/aging?kind=receivable').expect(200);
    assert.equal(res.body.data.totals.total, 100);
  });
});
