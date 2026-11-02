import mongoose from 'mongoose';

// Runs `work(session)` inside a MongoDB transaction: every write inside it is
// saved together, or none of them are. MongoDB retries it on temporary conflicts,
// so `work` must only touch the database (no emails, no HTTP calls).
//
// If a caller already has a session (we are inside another transaction),
// pass it in and the work joins that transaction instead of starting a new one.
export async function inTransaction(existingSession, work) {
  if (existingSession) return work(existingSession);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
