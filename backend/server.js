require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const resumeAnalysis = require("./resumeAnalysis");
const careerTools = require("./careerTools");
const interviewEngine = require("./interviewEngine");
const portfolioTools = require("./portfolioTools");
const mailer = require("./mailer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn(
    "⚠️  JWT_SECRET is not set in .env — using an insecure " +
      "development default. Add JWT_SECRET=<a long random string> " +
      "to backend/.env before deploying this anywhere real."
  );
}

const EFFECTIVE_JWT_SECRET =
  JWT_SECRET || "resumepilot-dev-secret-change-me";

// Short, non-reversible tags that identify WHICH key / WHICH server
// start signed a token. Used only to explain "login no longer valid".
const SECRET_ID = crypto
  .createHash("sha256")
  .update(String(JWT_SECRET || "resumepilot-dev-secret-change-me"))
  .digest("hex")
  .slice(0, 6);
const BOOT_ID = crypto.randomBytes(3).toString("hex");

console.log(
  `JWT secret source: ${
    JWT_SECRET ? "backend/.env" : "built-in development default"
  }`
);

/*
 * Verifies the Bearer token on protected routes and attaches
 * the decoded { id, email, name } payload to req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    console.warn(
      `[auth] pid ${process.pid} no token on ${req.method} ${req.originalUrl}`
    );

    return res.status(401).json({
      error: "Please log in to continue.",
    });
  }

  try {
    req.user = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    next();
  } catch (error) {
    console.warn(
      `[auth] pid ${process.pid} key ${SECRET_ID} boot ${BOOT_ID} rejected ${req.method} ${req.originalUrl}: ${error.message}` +
        (error.expiredAt
          ? ` (token expired at ${error.expiredAt.toISOString()}, server time is ${new Date().toISOString()})`
          : "")
    );

    return res.status(401).json({
      error:
        error.name === "TokenExpiredError"
          ? "Your session has expired. Please log in again."
          : "Your login is no longer valid. Please log in again.",
      diag: { key: SECRET_ID, boot: BOOT_ID },
    });
  }
}

/*
 * Like requireAuth, but never blocks the request — it just
 * attaches req.user when a valid token is present. Used for
 * routes (like /api/analyze-resume) that work for anonymous
 * visitors but save extra data for logged-in users.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    try {
      req.user = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    } catch (error) {
      // Invalid/expired token: proceed as anonymous.
    }
  }

  next();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Please enter your full name.",
      });
    }

    if (!email || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(normalizedEmail);

    if (existing) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = db
      .prepare(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
      )
      .run(name.trim(), normalizedEmail, passwordHash);

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: normalizedEmail,
    };

    const token = jwt.sign({ ...user, sid: SECRET_ID, bid: BOOT_ID }, EFFECTIVE_JWT_SECRET, {
      expiresIn: "7d",
    });

    // Confirmation email. It runs in the background so registration is
    // never slowed down or blocked if the email cannot be sent.
    mailer.sendWelcomeEmail(user).catch((mailError) => {
      console.warn(
        `[mail] Could not send the confirmation email to ${user.email}: ${mailError.message}`
      );
    });

    return res.status(201).json({
      token,
      user,
      confirmationEmail: Boolean(mailer.emailProvider()),
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      error: "Unable to create your account right now.",
    });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter your email and password.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const row = db
      .prepare(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?"
      )
      .get(normalizedEmail);

    if (!row) {
      console.log(
        `[login] No user found for email: "${normalizedEmail}"`
      );

      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const passwordMatches = bcrypt.compareSync(
      password,
      row.password_hash
    );

    if (!passwordMatches) {
      console.log(
        `[login] Password mismatch for email: "${normalizedEmail}" ` +
          `(entered password length: ${password.length})`
      );

      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    console.log(
      `[login] Success for email: "${normalizedEmail}"`
    );

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
    };

    const token = jwt.sign({ ...user, sid: SECRET_ID, bid: BOOT_ID }, EFFECTIVE_JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ token, user });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Unable to log in right now.",
    });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

/*
 * ================= RESUMES =================
 * A logged-in user can save, list, load, update and delete
 * their resumes. resume_data is stored as a JSON blob (see
 * the schema note in db.js for why).
 */

app.get("/api/resumes", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, template, created_at, updated_at
       FROM resumes
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(req.user.id);

  return res.json({ resumes: rows });
});

