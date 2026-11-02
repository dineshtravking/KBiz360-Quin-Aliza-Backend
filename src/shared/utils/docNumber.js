import { monthName } from './dates.js';

// Document number formats. They follow the frontend formats.

const pad = (n, width) => String(n).padStart(width, '0');

// MMYY of a 'YYYY-MM-DD' date, e.g. 2026-11-02 → 1126
const mmyy = (date) => date.slice(5, 7) + date.slice(2, 4);

// CS-00001/S1/1126
export const branchDocNo = (prefix, seq, branchCode, date) =>
  `${prefix}-${pad(seq, 5)}/${branchCode}/${mmyy(date)}`;

// IMPO SEA0001/Nov/2026
export const shipmentNo = (routePrefix, seq, date) =>
  `IMPO ${routePrefix}${pad(seq, 4)}/${monthName(date)}/${date.slice(0, 4)}`;

// PLAN HD 0001/Nov/2026
export const planNo = (route, seq, date) =>
  `PLAN ${route} ${pad(seq, 4)}/${monthName(date)}/${date.slice(0, 4)}`;

// STR-00001/S1-HO/1126
export const transferNo = (seq, fromCode, toCode, date) =>
  `STR-${pad(seq, 5)}/${fromCode}-${toCode}/${mmyy(date)}`;

// IC-HD0001
export const itemCode = (typeCode, seq) => `IC-${typeCode}${pad(seq, 4)}`;

// EMP-0001
export const simpleNo = (prefix, seq, width = 4) => `${prefix}-${pad(seq, width)}`;
