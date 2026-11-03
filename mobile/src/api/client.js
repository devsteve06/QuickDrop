const DEFAULT_TIMEOUT_MS = 12000;

const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

// Trailing slashes would produce `//api/...` paths.
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "api_error" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Fetch wrapper for the QuickDrop API: base URL, JSON headers, error extraction,
 * and an abort-based timeout so a dead server never leaves a screen spinning.
 */
export async function request(
  path,
  { method = "GET", body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}
) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", forwardAbort);
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? null : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (signal?.aborted) {
      throw new ApiError("Request cancelled", { code: "aborted" });
    }
    if (controller.signal.aborted) {
      throw new ApiError(
        `The QuickDrop API took too long to respond. Check that it is running at ${API_BASE_URL}.`,
        { code: "timeout" }
      );
    }
    throw new ApiError(
      `Can't reach the QuickDrop API at ${API_BASE_URL}. Check that the server is running and that EXPO_PUBLIC_API_URL is correct.`,
      { code: "network" }
    );
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", forwardAbort);
  }

  const payload = await readBody(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, { status: response.status });
  }

  return payload;
}

export const api = {
  health: () => request("/api/health"),
  listRestaurants: () => request("/api/restaurants"),
  getRestaurant: (id) => request(`/api/restaurants/${encodeURIComponent(id)}`),
  createOrder: (order) => request("/api/orders", { method: "POST", body: order }),
  payOrder: (id) => request(`/api/orders/${encodeURIComponent(id)}/pay`, { method: "POST" }),
  getOrder: (id) => request(`/api/orders/${encodeURIComponent(id)}`),
};