app.get(
  "/api/resumes/:id",
  requireAuth,
  (req, res) => {
    const row = db
      .prepare(
        `SELECT id, title, template, resume_data, created_at, updated_at
         FROM resumes
         WHERE id = ? AND user_id = ?`
      )
      .get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({
        error: "Resume not found.",
      });
    }

    let resumeData;

    try {
      resumeData = JSON.parse(row.resume_data);
    } catch (error) {
      console.error(
        "Corrupt resume_data JSON for resume",
        row.id,
        error
      );

      return res.status(500).json({
        error: "This resume's data is corrupted.",
      });
    }

    return res.json({
      id: row.id,
      title: row.title,
      template: row.template,
      resumeData,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
);

app.post("/api/resumes", requireAuth, (req, res) => {
  const { title, template, resumeData } =
    req.body || {};

  if (!resumeData || typeof resumeData !== "object") {
    return res.status(400).json({
      error: "resumeData is required.",
    });
  }

  const result = db
    .prepare(
      `INSERT INTO resumes (user_id, title, template, resume_data, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(
      req.user.id,
      (title || resumeData.name || "Untitled Resume").trim(),
      template || "classic",
      JSON.stringify(resumeData)
    );

  return res.status(201).json({
    id: result.lastInsertRowid,
  });
});

app.put(
  "/api/resumes/:id",
  requireAuth,
  (req, res) => {
    const existing = db
      .prepare(
        "SELECT id FROM resumes WHERE id = ? AND user_id = ?"
      )
      .get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({
        error: "Resume not found.",
      });
    }

    const { title, template, resumeData } =
      req.body || {};

    if (!resumeData || typeof resumeData !== "object") {
      return res.status(400).json({
        error: "resumeData is required.",
      });
    }

    db.prepare(
      `UPDATE resumes
       SET title = ?, template = ?, resume_data = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      (title || resumeData.name || "Untitled Resume").trim(),
      template || "classic",
      JSON.stringify(resumeData),
      req.params.id,
      req.user.id
    );

    return res.json({ success: true });
  }
);

app.delete(
  "/api/resumes/:id",
  requireAuth,
  (req, res) => {
    const result = db
      .prepare(
        "DELETE FROM resumes WHERE id = ? AND user_id = ?"
      )
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Resume not found.",
      });
    }

    return res.json({ success: true });
  }
);

/*
 * ================= ANALYSIS REPORTS =================
 * Lists a logged-in user's past resume-analysis results,
 * newest first, alongside the job description text used.
 */

app.get(
  "/api/analysis-reports",
  requireAuth,
  (req, res) => {
    const rows = db
      .prepare(
        `SELECT
           ar.id,
           ar.resume_filename,
           ar.match_score,
           ar.skills_match,
           ar.experience_match,
           ar.education_match,
           ar.missing_keywords,
           ar.strengths,
           ar.weaknesses,
           ar.suggestions,
           ar.created_at,
           jd.raw_text AS job_description
         FROM analysis_reports ar
         LEFT JOIN job_descriptions jd
           ON jd.id = ar.job_description_id
         WHERE ar.user_id = ?
         ORDER BY ar.created_at DESC`
      )
      .all(req.user.id);

    const reports = rows.map((row) => ({
      id: row.id,
      resumeFilename: row.resume_filename,
      matchScore: row.match_score,
      skillsMatch: row.skills_match,
      experienceMatch: row.experience_match,
      educationMatch: row.education_match,
      missingKeywords: JSON.parse(
        row.missing_keywords
      ),
      strengths: JSON.parse(row.strengths),
      weaknesses: JSON.parse(row.weaknesses),
      suggestions: JSON.parse(row.suggestions),
      jobDescription: row.job_description,
      createdAt: row.created_at,
    }));

    return res.json({ reports });
  }
);

/*
 * Ollama (especially smaller local models like llama3:8b)
 * often ignores "return only the final content" instructions
 * and prepends a preamble line such as:
 *   "Here is the improved professional summary section:"
 *   "Here's the improved version:"
 *   "Sure! Here is the enhanced content:"
 * This strips that leading line(s) as a safety net on top
 * of the prompt instructions.
 */
function cleanAIResponse(text) {
  if (!text) {
    return text;
  }

  let cleaned = text.trim();

  // Remove a leading preamble line/sentence before the real content.
  const preamblePattern =
    /^(sure[,!]?\s*)?(here('?s| is)\s+(the\s+)?(improved|enhanced|updated|rewritten|final|polished|revised)[^:\n]*[:\n]+)/i;

  cleaned = cleaned.replace(preamblePattern, "").trim();

  // Also strip a lone leading line that just repeats a section
  // name followed by a colon, e.g. "Professional Summary:"
  const sectionLabelPattern =
    /^(professional summary|about|strengths|career goal|skills|education|project|experience|certification|achievement)s?\s*:\s*\n?/i;

  cleaned = cleaned.replace(sectionLabelPattern, "").trim();

  // Strip wrapping quotes some models add around the whole answer.
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/*
 * Extract text from an uploaded resume file.
 * Supports PDF and DOCX. Throws a descriptive error
 * for anything else so the route can return a clean 400.
 */
async function extractResumeText(file) {
  const name = (file.originalname || "").toLowerCase();
  const isPdf =
    file.mimetype === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");

  if (isPdf) {
    const parser = new PDFParse({ data: file.buffer });
    const result = await parser.getText();

    // pdf-parse appends "-- N of M --" page markers; strip them.
    return {
      text: result.text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .trim(),
      pages: result.total || null,
    };
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    });

    return { text: result.value.trim(), pages: null };
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF or DOCX resume."
  );
}

/*
 * Ollama sometimes wraps its JSON answer in markdown code
 * fences, or adds a sentence before/after the JSON object.
 * This pulls out the first valid JSON object it can find.
 */
function extractJSON(text) {
  if (!text) {
    throw new Error("Empty AI response.");
  }

  let cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No JSON object found in AI response.");
  }

  const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);

  return JSON.parse(jsonSlice);
}

app.get("/", (req, res) => {
  res.send("ResumePilot Backend is running successfully!");
});

