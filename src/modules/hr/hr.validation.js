import { z } from 'zod';
import {
  activeFilter,
  amount,
  dateRange,
  dateString,
  email,
  listQuery,
  longText,
  name,
  objectId,
  periodString,
  positiveAmount,
  shortText,
} from '#shared/utils/schemas.js';
import { ATTENDANCE_STATUS } from './hr.models.js';

// ── Staff ─────────────────────────────────────────────────────────────────────
export const createStaffSchema = z
  .object({
    name,
    branchId: objectId.optional(),
    designation: shortText.optional(),
    department: shortText.optional(),
    phone: shortText.optional(),
    email: email.optional(),
    joinDate: dateString.optional(),
    monthlySalary: amount.optional(),
    allowances: amount.optional(),
    bankAccount: shortText.optional(),
    nationalId: shortText.optional(),
  })
  .strict();

export const updateStaffSchema = createStaffSchema.partial();

export const listStaffSchema = listQuery.extend({
  isActive: activeFilter,
  branchId: objectId.optional(),
  department: shortText.optional(),
});

// ── Attendance ────────────────────────────────────────────────────────────────
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const attendanceSchema = z
  .object({
    date: dateString,
    branchId: objectId.optional(),
    records: z
      .array(
        z
          .object({
            staffId: objectId,
            status: z.enum(ATTENDANCE_STATUS),
            checkIn: time.optional(),
            checkOut: time.optional(),
            note: shortText.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

export const attendanceQuery = listQuery.extend({ branchId: objectId.optional(), ...dateRange });

export const monthlyAttendanceQuery = z.object({
  month: periodString,
  branchId: objectId.optional(),
});

// ── Leave ─────────────────────────────────────────────────────────────────────
export const leaveSchema = z
  .object({
    staffId: objectId,
    leaveTypeId: objectId,
    fromDate: dateString,
    toDate: dateString,
    reason: longText.optional(),
  })
  .strict()
  .refine((v) => v.fromDate <= v.toDate, {
    message: 'End date is before start date',
    path: ['toDate'],
  });

export const leaveQuery = listQuery.extend({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  staffId: objectId.optional(),
});

export const decisionSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

// ── Advances & payroll ───────────────────────────────────────────────────────
export const advanceSchema = z
  .object({
    staffId: objectId,
    date: dateString,
    amount: positiveAmount,
    paymentAccountId: objectId,
    notes: longText.optional(),
  })
  .strict();

export const advanceQuery = listQuery.extend({
  status: z.enum(['open', 'recovered']).optional(),
  staffId: objectId.optional(),
});

export const createPayrollSchema = z
  .object({ period: periodString, branchId: objectId.optional() })
  .strict();

export const updatePayrollLinesSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            staffId: objectId,
            allowances: amount.optional(),
            otherDeductions: amount.optional(),
            advanceRecovery: amount.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

export const postPayrollSchema = z
  .object({ date: dateString, paymentAccountId: objectId })
  .strict();

export const payrollQuery = listQuery.extend({
  period: periodString.optional(),
  status: z.enum(['draft', 'posted', 'cancelled']).optional(),
});
