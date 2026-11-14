const API = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(status) {
    super(`Request failed: ${status}`);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include", // sends the session cookie
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status);
  return res.status === 204 ? null : res.json();
}