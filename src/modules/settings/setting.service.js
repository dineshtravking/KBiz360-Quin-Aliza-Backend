import { ApiError } from '#shared/utils/ApiError.js';
import { settingRepository } from './setting.repository.js';

const FX_HISTORY_LIMIT = 200;

export const settingService = {
  get: (session) => settingRepository.get(session),

  async getFx(session) {
    const { fx } = await settingRepository.get(session);
    return { cdfAccountingRate: fx.cdfAccountingRate, cdfSalesRate: fx.cdfSalesRate };
  },

  async isPeriodLocked(period, session) {
    const settings = await settingRepository.get(session);
    return settings.lockedPeriods.includes(period);
  },

  async assertPeriodOpen(date, session) {
    const period = date.slice(0, 7);
    if (await settingService.isPeriodLocked(period, session)) {
      throw ApiError.unprocessable(
        `Period ${period} is locked. Nothing can be posted to it. Ask Head Office to unlock it.`,
      );
    }
  },

  async allowNegativeStock(session) {
    const settings = await settingRepository.get(session);
    return settings.inventory.allowNegativeStock;
  },

  updateFx(fx, user) {
    return settingRepository.update({
      $set: { fx, updatedBy: user.id },
      $push: {
        fxHistory: { $each: [{ ...fx, by: user.id, at: new Date() }], $slice: -FX_HISTORY_LIMIT },
      },
    });
  },

  updateFinancialYear(financialYear, user) {
    return settingRepository.update({ $set: { financialYear, updatedBy: user.id } });
  },

  updateTax(tax, user) {
    const set = Object.fromEntries(Object.entries(tax).map(([k, v]) => [`tax.${k}`, v]));
    return settingRepository.update({ $set: { ...set, updatedBy: user.id } });
  },

  updateInventory(inventory, user) {
    return settingRepository.update({ $set: { inventory, updatedBy: user.id } });
  },

  lockPeriod(period, user) {
    return settingRepository.update({
      $addToSet: { lockedPeriods: period },
      $set: { updatedBy: user.id },
    });
  },

  unlockPeriod(period, user) {
    return settingRepository.update({
      $pull: { lockedPeriods: period },
      $set: { updatedBy: user.id },
    });
  },
};
