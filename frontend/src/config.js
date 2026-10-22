/*
 * The one place that decides which backend the app talks to.
 *
 *  - Local development: nothing to set; it uses http://localhost:5000
 *  - Deployed site:     set VITE_API_URL to your backend address,
 *                       e.g. https://your-backend.onrender.com
 *
 * Every page imports from here, so the login, dashboard, analyzer
 * and career tools can never end up talking to different servers.
 */
export const API_ORIGIN = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const API_BASE = `${API_ORIGIN}/api`;
