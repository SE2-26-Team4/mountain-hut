/**
 * HTTP helpers shared by the API modules.
 */

export const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
);

/**
 * Request failure with the server's HTTP status and error details.
 * Each API module extends it, so callers can check where an error came from.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   * @param {string} [field] - Form field associated with the error.
   */
  constructor(message, status, code, field) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

/**
 * Creates a request function that includes the session cookie
 * and throws ErrorClass for unsuccessful HTTP responses.
 *
 * @param {new (
 *   message: string,
 *   status: number,
 *   code?: string,
 *   field?: string
 * ) => ApiError} ErrorClass
 * @param {string} fallbackMessage - Used when the response has no error message.
 * @returns {(path: string, options?: RequestInit) => Promise<any>}
 */
export function createRequest(ErrorClass, fallbackMessage) {
  return async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data =
      response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      throw new ErrorClass(
        data?.error?.message ?? fallbackMessage,
        response.status,
        data?.error?.code,
        data?.error?.field,
      );
    }

    return data;
  };
}
