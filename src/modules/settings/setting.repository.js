import { Setting } from './setting.model.js';

const KEY = 'global';

export const settingRepository = {
  // Plain read, so posting transactions do not all write to this one document.
  // Creates the document with defaults only the very first time.
  async get(session) {
    const existing = await Setting.findOne({ key: KEY }).session(session ?? null);
    if (existing) return existing;
    return Setting.findOneAndUpdate(
      { key: KEY },
      { $setOnInsert: { key: KEY } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    );
  },

  update: (update) =>
    Setting.findOneAndUpdate({ key: KEY }, update, {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    }),
};
