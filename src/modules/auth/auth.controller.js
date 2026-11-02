import { ApiResponse } from '#shared/utils/ApiResponse.js';
import { authService } from './auth.service.js';

export const authController = {
  async login(req, res) {
    const { email, password } = req.valid.body;
    const result = await authService.login(email, password);
    res.locals.auditUser = result.user; // so the audit log knows who logged in
    res.json(new ApiResponse(result, 'Logged in'));
  },
  async me(req, res) {
    res.json(new ApiResponse(await authService.me(req.user.id)));
  },
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.valid.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(new ApiResponse(result, 'Password changed'));
  },
};
