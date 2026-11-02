import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { accountsByName, itemsByName, startTestApp } from '../helpers.js';

let t;
let admin;
let ho;
let items;
let acc;
const DATE = '2026-11-02';

before(async () => {
  t = await startTestApp('imports');
  admin = await t.login();
  ho = t.api(admin, t.branch('HO'));
  items = await itemsByName(ho);
  acc = await accountsByName(ho);
});
after(() => t.close());

describe('import shipments', () => {
  let shipment;
  let supplierId;

  before(async () => {
    supplierId = (await t.api(admin).get('/suppliers?search=Jigar')).body.data[0].id;
  });

  test('a plan tracks how much has been ordered', async () => {
    const plan = await ho
      .post('/import-plans', {
        route: 'HD',
        name: 'Q4 Roofing',
        supplierId,
        createdDate: DATE,
        items: [{ itemId: items['Roofing Sheet BG 28'], plannedQty: 1000 }],
      })
      .expect(201);
    assert.match(plan.body.data.planNo, /^PLAN HD 0001\/Nov\/2026$/);

    const res = await ho
      .post('/shipments', {
        route: 'HD',
        planId: plan.body.data.id,
        supplierId,
        orderDate: DATE,
        productType: 'pt_mo',
        items: [
          { itemId: items['Roofing Sheet BG 28'], qty: 600, fobPrice: 4, salesPrice: 10 },
          { itemId: items['Chair Marriage Red'], qty: 100, fobPrice: 6, salesPrice: 12 },
        ],
        charges: { seaFreight: 600, customsKasumbalesa: 400 },
      })
      .expect(201);
    shipment = res.body.data;
    assert.match(shipment.shipmentNo, /^IMPO SEA0001\/Nov\/2026$/);
    assert.equal(shipment.totals.fobUSD, 3000); // 600×4 + 100×6
    assert.equal(shipment.totals.landed, 4000); // + 1000 charges

    const progress = (await ho.get(`/import-plans/${plan.body.data.id}`).expect(200)).body.data
      .progress[0];
    assert.equal(progress.orderedQty, 600);
    assert.equal(progress.remainingQty, 400);
  });

  test('stages must be done in order', async () => {
    const res = await ho
      .put(`/shipments/${shipment.id}/stages/payment`, { date: DATE })
      .expect(422);
    assert.match(res.body.message, /Complete "Ordered" first/);
    await ho
      .put(`/shipments/${shipment.id}/stages/order_confirmed`, {
        date: DATE,
        data: { ref: 'PO-1' },
      })
      .expect(200);
  });

  test('an in-transit shipment shows on the pipeline dashboard', async () => {
    const res = await ho.get('/shipments/pipeline').expect(200);
    assert.equal(res.body.data.kpis.count, 1);
    assert.equal(res.body.data.kpis.landed, 4000);
  });

  test('AIR shipments are tracked too (frontend bug: they never showed as in transit)', async () => {
    const air = await ho
      .post('/shipments', {
        route: 'AIR',
        supplierId,
        orderDate: DATE,
        items: [{ itemId: items['Philips Tube Light'], qty: 10, fobPrice: 3 }],
      })
      .expect(201);
    await ho.put(`/shipments/${air.body.data.id}/stages/air_ordered`, { date: DATE }).expect(200);
    const res = await ho.get('/shipments/pipeline').expect(200);
    assert.equal(res.body.data.kpis.count, 2);
    assert.ok(res.body.data.byStage.some((s) => s.key.startsWith('AIR')));
  });

  test('delivery receives stock at landed cost and records short quantities', async () => {
    const stages = [
      'payment',
      'shipment_released',
      'dar_port',
      'transit_kasumbalesa',
      'kasumbalesa',
      'hd_transhipment',
      'transit_lubumbashi',
    ];
    for (const stage of stages) {
      await ho.put(`/shipments/${shipment.id}/stages/${stage}`, { date: DATE }).expect(200);
    }
    const roofing = shipment.items.find((i) => i.itemId === items['Roofing Sheet BG 28']);
    const res = await ho
      .post(`/shipments/${shipment.id}/deliver`, {
        date: DATE,
        receivedBy: 'Store keeper',
        receivedQtys: [{ lineId: roofing.id, qty: 590 }],
      })
      .expect(200);
    const delivered = res.body.data;
    assert.equal(delivered.status, 'delivered');
    assert.equal(delivered.delivery.noteType, 'Short Delivery');
    assert.equal(delivered.delivery.discrepancies[0].diff, -10);

    // Roofing: FOB 2400 + 80% of 1000 charges = 3200 → 5.3333 per sheet
    const line = delivered.items.find((i) => i.id === roofing.id);
    assert.equal(line.unitLandedCost, 5.3333);
    const stock = (await ho.get(`/inventory/balances?itemId=${roofing.itemId}`)).body.data[0];
    assert.equal(stock.qty, 590);
    assert.equal(stock.avgCost, 5.3333);
  });

  test('a supplier payment clears the import clearing account', async () => {
    await ho
      .post(`/shipments/${shipment.id}/payments`, {
        date: DATE,
        amount: 1000,
        kind: 'supplier',
        accountId: acc['Bank Account - USD'],
      })
      .expect(201);
    const ledger = (
      await ho
        .get(`/reports/ledger?accountId=${acc['Import Clearing (Goods Received)']}`)
        .expect(200)
    ).body.data;
    assert.equal(ledger.entries.length, 2);
    assert.equal(ledger.entries[1].debit, 1000);
  });

  test('a delivered shipment can no longer be edited', async () => {
    await ho.patch(`/shipments/${shipment.id}`, { notes: 'late change' }).expect(422);
  });
});

