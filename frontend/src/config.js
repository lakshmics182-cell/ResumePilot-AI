
/*
 * Central backend configuration for local and deployed use.
 */
export const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  "https://resumepilot-ai-1.onrender.com"
).replace(/\/+$/, "");

export const API_BASE = `${API_ORIGIN}/api`;
