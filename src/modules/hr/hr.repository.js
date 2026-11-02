import { Attendance, LeaveRequest, PayrollRun, SalaryAdvance, Staff } from './hr.models.js';

// Small generic helpers per model, so each service reads the same way.
const crud = (Model) => ({
  find: (filter, { skip, limit, sort }) => Model.find(filter).sort(sort).skip(skip).limit(limit),
  findAll: (filter, session) => Model.find(filter).session(session ?? null),
  count: (filter) => Model.countDocuments(filter),
  findById: (id, session) => Model.findById(id).session(session ?? null),
  findOne: (filter, session) => Model.findOne(filter).session(session ?? null),
  create: (data, session) => new Model(data).save({ session }),
  update: (id, data) =>
    Model.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }),
});

export const staffRepository = crud(Staff);
export const leaveRepository = crud(LeaveRequest);
export const advanceRepository = {
  ...crud(SalaryAdvance),
  addRecovery: (id, amount, status, session) =>
    SalaryAdvance.updateOne(
      { _id: id },
      { $inc: { recoveredAmount: amount }, $set: { status } },
      { session },
    ),
};
export const payrollRepository = crud(PayrollRun);
export const attendanceRepository = {
  ...crud(Attendance),
  upsert: (branchId, date, data) =>
    Attendance.findOneAndUpdate(
      { branchId, date },
      { $set: data },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
      },
    ),
  aggregate: (pipeline) => Attendance.aggregate(pipeline),
};
