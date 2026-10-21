# ResumePilot AI

An AI-assisted career toolkit for students and early-career professionals:
build a resume, check it against a job, then use the rest of the toolkit to
apply, get found, practise and show your work.

## What it does

**Resume**
- **AI Resume Builder** — a one-question-at-a-time interview (typed or spoken)
  with a live preview, an editor, six ATS-friendly templates and real-text PDF export.
- **Resume Analyzer** — upload a resume (PDF/DOCX) and a job description. You get
  a breakdown of what the job asks for, six scores (overall, skills, project
  relevance, experience, education, ATS format), missing keywords, weak bullet
  points, formatting issues, priority recommendations, and AI rewrite suggestions
  you can accept and download as an improved PDF.

**Career tools**
- **Cover Letter Generator** — a tailored letter from your resume and a job
  description. Uses only facts from your resume. Edit, copy, download as PDF, save.
- **LinkedIn Optimisation** — headline options, an About section, skills to list,
  project/experience descriptions, a profile checklist, and feedback on your
  current headline/About.
- **Mock Interviews + Interview Feedback** — questions tailored to your role and
  resume (HR, behavioural, technical, project). Answer by typing or speaking.
  Every answer is scored (content, structure, specific detail, clarity) with
  feedback, a model structure and an optional AI coach note. A final report gives
  an overall score, strengths, areas to improve and a practice plan. History is
  saved for logged-in users.
- **Portfolio Builder** — turn your resume into a personal website. Edit it with a
  live preview, pick a theme, download it as one HTML file, or publish it at
  `http://localhost:5000/p/your-name`.

**Account:** register/login, a dashboard with saved resumes, analysis reports,
cover letters, portfolios and interview feedback, and autosave.

## How the analysis works (honestly)

Scores, skill matching, formatting checks, interview scoring and recommendations
are all **calculated in code** from your text, so they are repeatable and
explainable. A local AI model (Ollama) is used **only to polish wording**
(rewrites, letters, headlines, coach notes). Its output is rejected if it invents
numbers or technologies that aren't in your own resume or answer. If Ollama isn't
running, everything still works, using calculated results and templates.

Limits: rule-based matching knows common technical and professional skills;
unusual terms may be missed. Text-only analysis can't see visual layout
(columns, tables, images).

## Architecture

```
Browser (React + Vite)
   └─ Web Speech API: voice input and spoken replies (Chrome / Edge)
        │
        ▼
Express backend (Node.js)
   ├─ auth: bcrypt + JWT, SQLite (better-sqlite3)
   ├─ resumeAnalysis.js   resume parsing, job analysis, scoring
   ├─ careerTools.js      resume profile, cover letter, LinkedIn
   ├─ interviewEngine.js  question bank, answer scoring, report
   ├─ portfolioTools.js   portfolio data + safe HTML generator
   ├─ pdf-parse / mammoth text extraction, multer uploads
   └─ Ollama (optional, local): wording polish only
```

## Project structure

```
backend/
  server.js  db.js  resumeAnalysis.js  careerTools.js
  interviewEngine.js  portfolioTools.js  .env  resumepilot.db (auto-created)
frontend/src/
  App.jsx  App.css  resumePdf.js  toolsApi.js  ResumeSource.jsx
  spokenLanguage.js   (voice-interview language helpers)
  pages/
    Login  Dashboard  ConversationMode  CreateResume  AnalyzeResume
    CareerTools  CoverLetter  LinkedInOptimizer  MockInterview  PortfolioBuilder
```

## Setup

Prerequisites: Node.js, and (optional) [Ollama](https://ollama.com) with a model:
`ollama pull llama3:8b`.

Backend:
```
cd backend
npm install
```
Create `backend/.env`:
```
PORT=5000
JWT_SECRET=<a long random string>
```
Optional: `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL`
(default `llama3:8b`). Start with `node server.js`.

Frontend:
```
cd frontend
npm install
npm run dev
```
Open the address Vite prints (normally http://localhost:5173).

## API (summary)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | — | Account |
| GET | `/api/auth/me` | required | Current user |
| GET/POST/PUT/DELETE | `/api/resumes[/:id]` | required | Saved resumes |
| POST | `/api/analyze-resume` | optional | Analyze a resume against a job (saves a report if logged in) |
| GET | `/api/analysis-reports` | required | Past analyses |
| POST | `/api/cover-letter` | optional | Generate a cover letter |
| GET/POST/DELETE | `/api/cover-letters[/:id]` | required | Saved letters |
| POST | `/api/linkedin-optimize` | optional | LinkedIn plan |
| POST | `/api/interviews/questions` | optional | Build interview questions |
| POST | `/api/interviews/evaluate` | — | Score one answer |
| POST | `/api/interviews/coach` | — | Optional AI coach note |
| POST | `/api/interviews/finish` | optional | Final report (saved if logged in) |
| GET/DELETE | `/api/interviews[/:id]` | required | Interview history |
| POST | `/api/portfolio/from-resume`, `/api/portfolio/render` | optional / — | Portfolio data and HTML |
| GET/POST/PUT/DELETE | `/api/portfolios[/:id]` | required | Saved portfolios |
| GET | `/p/:slug` | public | A published portfolio page |

Tools that take a resume accept a saved resume (`resumeId`), an uploaded file
(`resume`), or pasted text (`resumeText`).

## Security notes

Passwords are hashed with bcrypt. Published portfolios are generated from
sanitised data with every value escaped and are served with a locked-down
Content-Security-Policy. Keep `JWT_SECRET` private and never commit `.env`.

## Known limitations

- Voice features need Chrome or Edge (Firefox has no Web Speech API).
- The resume autosave draft uses a single local slot.
- Phase 1 excludes payments, a recruiter dashboard, job tracking and a mobile app.
