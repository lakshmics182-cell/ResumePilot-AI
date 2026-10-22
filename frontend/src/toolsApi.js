/*
 * Small helpers shared by the career-tool pages: talking to the
 * backend, and attaching the chosen resume source to a request.
 */

export const API = "https://resumepilot-ai-1.onrender.com/api";
export const SERVER = "https://resumepilot-ai-1.onrender.com";

export function getToken() {
  return localStorage.getItem("resumepilot_token");
}

export function authHeaders() {
  const token = getToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse(response) {
  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      (data && data.error) ||
        "Something went wrong. Please try again."
    );
  }

  return data;
}

async function send(path, options) {
  let response;

  try {
    response = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error(
      "Can't reach the server. Please check that the backend is running."
    );
  }

  return parse(response);
}

export function apiGet(path) {
  return send(path, { headers: authHeaders() });
}

export function apiSend(path, method, body) {
  return send(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiForm(path, form) {
  return send(path, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
}

/* ---------- resume source (saved / upload / paste / none) ---------- */

export function emptySource(allowNone = false) {
  return {
    mode: allowNone ? "none" : getToken() ? "saved" : "paste",
    resumeId: "",
    file: null,
    text: "",
  };
}

export function appendResumeSource(form, source) {
  if (source.mode === "saved" && source.resumeId) {
    form.set("resumeId", String(source.resumeId));
  } else if (source.mode === "upload" && source.file) {
    form.set("resume", source.file);
  } else if (source.mode === "paste" && source.text.trim()) {
    form.set("resumeText", source.text);
  }
}

export function resumeSourceReady(source, allowNone = false) {
  if (source.mode === "none") {
    return allowNone;
  }

  if (source.mode === "saved") {
    return Boolean(source.resumeId);
  }

  if (source.mode === "upload") {
    return Boolean(source.file);
  }

  return source.text.trim().length >= 20;
}
