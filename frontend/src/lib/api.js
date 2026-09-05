export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.fitpocket.in";

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, ...rest } = {}) {
  const headers = { ...(rest.headers || {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  auth: {
    register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    me: () => request("/api/auth/me"),
  },
  dashboard: () => request("/api/dashboard"),
  workouts: {
    list: (params = {}) => request(`/api/workouts${qs(params)}`),
    get: (id) => request(`/api/workouts/${id}`),
    create: (payload) => request("/api/workouts", { method: "POST", body: payload }),
    remove: (id) => request(`/api/workouts/${id}`, { method: "DELETE" }),
    exerciseLibrary: (q) => request(`/api/workouts/exercises/library${qs({ q })}`),
  },
  nutrition: {
    logs: (params = {}) => request(`/api/nutrition/logs${qs(params)}`),
    addLog: (payload) => request("/api/nutrition/logs", { method: "POST", body: payload }),
    removeLog: (id) => request(`/api/nutrition/logs/${id}`, { method: "DELETE" }),
    foods: (q) => request(`/api/nutrition/foods${qs({ q })}`),
    summary: (date) => request(`/api/nutrition/summary${qs({ date })}`),
    setTargets: (payload) => request("/api/nutrition/targets", { method: "PUT", body: payload }),
    water: (date) => request(`/api/nutrition/water${qs({ date })}`),
    addWater: (payload) => request("/api/nutrition/water", { method: "POST", body: payload }),
  },
  budget: {
    summary: (month) => request(`/api/budget/summary${qs({ month })}`),
    transactions: (params = {}) => request(`/api/budget/transactions${qs(params)}`),
    addTransaction: (payload) => request("/api/budget/transactions", { method: "POST", body: payload }),
    categories: (kind) => request(`/api/budget/categories${qs({ kind })}`),
  },
  goals: {
    list: (params = {}) => request(`/api/goals${qs(params)}`),
  },
  ai: {
    coachHistory: () => request("/api/ai/coach/history"),
    coach: (message) => request("/api/ai/coach", { method: "POST", body: { message } }),
    scanFood: (image) => request("/api/ai/scan-food", { method: "POST", body: { image } }),
    importPlan: (text) => request("/api/ai/import-plan", { method: "POST", body: { text } }),
  },
};

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}
