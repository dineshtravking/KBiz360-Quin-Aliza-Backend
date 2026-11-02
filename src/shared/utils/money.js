// Money maths is done in integer cents, so 0.1 + 0.2 never becomes 0.30000000000000004.
// Amounts are stored as numbers with 2 decimals; unit costs keep 4 decimals.
// Always use these helpers instead of adding money values with + directly.

const EPSILON = 1e-9;

export function toCents(value) {
  const n = Number(value) || 0;
  return Math.round(n * 100 + (n >= 0 ? EPSILON : -EPSILON));
}

export const fromCents = (cents) => cents / 100;

export const round2 = (value) => fromCents(toCents(value));

export function round4(value) {
  const n = Number(value) || 0;
  return Math.round(n * 10000 + (n >= 0 ? EPSILON : -EPSILON)) / 10000;
}

export const sumMoney = (values) => fromCents(values.reduce((sum, v) => sum + toCents(v), 0));

export const multiply = (qty, price) => round2(Number(qty) * Number(price));

export const isZero = (value) => toCents(value) === 0;
