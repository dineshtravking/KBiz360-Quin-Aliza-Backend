import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { settingService } from './setting.service.js';

export const settingController = {
  async get(req, res) {
    res.json(new ApiResponse(await settingService.get()));
  },
  async updateFx(req, res) {
    res.json(
      new ApiResponse(
        await settingService.updateFx(req.valid.body, req.user),
        'Exchange rates updated',
      ),
    );
  },
  async updateFinancialYear(req, res) {
    const settings = await settingService.updateFinancialYear(req.valid.body, req.user);
    res.json(new ApiResponse(settings, 'Financial year updated'));
  },
  async updateTax(req, res) {
    res.json(
      new ApiResponse(
        await settingService.updateTax(req.valid.body, req.user),
        'Tax settings updated',
      ),
    );
  },
  async updateInventory(req, res) {
    const settings = await settingService.updateInventory(req.valid.body, req.user);
    res.json(new ApiResponse(settings, 'Inventory settings updated'));
  },
  async lockPeriod(req, res) {
    const { period } = req.valid.params;
    res.json(
      new ApiResponse(await settingService.lockPeriod(period, req.user), `Period ${period} locked`),
    );
  },
  async unlockPeriod(req, res) {
    const { period } = req.valid.params;
    res.json(
      new ApiResponse(
        await settingService.unlockPeriod(period, req.user),
        `Period ${period} unlocked`,
      ),
    );
  },
};