app.post("/api/enhance-resume", async (req, res) => {
  try {
    const {
      section,
      userText,
      jobTitle,
    } = req.body;

    if (!section || !userText) {
      return res.status(400).json({
        error: "Section and userText are required.",
      });
    }

    const prompt = `
You are an ATS-friendly resume writing assistant.

Target job:
${jobTitle || "Not specified"}

Resume section:
${section}

User's original information:
${userText}

Improve ONLY the information provided by the user.

Rules:
- Preserve the original meaning.
- Do not invent companies.
- Do not invent job titles.
- Do not invent dates.
- Do not invent technologies.
- Do not invent achievements.
- Do not invent statistics or numbers.
- Do not claim experience the user did not mention.
- Correct grammar and spelling.
- Make the wording professional and ATS-friendly.
- Keep the content concise.
- Do not use emojis.
- Do not add a heading.

For projects, experience, certifications and achievements:
Return 2 to 4 concise resume bullet points.

For professional summary:
Return ONE short professional paragraph.

For skills:
Organize only the skills supplied by the user.

CRITICAL OUTPUT RULE:
Do NOT include any introduction, preamble, or lead-in sentence such as
"Here is the improved version", "Here's the improved section",
"Sure, here is...", or anything similar.
Do NOT repeat the section name.
Output ONLY the final resume content itself, starting directly with
the first bullet point or sentence. Nothing before it, nothing after it.
`;

    const rawText = (await callLlm(prompt)).trim();
    const enhancedText = cleanAIResponse(rawText);

    if (!enhancedText) {
      return res.status(502).json({
        error: "The AI service returned empty content.",
      });
    }

    return res.json({
      enhancedText,
    });
  } catch (error) {
    console.error("AI enhancement error:", error.message);

    return res.status(503).json({
      error: "The AI service is not available right now.",
    });
  }
});

/*
 * AI text generation (used only for wording, never for scores).
 *
 * Provider is chosen by environment variables in backend/.env:
 *   GEMINI_API_KEY=...   -> Google Gemini (hosted: works for every user)
 *   (no key)             -> local Ollama (only works on the machine that
 *                           runs Ollama, e.g. your own laptop)
 * Optional: LLM_PROVIDER=gemini | ollama, GEMINI_MODEL, OLLAMA_URL,
 * OLLAMA_MODEL.
 * If the AI is unavailable the app still works with rule-based results.
 */
const LLM_PROVIDER = (
  process.env.LLM_PROVIDER ||
  (process.env.GEMINI_API_KEY ? "gemini" : "ollama")
).toLowerCase();

console.log(`AI provider: ${LLM_PROVIDER}`);

console.log(
  `Email provider: ${
    mailer.emailProvider() ||
    "not configured (confirmation emails are skipped)"
  }`
);

async function callLlm(prompt, { json = false, timeoutMs = 90000 } = {}) {
  // A local model can need minutes on a normal laptop, so Ollama gets a
  // much longer limit (default 5 minutes, change with OLLAMA_TIMEOUT_MS).
  if (LLM_PROVIDER !== "gemini") {
    timeoutMs = Math.max(
      timeoutMs,
      Number(process.env.OLLAMA_TIMEOUT_MS) || 300000
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (LLM_PROVIDER === "gemini") {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set");
      }

      const first = await geminiGenerate(
        currentGeminiModel(),
        prompt,
        json,
        controller.signal
      );

      if (first.ok) {
        return first.text;
      }

      // Model name retired or not available for this key: pick a working
      // one automatically (unless the person chose GEMINI_MODEL).
      if (first.status === 404 && !process.env.GEMINI_MODEL) {
        const alternative = await pickGeminiModel(controller.signal);

        if (alternative && alternative !== currentGeminiModel()) {
          console.warn(
            `[ai] Gemini model "${currentGeminiModel()}" was not found; using "${alternative}" instead.`
          );
          detectedGeminiModel = alternative;

          const second = await geminiGenerate(
            alternative,
            prompt,
            json,
            controller.signal
          );

          if (second.ok) {
            return second.text;
          }

          throw new Error(second.error);
        }
      }

      throw new Error(first.error);
    }

    // Local Ollama
    const first = await ollamaGenerate(
      currentOllamaModel(),
      prompt,
      json,
      controller.signal
    );

    if (first.ok) {
      return first.text;
    }

    // The default model is not installed: use one that is (unless the
    // person chose OLLAMA_MODEL themselves).
    if (first.status === 404 && !process.env.OLLAMA_MODEL) {
      const alternative = await pickOllamaModel(controller.signal);

      if (alternative && alternative !== currentOllamaModel()) {
        console.warn(
          `[ai] Ollama model "${currentOllamaModel()}" is not installed; using "${alternative}" instead.`
        );
        detectedOllamaModel = alternative;

        const second = await ollamaGenerate(
          alternative,
          prompt,
          json,
          controller.signal
        );

        if (second.ok) {
          return second.text;
        }

        throw new Error(second.error);
      }
    }

    throw new Error(first.error);
  } finally {
    clearTimeout(timer);
  }
}


let detectedOllamaModel = null;

function ollamaBaseUrl() {
  return process.env.OLLAMA_URL || "http://127.0.0.1:11434";
}

function currentOllamaModel() {
  return process.env.OLLAMA_MODEL || detectedOllamaModel || "llama3:8b";
}

