import { ApiError } from '#shared/utils/ApiError.js';
import { authService } from './auth.service.js';

// Reads "Authorization: Bearer <token>" and puts the logged-in user on req.user.
export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Please log in'));
  }
  req.user = await authService.verify(token);
  next();
}
