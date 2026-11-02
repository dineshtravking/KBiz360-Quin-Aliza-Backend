import mongoose from 'mongoose';
import { documentSchema, masterSchema, ref, subSchema } from '#shared/db/schema.js';

// ── Staff ─────────────────────────────────────────────────────────────────────
export const Staff = mongoose.model(
  'Staff',
  masterSchema({
    staffNo: { type: String, required: true, unique: true }, // EMP-0001
    name: { type: String, required: true, trim: true },
    branchId: ref('Branch', { required: true, index: true }),
    designation: String,
    department: String,
    phone: String,
    email: String,
    joinDate: String,
    // Sensitive — only shown to users with payroll:manage.
    monthlySalary: { type: Number, default: 0, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    bankAccount: String,
    nationalId: String,
  }),
);

// ── Attendance: one sheet per branch per day ──────────────────────────────────
export const ATTENDANCE_STATUS = ['present', 'absent', 'leave', 'half_day', 'late'];

const attendanceRecordSchema = subSchema({
  staffId: ref('Staff', { required: true }),
  staffName: String,
  status: { type: String, enum: ATTENDANCE_STATUS, required: true },
  checkIn: String,
  checkOut: String,
  note: String,
});

const attendanceSchema = documentSchema({
  date: { type: String, required: true },
  branchId: ref('Branch', { required: true }),
  records: { type: [attendanceRecordSchema], default: [] },
});
attendanceSchema.index({ branchId: 1, date: 1 }, { unique: true });
export const Attendance = mongoose.model('Attendance', attendanceSchema);

// ── Leave requests ───────────────────────────────────────────────────────────
export const LeaveRequest = mongoose.model(
  'LeaveRequest',
  documentSchema({
    requestNo: { type: String, required: true, unique: true },
    staffId: ref('Staff', { required: true, index: true }),
    staffName: String,
    branchId: ref('Branch', { required: true, index: true }),
    leaveTypeId: ref('LeaveType', { required: true }),
    leaveTypeName: String,
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    days: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    decidedBy: ref('User'),
    decidedAt: Date,
    decisionNote: String,
  }),
);

// ── Salary advances ──────────────────────────────────────────────────────────
export const SalaryAdvance = mongoose.model(
  'SalaryAdvance',
  documentSchema({
    advanceNo: { type: String, required: true, unique: true },
    staffId: ref('Staff', { required: true, index: true }),
    staffName: String,
    branchId: ref('Branch', { required: true, index: true }),
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    recoveredAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'recovered'], default: 'open', index: true },
    paymentAccountId: ref('Account'),
    voucherId: ref('Voucher'),
    voucherNo: String,
    notes: String,
  }),
);

// ── Payroll runs: one per branch per month ───────────────────────────────────
const payrollLineSchema = subSchema({
  staffId: ref('Staff', { required: true }),
  staffName: String,
  basic: Number,
  allowances: Number,
  otherDeductions: { type: Number, default: 0 },
  advanceRecovery: { type: Number, default: 0 },
  gross: Number,
  net: Number,
});

export const PayrollRun = mongoose.model(
  'PayrollRun',
  documentSchema({
    runNo: { type: String, required: true, unique: true },
    period: { type: String, required: true }, // YYYY-MM
    branchId: ref('Branch', { required: true, index: true }),
    status: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft', index: true },
    lines: { type: [payrollLineSchema], default: [] },
    totals: { gross: Number, otherDeductions: Number, advanceRecovery: Number, net: Number },
    postedDate: String,
    paymentAccountId: ref('Account'),
    voucherId: ref('Voucher'),
    voucherNo: String,
  }),
);