async function ollamaGenerate(model, prompt, json, signal) {
  const response = await fetch(`${ollamaBaseUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || "30m",
      ...(json ? { format: "json" } : {}),
      options: { temperature: 0.2, num_ctx: 4096 },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 160);
    return {
      ok: false,
      status: response.status,
      error: `Ollama returned ${response.status}: ${detail}`,
    };
  }

  const data = await response.json();

  if (!data.response) {
    return { ok: false, status: 200, error: "Ollama returned no text" };
  }

  return { ok: true, text: data.response };
}

async function listOllamaModels(signal) {
  const response = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return (data.models || []).map((model) => model.name).filter(Boolean);
}

async function pickOllamaModel(signal) {
  const names = (await listOllamaModels(signal)).filter(
    (name) => !/embed|nomic|bge|minilm|clip/i.test(name)
  );

  // Prefer well-known chat models, otherwise anything installed.
  return (
    names.find((name) => /llama|qwen|gemma|mistral|phi/i.test(name)) ||
    names[0] ||
    null
  );
}

let detectedGeminiModel = null;

function currentGeminiModel() {
  return (
    process.env.GEMINI_MODEL || detectedGeminiModel || "gemini-3.5-flash"
  );
}

function geminiBaseUrl() {
  return (
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com"
  );
}

async function geminiGenerate(model, prompt, json, signal) {
  const response = await fetch(
    `${geminiBaseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    return {
      ok: false,
      status: response.status,
      error: `Gemini returned ${response.status}: ${detail}`,
    };
  }

  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return { ok: false, status: 200, error: "Gemini returned no text" };
  }

  return { ok: true, text };
}

