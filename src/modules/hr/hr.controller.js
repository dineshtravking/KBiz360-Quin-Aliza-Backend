import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { staffService } from './staff.service.js';
import { attendanceService } from './attendance.service.js';
import { leaveService } from './leave.service.js';
import { payrollService } from './payroll.service.js';

const ctx = (req) => ({ user: req.user, scope: req.scope });
const page = (res, { items, meta }) => res.json(new ApiResponse(items, 'OK', meta));
const ok = (res, data, message, status = 200) =>
  res.status(status).json(new ApiResponse(data, message));

export const hrController = {
  // Staff
  listStaff: async (req, res) => page(res, await staffService.list(req.valid.query, ctx(req))),
  getStaff: async (req, res) => ok(res, await staffService.getById(req.valid.params.id, ctx(req))),
  createStaff: async (req, res) =>
    ok(res, await staffService.create(req.valid.body, ctx(req)), 'Staff member added', 201),
  updateStaff: async (req, res) =>
    ok(
      res,
      await staffService.update(req.valid.params.id, req.valid.body, ctx(req)),
      'Staff member updated',
    ),
  deactivateStaff: async (req, res) =>
    ok(
      res,
      await staffService.setActive(req.valid.params.id, false, ctx(req)),
      'Staff member deactivated',
    ),
  reactivateStaff: async (req, res) =>
    ok(
      res,
      await staffService.setActive(req.valid.params.id, true, ctx(req)),
      'Staff member reactivated',
    ),

  // Attendance
  saveAttendance: async (req, res) =>
    ok(res, await attendanceService.save(req.valid.body, ctx(req)), 'Attendance saved'),
  listAttendance: async (req, res) =>
    page(res, await attendanceService.list(req.valid.query, req.scope)),
  monthlyAttendance: async (req, res) =>
    ok(res, await attendanceService.monthlySummary(req.valid.query, req.scope)),

  // Leave
  listLeave: async (req, res) => page(res, await leaveService.list(req.valid.query, req.scope)),
  createLeave: async (req, res) =>
    ok(res, await leaveService.create(req.valid.body, ctx(req)), 'Leave request submitted', 201),
  approveLeave: async (req, res) =>
    ok(
      res,
      await leaveService.decide(req.valid.params.id, 'approved', req.valid.body.note, ctx(req)),
      'Leave approved',
    ),
  rejectLeave: async (req, res) =>
    ok(
      res,
      await leaveService.decide(req.valid.params.id, 'rejected', req.valid.body.note, ctx(req)),
      'Leave rejected',
    ),
  cancelLeave: async (req, res) =>
    ok(res, await leaveService.cancel(req.valid.params.id, ctx(req)), 'Leave cancelled'),

  // Advances
  listAdvances: async (req, res) =>
    page(res, await payrollService.listAdvances(req.valid.query, req.scope)),
  createAdvance: async (req, res) =>
    ok(
      res,
      await payrollService.createAdvance(req.valid.body, ctx(req)),
      'Salary advance paid',
      201,
    ),

  // Payroll
  listRuns: async (req, res) =>
    page(res, await payrollService.listRuns(req.valid.query, req.scope)),
  getRun: async (req, res) => ok(res, await payrollService.getRun(req.valid.params.id, req.scope)),
  createRun: async (req, res) =>
    ok(res, await payrollService.createRun(req.valid.body, ctx(req)), 'Payroll draft created', 201),
  updateRun: async (req, res) =>
    ok(
      res,
      await payrollService.updateLines(req.valid.params.id, req.valid.body, ctx(req)),
      'Payroll updated',
    ),
  postRun: async (req, res) =>
    ok(
      res,
      await payrollService.postRun(req.valid.params.id, req.valid.body, ctx(req)),
      'Payroll posted',
    ),
  cancelRun: async (req, res) =>
    ok(res, await payrollService.cancelRun(req.valid.params.id, ctx(req)), 'Payroll cancelled'),
};
