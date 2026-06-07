/**
 * Standard API response utility.
 *
 * Every response from Traqq has this shape:
 * { success: true/false, message: string, data: any, meta: any }
 *
 * Consistency here makes frontend integration and debugging predictable.
 */

export const apiResponse = {
  /**
   * Success response
   * @param {import('express').Response} res
   * @param {object} options
   */
  success(res, { message = 'Success', data = null, meta = null, statusCode = 200 } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta && { meta }),
    });
  },

  /**
   * Error response — never leaks stack traces
   * @param {import('express').Response} res
   * @param {object} options
   */
  error(res, { message = 'Something went wrong', statusCode = 500, errors = null } = {}) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  },
};