// Lists the models this API key can use and picks a "flash" one.
async function listGeminiModels(signal) {
  const response = await fetch(`${geminiBaseUrl()}/v1beta/models?pageSize=100`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
    signal,
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return (data.models || [])
    .filter((model) =>
      (model.supportedGenerationMethods || []).includes("generateContent")
    )
    .map((model) => String(model.name || "").replace(/^models\//, ""))
    .filter(Boolean);
}

async function pickGeminiModel(signal) {
  const names = await listGeminiModels(signal);
  const usable = names.filter(
    (name) => /flash/i.test(name) && !/(image|tts|live|embed|vision|thinking)/i.test(name)
  );

  // Prefer the newest-looking plain "flash" model
  return usable.sort().reverse()[0] || null;
}

function aiHint(provider, message) {
  const text = String(message || "");

  if (provider === "gemini") {
    if (/not set/i.test(text)) return "Add GEMINI_API_KEY to backend/.env (or to Render's Environment tab) and restart the backend.";
    if (/API key not valid|API_KEY_INVALID|\b40[13]\b/i.test(text)) return "The Gemini API key is wrong or not allowed. Create a new key in Google AI Studio and update GEMINI_API_KEY.";
    if (/\b404\b/.test(text)) return "The Gemini model name was not found. Set GEMINI_MODEL to a model shown in Google AI Studio.";
    if (/\b429\b/.test(text)) return "Gemini's free-tier limit was reached. Wait a while or use another key.";
    if (/aborted|timeout/i.test(text)) return "Gemini took too long to answer. Try again.";
    if (/fetch failed|ENOTFOUND|ECONN/i.test(text)) return "The server cannot reach Google. Check the internet connection of the machine running the backend.";
    return "See the error text above and the backend log.";
  }

  if (/fetch failed|ECONN|refused/i.test(text)) return "Ollama is not running at " + (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + ". Start Ollama, or set GEMINI_API_KEY to use Gemini instead.";
  if (/\b404\b/.test(text)) return "Ollama is running but the model is not installed. Run: ollama pull " + (process.env.OLLAMA_MODEL || "llama3:8b");
  if (/aborted|timeout/i.test(text)) return "Ollama took too long (the model may be slow on this computer). Try a smaller model or use Gemini.";
  return "See the error text above and the backend log.";
}

// Open http://localhost:5000/api/ai-status in a browser to test the AI.
app.get("/api/ai-status", async (req, res) => {
  const provider = LLM_PROVIDER;
  const model =
    provider === "gemini"
      ? currentGeminiModel()
      : currentOllamaModel();

  try {
    // The first Ollama answer can take a while: the model is loaded into
    // memory on first use.
    const reply = await callLlm("Reply with the single word OK.", {
      timeoutMs: provider === "ollama" ? 150000 : 30000,
    });

    return res.json({
      ok: true,
      provider,
      model:
        provider === "gemini" ? currentGeminiModel() : currentOllamaModel(),
      reply: String(reply).slice(0, 60),
    });
  } catch (error) {
    return res.json({
      ok: false,
      provider,
      model,
      error: error.message,
      hint: aiHint(provider, error.message),
    });
  }
});

// Same name as before so the other routes keep working unchanged.
async function callOllamaJson(prompt, timeoutMs = 90000) {
  const text = await callLlm(prompt, { json: true, timeoutMs });
  return extractJSON(text);
}

/*
 * Resume analysis.
 *
 * Scores, skill matching, formatting checks and recommendations are
 * all CALCULATED in resumeAnalysis.js. Ollama is only asked to
 * write better wording afterwards; if it isn't running, the
 * analysis is still returned (with aiAvailable: false).
 */
app.post(
  "/api/analyze-resume",
  optionalAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      const { jobDescription } = req.body;

      if (!req.file) {
        return res.status(400).json({
          error: "Please upload a resume file (PDF or DOCX).",
        });
      }

      if (!jobDescription || !jobDescription.trim()) {
        return res.status(400).json({
          error: "Please paste a job description.",
        });
      }

      let extracted;

      try {
        extracted = await extractResumeText(req.file);
      } catch (parseError) {
        console.error("Resume parsing error:", parseError);

        // Only our own, user-friendly message is shown. Errors from the
        // PDF / DOCX libraries stay in the server log.
        return res.status(400).json({
          error: /^Unsupported file type/.test(parseError.message || "")
            ? parseError.message
            : "Could not read the uploaded resume file. Please upload a valid PDF or DOCX file.",
        });
      }

      if (!extracted.text || extracted.text.length < 20) {
        return res.status(400).json({
          error:
            "Could not extract readable text from this resume. Please try a different file.",
        });
      }

      const analysis = resumeAnalysis.analyze({
        resumeText: extracted.text,
        pages: extracted.pages,
        jobDescription: jobDescription.trim(),
      });

      // Optional AI wording help.
      try {
        const llm = await callOllamaJson(
          resumeAnalysis.buildLlmPrompt(analysis)
        );

        resumeAnalysis.applyLlmResult(analysis, llm);
      } catch (aiError) {
        console.warn(
          "AI assist unavailable (analysis still returned):",
          aiError.message
        );
      }

      // Logged-in users get the report saved to their dashboard.
      if (req.user) {
        try {
          const jdResult = db
            .prepare(
              `INSERT INTO job_descriptions (user_id, raw_text)
               VALUES (?, ?)`
            )
            .run(req.user.id, jobDescription.trim());

          const value = (score) =>
            score && score.value !== null ? score.value : 0;

          db.prepare(
            `INSERT INTO analysis_reports (
               user_id, job_description_id, resume_filename,
               match_score, skills_match, experience_match, education_match,
               missing_keywords, strengths, weaknesses, suggestions
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            req.user.id,
            jdResult.lastInsertRowid,
            req.file.originalname || null,
            value(analysis.scores.overall),
            value(analysis.scores.skills),
            value(analysis.scores.experience),
            value(analysis.scores.education),
            JSON.stringify(analysis.missingKeywords),
            JSON.stringify(analysis.strengths),
            JSON.stringify(analysis.weaknesses),
            JSON.stringify(
              analysis.weakBullets
                .filter((bullet) => bullet.suggested)
                .map((bullet) => ({
                  current: bullet.current,
                  suggested: bullet.suggested,
                }))
            )
          );
        } catch (saveError) {
          console.error(
            "Failed to save analysis report:",
            saveError
          );
        }
      }

      delete analysis._internal;

      return res.json(analysis);
    } catch (error) {
      console.error("Resume analysis error:", error);

      return res.status(500).json({
        error: "Unable to analyze the resume right now.",
      });
    }
  }
);


/* ================================================================== */
/* CAREER TOOLS: cover letters, LinkedIn, mock interviews, portfolios */
/* ================================================================== */

/*
 * Every tool can work from a saved resume (resumeId), an uploaded
 * file, or pasted text. Returns a normalised profile, or null when
 * no resume was supplied.
 */
async function resolveProfile(req) {
  const body = req.body || {};

  if (body.resumeId) {
    if (!req.user) {
      const error = new Error("Please log in to use a saved resume.");
      error.status = 401;
      throw error;
    }

    const row = db
      .prepare(
        "SELECT resume_data FROM resumes WHERE id = ? AND user_id = ?"
      )
      .get(body.resumeId, req.user.id);

    if (!row) {
      const error = new Error("Saved resume not found.");
      error.status = 404;
      throw error;
    }

    return careerTools.profileFromBuilder(JSON.parse(row.resume_data));
  }

  if (req.file) {
    let extracted;

    try {
      extracted = await extractResumeText(req.file);
    } catch (parseError) {
      parseError.status = 400;
      throw parseError;
    }

    if (!extracted.text || extracted.text.length < 20) {
      const error = new Error(
        "Could not extract readable text from this resume. Please try a different file."
      );
      error.status = 400;
      throw error;
    }

    return careerTools.profileFromText(extracted.text);
  }

  const text = String(body.resumeText || "").trim();

  if (text.length >= 20) {
    return careerTools.profileFromText(text.slice(0, 20000));
  }

  return null;
}

function sendToolError(res, label, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(`${label} error:`, error);
  }

  return res.status(status).json({
    error:
      status >= 500
        ? `Unable to complete this right now (${label}).`
        : error.message,
  });
}

const NEED_RESUME =
  "Please choose a saved resume, upload a resume file, or paste your resume text.";

/* ---------- cover letter ---------- */

app.post(
  "/api/cover-letter",
  optionalAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      const body = req.body || {};
      const jobDescription = String(body.jobDescription || "");
      const company = String(body.company || "").trim().slice(0, 80);
      const role = String(body.role || "").trim().slice(0, 80);
      const hiringManager = String(body.hiringManager || "").trim().slice(0, 60);
      const tone = ["professional", "enthusiastic", "concise"].includes(body.tone)
        ? body.tone
        : "professional";

      const profile = await resolveProfile(req);

      if (!profile) {
        return res.status(400).json({ error: NEED_RESUME });
      }

      if (!jobDescription.trim() && !role) {
        return res.status(400).json({
          error: "Please paste the job description or enter the role you are applying for.",
        });
      }

      const draft = careerTools.buildCoverLetterDraft(profile, {
        company,
        role,
        tone,
        hiringManager,
        jobDescription,
      });

      let letter = draft.letter;
      let aiAvailable = false;
      let aiReason = "";
      let aiDetail = "";

      const coverPrompt = careerTools.buildCoverLetterPrompt(profile, {
        role: draft.role,
        company,
        tone,
        hiringManager,
        matched: draft.matchedSkills,
      });

      // Two tries: if the AI answers but its letter fails the accuracy
      // checks, it is asked once more. A service problem is not retried.
      for (let attempt = 1; attempt <= 2 && !aiAvailable; attempt += 1) {
        const attemptStarted = Date.now();

        try {
          const llm = await callOllamaJson(coverPrompt);
          const problem = careerTools.coverLetterProblem(
            llm && llm.letter,
            profile,
            tone
          );

          if (!problem) {
            letter = String(llm.letter).replace(/\r/g, "").trim();
            aiAvailable = true;
            aiReason = "";
            aiDetail = "";
          } else {
            aiReason = "rejected";
            aiDetail = problem;
            console.warn(
              `AI cover letter rejected by the accuracy checks (try ${attempt}): ${problem}`
            );

            // A slow model would make a second try take minutes again.
            if (Date.now() - attemptStarted > 45000) {
              break;
            }
          }
        } catch (aiError) {
          aiReason = "unavailable";
          aiDetail = aiError.message;
          console.warn("AI cover letter unavailable:", aiError.message);
          break;
        }
      }

      return res.json({
        letter,
        aiAvailable,
        aiReason,
        aiDetail,
        role: draft.role,
        matchedSkills: draft.matchedSkills,
        missingSkills: draft.missingSkills,
        wordCount: careerTools.words(letter),
      });
    } catch (error) {
      return sendToolError(res, "cover letter", error);
    }
  }
);

app.get("/api/cover-letters", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, company, role, created_at
       FROM cover_letters WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);

  return res.json({ coverLetters: rows });
});

app.get("/api/cover-letters/:id", requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT id, title, company, role, content, created_at
       FROM cover_letters WHERE id = ? AND user_id = ?`
    )
    .get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ error: "Cover letter not found." });
  }

  return res.json(row);
});

app.post("/api/cover-letters", requireAuth, (req, res) => {
  const { title, company, role, content } = req.body || {};

  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: "The cover letter is empty." });
  }

  const result = db
    .prepare(
      `INSERT INTO cover_letters (user_id, title, company, role, content)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      String(title || company || role || "Cover letter").slice(0, 120),
      String(company || "").slice(0, 80),
      String(role || "").slice(0, 80),
      String(content).slice(0, 10000)
    );

  return res.status(201).json({ id: result.lastInsertRowid });
});

app.delete("/api/cover-letters/:id", requireAuth, (req, res) => {
  const result = db
    .prepare("DELETE FROM cover_letters WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Cover letter not found." });
  }

  return res.json({ success: true });
});

/* ---------- LinkedIn optimisation ---------- */

app.post(
  "/api/linkedin-optimize",
  optionalAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      const body = req.body || {};
      const targetRole = String(body.targetRole || "").trim().slice(0, 80);

      if (!targetRole) {
        return res.status(400).json({
          error: "Please enter the role you are targeting.",
        });
      }

      const profile = await resolveProfile(req);

      if (!profile) {
        return res.status(400).json({ error: NEED_RESUME });
      }

      const plan = careerTools.buildLinkedInPlan(profile, {
        targetRole,
        jobDescription: String(body.jobDescription || ""),
        currentHeadline: String(body.currentHeadline || "").slice(0, 400),
        currentAbout: String(body.currentAbout || "").slice(0, 6000),
      });

      try {
        const llm = await callOllamaJson(
          careerTools.buildLinkedInPrompt(profile, plan)
        );

        careerTools.applyLinkedInAi(plan, profile, llm);
      } catch (aiError) {
        console.warn("AI LinkedIn polish unavailable:", aiError.message);
      }

      return res.json(plan);
    } catch (error) {
      return sendToolError(res, "LinkedIn", error);
    }
  }
);

/* ---------- mock interviews + interview feedback ---------- */

app.post(
  "/api/interviews/questions",
  optionalAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      const body = req.body || {};
      const role = String(body.role || "").trim().slice(0, 80);
      const profile = await resolveProfile(req);

      const jd = body.jobDescription
        ? resumeAnalysis.analyzeJobDescription(String(body.jobDescription))
        : null;

      const skills = careerTools.unique([
        ...(profile ? profile.skills : []),
        ...careerTools.roleSkillsFor(role),
        ...(jd
          ? jd.requiredSkills.filter((name) => !jd.phraseNames.has(name))
          : []),
      ]);

      const questions = interviewEngine.buildQuestions({
        role,
        level: ["fresher", "experienced"].includes(body.level)
          ? body.level
          : "fresher",
        type: ["hr", "technical", "mixed"].includes(body.type)
          ? body.type
          : "mixed",
        count: Number(body.count) || 5,
        skills,
        projects: profile
          ? [...profile.projects, ...profile.experience]
          : [],
      });

      return res.json({
        questions,
        usedResume: Boolean(profile),
        skills: skills.slice(0, 10),
      });
    } catch (error) {
      return sendToolError(res, "interview questions", error);
    }
  }
);

function readQuestion(raw) {
  const question = raw && typeof raw === "object" ? raw : {};

  return {
    id: String(question.id || "custom").slice(0, 40),
    category: String(question.category || "HR").slice(0, 20),
    text: String(question.text || "").slice(0, 500),
    topic: String(question.topic || "").slice(0, 60),
    tip: String(question.tip || "").slice(0, 300),
    expectedPoints: (Array.isArray(question.expectedPoints)
      ? question.expectedPoints
      : []
    )
      .slice(0, 6)
      .map((point) => String(point).slice(0, 140)),
  };
}

app.post("/api/interviews/evaluate", (req, res) => {
  const body = req.body || {};
  const question = readQuestion(body.question);
  const answer = String(body.answer || "").slice(0, 6000);

  if (!question.text) {
    return res.status(400).json({ error: "Missing question." });
  }

  return res.json({
    evaluation: interviewEngine.analyzeAnswer({ question, answer }),
  });
});

app.post("/api/interviews/coach", async (req, res) => {
  const body = req.body || {};
  const question = readQuestion(body.question);
  const answer = String(body.answer || "").slice(0, 6000);

  if (!question.text || answer.trim().split(/\s+/).length < 8) {
    return res.json({ aiAvailable: false });
  }

  const evaluation = interviewEngine.analyzeAnswer({ question, answer });

  try {
    const llm = await callOllamaJson(
      interviewEngine.buildCoachPrompt({
        question,
        answer,
        evaluation,
        role: String(body.role || "").slice(0, 80),
      }),
      60000
    );

    const coach = interviewEngine.validateCoach(llm, answer);

    return res.json(
      coach ? { aiAvailable: true, ...coach } : { aiAvailable: false }
    );
  } catch (error) {
    return res.json({ aiAvailable: false });
  }
});

app.post("/api/interviews/finish", optionalAuth, (req, res) => {
  const body = req.body || {};
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 12) : [];

  if (!rawItems.length) {
    return res.status(400).json({ error: "No answers to review." });
  }

  // Re-score on the server so the report can't be faked by the client.
  const items = rawItems.map((raw) => {
    const question = readQuestion(raw && raw.question);
    const answer = String((raw && raw.answer) || "").slice(0, 6000);

    return {
      question,
      answer,
      evaluation: answer.trim()
        ? interviewEngine.analyzeAnswer({ question, answer })
        : null,
      coach: String((raw && raw.coach) || "").slice(0, 500),
      improved: String((raw && raw.improved) || "").slice(0, 1200),
    };
  });

  const summary = interviewEngine.summarize(items);

  let id = null;

  if (req.user) {
    try {
      const result = db
        .prepare(
          `INSERT INTO interview_sessions
             (user_id, role, level, interview_type, overall_score, summary, items)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user.id,
          String(body.role || "").slice(0, 80),
          String(body.level || "").slice(0, 20),
          String(body.type || "").slice(0, 20),
          summary.overall,
          JSON.stringify(summary),
          JSON.stringify(items)
        );

      id = result.lastInsertRowid;
    } catch (saveError) {
      console.error("Failed to save interview session:", saveError);
    }
  }

  return res.json({ summary, items, id });
});

