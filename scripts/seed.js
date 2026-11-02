// Sets up a database so the API can run. Safe to run many times.
//   npm run seed          → indexes, system accounts, roles, branches, settings, first admin
//   npm run seed -- --demo → also the frontend's sample suppliers, transporters, agents, items
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '#config/env.js';
import { connectDatabase, disconnectDatabase } from '#config/database.js';
import { accountService } from '#modules/accounts/index.js';
import { roleService } from '#modules/roles/index.js';
import { branchService } from '#modules/branches/index.js';
import { settingService } from '#modules/settings/index.js';
import { userService } from '#modules/users/index.js';
import { masterServices } from '#modules/masters/index.js';
import { itemService } from '#modules/items/index.js';
// Loads every model so their indexes are built.
import '#routes/index.js';

// Same branches as the frontend's DEFAULT_BRANCHES.
const BRANCHES = [
  {
    code: 'HO',
    name: 'QA-Head Office',
    shortName: 'Head Office',
    type: 'head_office',
    cargoTypes: ['HD', 'MTL', 'AIR'],
    city: 'Lubumbashi',
  },
  {
    code: 'TXHD',
    name: 'QA-HD Texaco',
    shortName: 'HD Texaco',
    type: 'branch',
    cargoTypes: ['HD'],
    city: 'Lubumbashi',
  },
  {
    code: 'TXMTL',
    name: 'QA-MTL Texaco',
    shortName: 'MTL Texaco',
    type: 'branch',
    cargoTypes: ['MTL'],
    city: 'Lubumbashi',
  },
  {
    code: 'S1',
    name: 'QA-Shop 1',
    shortName: 'Shop 1',
    type: 'shop',
    cargoTypes: ['HD', 'MTL', 'AIR'],
    city: 'Lubumbashi',
  },
  {
    code: 'S2',
    name: 'QA-Shop 2',
    shortName: 'Shop 2',
    type: 'shop',
    cargoTypes: ['HD', 'MTL', 'AIR'],
    city: 'Lubumbashi',
  },
  {
    code: 'S3',
    name: 'QA-Shop 3',
    shortName: 'Shop 3',
    type: 'shop',
    cargoTypes: ['HD', 'MTL', 'AIR'],
    city: 'Lubumbashi',
  },
];

// Sample data from the frontend's seed-data.js.
const DEMO = {
  suppliers: [
    { name: 'Jigar', country: 'China' },
    { name: 'Rohan', country: 'India' },
    { name: 'Zaveri Allana', country: 'Dubai' },
    { name: 'Jinfa', country: 'Zambia' },
    { name: 'GTS', country: 'India' },
    { name: 'Lodhia', country: 'India' },
  ],
  transporters: [
    { name: 'NNS Logistics', country: 'China' },
    { name: 'Honest Logistics', country: 'China' },
  ],
  customAgencies: ['Kalonji Duan', 'Prince Duan', 'Platini Duan', 'Berry Duan'].map((name) => ({
    name,
    country: 'China',
  })),
  items: [
    ['Ferron 10', 'pt_mf', 'India', 'MTR', 'Iron rebar / ferron 10mm'],
    ['Ferron 12', 'pt_mf', 'India', 'MTR', 'Iron rebar / ferron 12mm'],
    ['Ferron 16', 'pt_mf', 'India', 'MTR', 'Iron rebar / ferron 16mm'],
    ['Angle 25', 'pt_mf', 'India', 'MTR', 'Steel angle iron 25mm'],
    ['Angle 30', 'pt_mf', 'India', 'MTR', 'Steel angle iron 30mm'],
    ['Tube 20x20', 'pt_mo', 'China', 'MTR', 'Square hollow tube 20×20mm'],
    ['Tube 40x40', 'pt_mo', 'China', 'MTR', 'Square hollow tube 40×40mm'],
    ['Roofing Sheet BG 28', 'pt_mo', 'China', 'PCS', 'Galvanised roofing sheet gauge 28'],
    ['Roofing Sheet BG 34', 'pt_mo', 'China', 'PCS', 'Galvanised roofing sheet gauge 34'],
    ['National Paint 1LTR', 'pt_hd', 'Dubai', 'PCS', 'National Paint — 1 litre tin'],
    ['Philips Tube Light', 'pt_hd', 'China', 'PCS', 'Philips fluorescent / LED tube light'],
    ['Motor Pump 4HP', 'pt_hd', 'China', 'PCS', 'Water motor pump 4 horsepower'],
    ['Generator 3 KVA', 'pt_hd', 'China', 'PCS', 'Petrol / diesel generator 3 KVA'],
    ['Chair Marriage Red', 'pt_hd', 'China', 'PCS', 'Red plastic wedding / marriage chair'],
  ].map(([name, productType, origin, unit, description]) => ({
    name,
    productType,
    origin,
    unit,
    description,
  })),
};

const isDuplicate = (err) => err?.code === 11000;

async function createIfMissing(create) {
  try {
    await create();
    return 1;
  } catch (err) {
    if (isDuplicate(err)) return 0;
    throw err;
  }
}

// A random password that passes the password rules (letters + digits).
const randomPassword = () => `Qa${crypto.randomBytes(9).toString('base64url')}7`;

export async function seedDatabase({
  adminEmail,
  adminPassword,
  demo = false,
  log = () => {},
} = {}) {
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.syncIndexes();
  }
  log('✓ Indexes');

  await accountService.ensureSystemAccounts();
  log('✓ System accounts');

  const roles = await roleService.ensureBuiltInRoles();
  log('✓ Roles');

  await settingService.get();
  log('✓ Settings');

  const branches = {};
  for (const def of BRANCHES) {
    branches[def.code] =
      (await branchService.findByCode(def.code)) ?? (await branchService.create(def, null));
  }
  log('✓ Branches (with cash accounts, godowns, cost centres)');

  let admin = null;
  const email = adminEmail ?? env.SEED_ADMIN_EMAIL ?? 'admin@quinaliza.local';
  if (!(await userService.findByEmail(email))) {
    const password = adminPassword ?? env.SEED_ADMIN_PASSWORD ?? randomPassword();
    const user = await userService.createInternal({
      name: 'Super Admin',
      email,
      password,
      roleId: roles.super_admin._id,
      branchMode: 'all',
      branchIds: [],
    });
    admin = {
      id: String(user._id),
      email,
      password,
      generated: !adminPassword && !env.SEED_ADMIN_PASSWORD,
    };
    log(`✓ Super Admin created: ${email}`);
  }

  if (demo) {
    let added = 0;
    for (const s of DEMO.suppliers)
      added += await createIfMissing(() => masterServices.suppliers.createInternal(s));
    for (const t of DEMO.transporters)
      added += await createIfMissing(() => masterServices.transporters.createInternal(t));
    for (const a of DEMO.customAgencies)
      added += await createIfMissing(() => masterServices.customAgencies.createInternal(a));
    for (const i of DEMO.items) {
      if (!(await itemService.findByName(i.name)))
        added += await createIfMissing(() => itemService.createInternal(i));
    }
    log(`✓ Demo data (${added} records added)`);
  }

  return { roles, branches, admin };
}

// Run from the command line: npm run seed [-- --demo]
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const log = (message) => console.log(message);
  try {
    await connectDatabase();
    const { admin } = await seedDatabase({ demo: process.argv.includes('--demo'), log });
    if (admin?.generated) {
      console.log(
        `\n  Admin password (shown only once, change it after login): ${admin.password}\n`,
      );
    }
    console.log('Seed finished.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