describe('HR: staff, advances, payroll, leave', () => {
  let staffId;

  test('salary is hidden from users without payroll rights', async () => {
    const res = await ho
      .post('/hr/staff', { name: 'Jean Mukendi', monthlySalary: 400, allowances: 50 })
      .expect(201);
    staffId = res.body.data.id;
    assert.equal(res.body.data.staffNo, 'EMP-0001');
    assert.equal(res.body.data.monthlySalary, 400);

    const manager = await t.createUser(admin, {
      roleKey: 'branch_manager',
      email: 'hr-mgr@test.local',
      branchIds: [t.branch('HO')],
    });
    const seen = await t.api(manager).get(`/hr/staff/${staffId}`).expect(200);
    assert.equal(seen.body.data.monthlySalary, undefined);
  });

  test('an advance is paid and later recovered through payroll', async () => {
    await ho
      .post('/hr/salary-advances', {
        staffId,
        date: DATE,
        amount: 100,
        paymentAccountId: acc['Cash HO $'],
      })
      .expect(201);

    const draft = await ho.post('/hr/payroll-runs', { period: '2026-11' }).expect(201);
    const line = draft.body.data.lines[0];
    assert.equal(line.gross, 450);
    assert.equal(line.advanceRecovery, 100);
    assert.equal(line.net, 350);

    await ho.post('/hr/payroll-runs', { period: '2026-11' }).expect(409); // one per month

    const posted = await ho
      .post(`/hr/payroll-runs/${draft.body.data.id}/post`, {
        date: DATE,
        paymentAccountId: acc['Cash HO $'],
      })
      .expect(200);
    assert.equal(posted.body.data.status, 'posted');
    const voucher = (await ho.get(`/vouchers/${posted.body.data.voucherId}`)).body.data;
    assert.equal(voucher.totalDebit, 450);

    const advances = (await ho.get('/hr/salary-advances').expect(200)).body.data;
    assert.equal(advances[0].status, 'recovered');
  });

  test('leave: request, overlap check, approval', async () => {
    const type = await t
      .api(admin)
      .post('/leave-types', { name: 'Annual Leave', daysPerYear: 20 })
      .expect(201);
    const req = await ho
      .post('/hr/leave-requests', {
        staffId,
        leaveTypeId: type.body.data.id,
        fromDate: '2026-12-01',
        toDate: '2026-12-05',
      })
      .expect(201);
    assert.equal(req.body.data.days, 5);
    await ho
      .post('/hr/leave-requests', {
        staffId,
        leaveTypeId: type.body.data.id,
        fromDate: '2026-12-04',
        toDate: '2026-12-08',
      })
      .expect(409);
    const approved = await ho
      .post(`/hr/leave-requests/${req.body.data.id}/approve`, {})
      .expect(200);
    assert.equal(approved.body.data.status, 'approved');
  });

  test('attendance sheet and monthly summary', async () => {
    await ho
      .put('/hr/attendance', {
        date: DATE,
        records: [{ staffId, status: 'present', checkIn: '08:00' }],
      })
      .expect(200);
    const res = await ho.get('/hr/attendance/monthly?month=2026-11').expect(200);
    assert.equal(res.body.data[0].present, 1);
  });
});

test('after all of this, the books still balance', async () => {
  const tb = (await t.api(admin).get('/reports/trial-balance').expect(200)).body.data;
  const bs = (await t.api(admin).get('/reports/balance-sheet').expect(200)).body.data;
  assert.equal(tb.isBalanced, true);
  assert.equal(bs.isBalanced, true);
});
