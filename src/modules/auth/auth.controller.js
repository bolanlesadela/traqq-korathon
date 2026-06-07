import { apiResponse } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

/**
 * Controllers are intentionally thin.
 * They: extract input → call service → format response.
 * Business logic lives in the service, not here.
 */

export async function register(req, res) {
  const { full_name, email, password, business_name } = req.body;
  const userAgent = req.headers['user-agent'];

  const result = await authService.registerVendor({
    full_name,
    email,
    password,
    business_name,
    userAgent,
  });

  return apiResponse.success(res, {
    message: 'Account created successfully',
    data: {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
    statusCode: 201,
  });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'];

  const result = await authService.loginVendor({ email, password, userAgent });

  return apiResponse.success(res, {
    message: 'Login successful',
    data: {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
  });
}

export async function refresh(req, res) {
  const { refresh_token } = req.body;
  const userAgent = req.headers['user-agent'];

  const result = await authService.refreshAccessToken({
    rawToken: refresh_token,
    userAgent,
  });

  return apiResponse.success(res, {
    message: 'Token refreshed',
    data: result,
  });
}

export async function logout(req, res) {
  const { refresh_token } = req.body;

  await authService.logoutVendor({ rawToken: refresh_token });

  return apiResponse.success(res, {
    message: 'Logged out successfully',
  });
}

export async function getMe(req, res) {
  // req.user is set by the auth middleware
  const vendor = await authService.getVendorProfile(req.user.id);

  return apiResponse.success(res, {
    message: 'Profile fetched',
    data: { user: vendor },
  });
}

export async function updateLink(req, res) {
  const { korapay_link } = req.body;

  const updated = await authService.updateKorapayLink({
    vendorId: req.user.id,
    korapay_link,
  });

  return apiResponse.success(res, {
    message: 'Payment link updated',
    data: updated,
  });
}
