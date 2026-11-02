import { Router } from 'express';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { requirePermission } from '#shared/middlewares/permission.middleware.js';
import { PERMISSIONS as P } from '#shared/constants/permissions.js';
import { idParams } from '#shared/utils/schemas.js';
import { hrController as c } from './hr.controller.js';
import * as v from './hr.validation.js';

const router = Router();
const canView = requirePermission(P.HR_VIEW);
const canManage = requirePermission(P.HR_MANAGE);
const canApprove = requirePermission(P.HR_APPROVE);
const canPayroll = requirePermission(P.PAYROLL_MANAGE);
const id = validate({ params: idParams });

router.get('/staff', canView, validate({ query: v.listStaffSchema }), c.listStaff);
router.get('/staff/:id', canView, id, c.getStaff);
router.post('/staff', canManage, validate({ body: v.createStaffSchema }), c.createStaff);
router.patch(
  '/staff/:id',
  canManage,
  validate({ params: idParams, body: v.updateStaffSchema }),
  c.updateStaff,
);
router.post('/staff/:id/deactivate', canManage, id, c.deactivateStaff);
router.post('/staff/:id/reactivate', canManage, id, c.reactivateStaff);

router.get('/attendance', canView, validate({ query: v.attendanceQuery }), c.listAttendance);
router.get(
  '/attendance/monthly',
  canView,
  validate({ query: v.monthlyAttendanceQuery }),
  c.monthlyAttendance,
);
router.put('/attendance', canManage, validate({ body: v.attendanceSchema }), c.saveAttendance);

router.get('/leave-requests', canView, validate({ query: v.leaveQuery }), c.listLeave);
router.post('/leave-requests', canManage, validate({ body: v.leaveSchema }), c.createLeave);
router.post(
  '/leave-requests/:id/approve',
  canApprove,
  validate({ params: idParams, body: v.decisionSchema }),
  c.approveLeave,
);
router.post(
  '/leave-requests/:id/reject',
  canApprove,
  validate({ params: idParams, body: v.decisionSchema }),
  c.rejectLeave,
);
router.post('/leave-requests/:id/cancel', canManage, id, c.cancelLeave);

router.get('/salary-advances', canPayroll, validate({ query: v.advanceQuery }), c.listAdvances);
router.post('/salary-advances', canPayroll, validate({ body: v.advanceSchema }), c.createAdvance);

router.get('/payroll-runs', canPayroll, validate({ query: v.payrollQuery }), c.listRuns);
router.get('/payroll-runs/:id', canPayroll, id, c.getRun);
router.post('/payroll-runs', canPayroll, validate({ body: v.createPayrollSchema }), c.createRun);
router.patch(
  '/payroll-runs/:id',
  canPayroll,
  validate({ params: idParams, body: v.updatePayrollLinesSchema }),
  c.updateRun,
);
router.post(
  '/payroll-runs/:id/post',
  canPayroll,
  validate({ params: idParams, body: v.postPayrollSchema }),
  c.postRun,
);
router.post('/payroll-runs/:id/cancel', canPayroll, id, c.cancelRun);

export default router;