app.get("/api/interviews", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, role, level, interview_type, overall_score, created_at
       FROM interview_sessions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);

  return res.json({
    sessions: rows.map((row) => ({
      id: row.id,
      role: row.role,
      level: row.level,
      type: row.interview_type,
      overallScore: row.overall_score,
      createdAt: row.created_at,
    })),
  });
});

app.get("/api/interviews/:id", requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?`
    )
    .get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ error: "Interview not found." });
  }

  return res.json({
    id: row.id,
    role: row.role,
    level: row.level,
    type: row.interview_type,
    overallScore: row.overall_score,
    createdAt: row.created_at,
    summary: JSON.parse(row.summary),
    items: JSON.parse(row.items),
  });
});

app.delete("/api/interviews/:id", requireAuth, (req, res) => {
  const result = db
    .prepare("DELETE FROM interview_sessions WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Interview not found." });
  }

  return res.json({ success: true });
});

/* ---------- portfolio builder ---------- */

app.post(
  "/api/portfolio/from-resume",
  optionalAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      const profile = await resolveProfile(req);

      if (!profile) {
        return res.status(400).json({ error: NEED_RESUME });
      }

      return res.json({
        data: portfolioTools.sanitizePortfolioData(
          portfolioTools.portfolioDataFromProfile(profile)
        ),
        themes: Object.entries(portfolioTools.THEMES).map(([id, theme]) => ({
          id,
          label: theme.label,
          accent: theme.accent,
        })),
      });
    } catch (error) {
      return sendToolError(res, "portfolio", error);
    }
  }
);

app.post("/api/portfolio/render", (req, res) => {
  const body = req.body || {};

  return res.json({
    html: portfolioTools.renderPortfolioHtml({
      ...(body.data || {}),
      theme: (body.data && body.data.theme) || body.theme,
    }),
  });
});

function portfolioRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    theme: row.theme,
    isPublic: Boolean(row.is_public),
    updatedAt: row.updated_at,
    url: `/p/${row.slug}`,
  };
}

app.get("/api/portfolios", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, slug, theme, is_public, updated_at
       FROM portfolios WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(req.user.id);

  return res.json({ portfolios: rows.map(portfolioRow) });
});

app.get("/api/portfolios/:id", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM portfolios WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ error: "Portfolio not found." });
  }

  return res.json({
    ...portfolioRow(row),
    data: { ...JSON.parse(row.data), theme: row.theme },
  });
});

function uniqueSlug(name) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = `${portfolioTools.slugify(name)}-${crypto
      .randomBytes(2)
      .toString("hex")}`;

    if (!db.prepare("SELECT 1 FROM portfolios WHERE slug = ?").get(slug)) {
      return slug;
    }
  }

  return `${portfolioTools.slugify(name)}-${crypto
    .randomBytes(5)
    .toString("hex")}`;
}

app.post("/api/portfolios", requireAuth, (req, res) => {
  const body = req.body || {};
  const data = portfolioTools.sanitizePortfolioData(body.data);

  const result = db
    .prepare(
      `INSERT INTO portfolios (user_id, title, slug, theme, data, is_public)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      String(body.title || data.name).slice(0, 120),
      uniqueSlug(data.name),
      data.theme,
      JSON.stringify(data),
      body.isPublic ? 1 : 0
    );

  const row = db
    .prepare("SELECT * FROM portfolios WHERE id = ?")
    .get(result.lastInsertRowid);

  return res.status(201).json(portfolioRow(row));
});

