// Every API failure (real or mock) is an ApiError: { status, message }.
// Messages come from the server's `detail` or a generic fallback and never
// include request bodies, so secret values can't leak into the UI or logs.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const FALLBACK = {
  0: "Can't reach the API. Check that the backend is running and VITE_API_URL is correct.",
  400: 'The request was invalid.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: 'Not found.',
  409: 'That conflicts with the current state. Refresh and try again.',
  422: 'Some fields are invalid.',
  500: 'The server hit an error. Try again in a moment.',
};

export function fallbackMessage(status) {
  return FALLBACK[status] || FALLBACK[status >= 500 ? 500 : 400];
}
