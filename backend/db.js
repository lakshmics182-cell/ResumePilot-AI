const path = require("path");
const Database = require("better-sqlite3");

/*
 * Simple local SQLite database for ResumePilot.
 * File lives alongside server.js as resumepilot.db
 * (created automatically on first run).
 *
 * Schema follows the PRD's Database Design section:
 * Users -> Resumes -> Job Descriptions -> Analysis Reports,
 * plus a Templates table. Nested resume content (education,
 * projects, experience, etc.) is stored as a single JSON
 * column on `resumes` rather than one row per section — the
 * shape of that content varies per user and per section, and
 * a JSON column keeps the schema simple while still giving a
 * real Users -> Resumes -> Job Descriptions -> Analysis Reports
 * relational chain via foreign keys.
 */
const db = new Database(
  path.join(__dirname, "resumepilot.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Resume',
    template TEXT NOT NULL DEFAULT 'classic',
    resume_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_descriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analysis_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_description_id INTEGER REFERENCES job_descriptions(id) ON DELETE SET NULL,
    resume_filename TEXT,
    match_score INTEGER NOT NULL,
    skills_match INTEGER NOT NULL,
    experience_match INTEGER NOT NULL,
    education_match INTEGER NOT NULL,
    missing_keywords TEXT NOT NULL,
    strengths TEXT NOT NULL,
    weaknesses TEXT NOT NULL,
    suggestions TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cover_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    company TEXT,
    role TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interview_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT,
    level TEXT,
    interview_type TEXT,
    overall_score INTEGER NOT NULL,
    summary TEXT NOT NULL,
    items TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    theme TEXT NOT NULL DEFAULT 'indigo',
    data TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cover_letters_user
    ON cover_letters(user_id);

  CREATE INDEX IF NOT EXISTS idx_interview_sessions_user
    ON interview_sessions(user_id);

  CREATE INDEX IF NOT EXISTS idx_portfolios_user
    ON portfolios(user_id);

  CREATE INDEX IF NOT EXISTS idx_resumes_user
    ON resumes(user_id);

  CREATE INDEX IF NOT EXISTS idx_job_descriptions_user
    ON job_descriptions(user_id);

  CREATE INDEX IF NOT EXISTS idx_analysis_reports_user
    ON analysis_reports(user_id);
`);

// Seed the two Phase 1 templates if the table is empty.
const templateCount = db
  .prepare("SELECT COUNT(*) AS count FROM templates")
  .get().count;

if (templateCount === 0) {
  const insertTemplate = db.prepare(
    "INSERT INTO templates (name) VALUES (?)"
  );

  insertTemplate.run("classic");
  insertTemplate.run("modern");
}

module.exports = db;