app.put("/api/portfolios/:id", requireAuth, (req, res) => {
  const existing = db
    .prepare("SELECT * FROM portfolios WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: "Portfolio not found." });
  }

  const body = req.body || {};
  const data = portfolioTools.sanitizePortfolioData(body.data);

  db.prepare(
    `UPDATE portfolios
     SET title = ?, theme = ?, data = ?, is_public = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(
    String(body.title || data.name).slice(0, 120),
    data.theme,
    JSON.stringify(data),
    body.isPublic ? 1 : 0,
    req.params.id,
    req.user.id
  );

  return res.json(
    portfolioRow(
      db.prepare("SELECT * FROM portfolios WHERE id = ?").get(req.params.id)
    )
  );
});

app.delete("/api/portfolios/:id", requireAuth, (req, res) => {
  const result = db
    .prepare("DELETE FROM portfolios WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Portfolio not found." });
  }

  return res.json({ success: true });
});

/*
 * Public page for a published portfolio. The HTML is generated from
 * sanitised data and served with a locked-down policy.
 */
app.get("/p/:slug", (req, res) => {
  const row = db
    .prepare(
      "SELECT data, theme FROM portfolios WHERE slug = ? AND is_public = 1"
    )
    .get(req.params.slug);

  if (!row) {
    return res
      .status(404)
      .type("html")
      .send("<h1>Portfolio not found</h1><p>This page doesn't exist or isn't published.</p>");
  }

  res.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"
  );
  res.set("X-Content-Type-Options", "nosniff");

  return res
    .type("html")
    .send(
      portfolioTools.renderPortfolioHtml({
        ...JSON.parse(row.data),
        theme: row.theme,
      })
    );
});

/*
 * Error handler: upload and request problems get a clear message
 * (instead of a blank "500" page).
 */
app.use((error, req, res, next) => {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "The file is too large. Please upload a resume under 10 MB.",
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: "The file could not be uploaded. Please try again.",
    });
  }

  if (error && error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The request data was not valid." });
  }

  if (error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "The data sent was too large." });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    error: "Something went wrong. Please try again.",
  });
});

async function aiSelfTest() {
  const started = Date.now();

  try {
    console.log(
      `[ai] Testing the AI (${LLM_PROVIDER}). The first answer can take a minute while the model loads...`
    );

    await callLlm("Reply with the single word OK.", {
      timeoutMs: LLM_PROVIDER === "ollama" ? 180000 : 30000,
    });

    const used =
      LLM_PROVIDER === "gemini" ? currentGeminiModel() : currentOllamaModel();

    const seconds = (Date.now() - started) / 1000;

    console.log(
      `[ai] AI is working: ${LLM_PROVIDER} model "${used}" answered in ${seconds.toFixed(
        1
      )}s`
    );

    if (
      LLM_PROVIDER === "ollama" &&
      seconds > (Number(process.env.AI_SLOW_TIP_SECONDS) || 45)
    ) {
      console.warn(
        "[ai] This computer is slow with this model, so AI features can take a few minutes."
      );
      console.warn(
        "[ai] Faster options: run  ollama pull llama3.2:3b  and add OLLAMA_MODEL=llama3.2:3b to backend/.env,"
      );
      console.warn(
        "[ai] or add GEMINI_API_KEY=your_key to backend/.env to use Gemini (no local model needed)."
      );
    }
  } catch (error) {
    console.warn(`[ai] AI is NOT working: ${error.message}`);
    console.warn(`[ai] What to do: ${aiHint(LLM_PROVIDER, error.message)}`);

    if (LLM_PROVIDER === "ollama") {
      try {
        const installed = await listOllamaModels(AbortSignal.timeout(5000));
        console.warn(
          `[ai] Ollama is reachable. Installed models: ${
            installed.length ? installed.join(", ") : "none"
          }`
        );
      } catch {
        console.warn(
          `[ai] Ollama is not reachable at ${ollamaBaseUrl()} (start it, then restart this server).`
        );
      }
    }
  }
}

app.listen(PORT, () => {
  console.log(
    `ResumePilot Backend running on http://localhost:${PORT} (pid ${process.pid})`
  );

  // Runs in the background; it never blocks the server.
  aiSelfTest();
});