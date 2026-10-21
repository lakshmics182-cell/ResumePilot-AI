# ResumePilot AI — Manual Test Plan

A step-by-step checklist to validate the whole app in one pass. Check each
box as you go — if something doesn't match the "Expected" column, that's a
bug report, with everything needed to describe it precisely.

**Before you start:** backend running (`node server.js` in `backend/`),
frontend running (`npm run dev` in `frontend/`), and
[Ollama](https://ollama.com) running locally with a model pulled
(`ollama pull llama3:8b`). Open the app in Chrome or Edge (for voice
features — Firefox doesn't support the Web Speech API).

---

## 1. Auth

| # | Step | Expected |
|---|---|---|
| 1.1 | Go to the home page, click "Create Resume" | Taken to the Login/Register screen |
| 1.2 | Click "Register", fill in name/email/password (6+ chars), submit | Account created, taken straight to the Dashboard |
| 1.3 | Click Logout | Returned to the home page |
| 1.4 | Click "Create Resume" again, log in with the same credentials | Logged in successfully, taken to the Dashboard |
| 1.5 | Try logging in with the wrong password | Clear "Invalid email or password" error, not a crash |
| 1.6 | Try registering the same email twice | "An account with this email already exists" error |
| 1.7 | Refresh the page while logged in | Still logged in — session persists (no need to log in again) |
| 1.8 | On the password field, click "Show" | Password becomes visible as plain text |

## 2. Dashboard

| # | Step | Expected |
|---|---|---|
| 2.1 | Log in with a brand-new account | Dashboard shows "My Resumes" and "Past Resume Analyses" sections, both empty with a friendly empty-state message |
| 2.2 | Click "Create New Resume" | Taken to the Speak/Type choice screen |
| 2.3 | Click "Analyze a Resume" | Taken straight to the resume analyzer (no login required for this path either) |

## 3. Journey A — Text interview

| # | Step | Expected |
|---|---|---|
| 3.1 | From the Dashboard, click "Create New Resume" → "Type" | Chat interview starts, first question appears, live preview panel on the right is empty |
| 3.2 | Answer the name question | Name appears in the live preview header immediately |
| 3.3 | Reach the Education question, answer Yes | You're asked for your first education entry — not a crash/blank page |
| 3.4 | Finish one education entry, say Yes to "another?" | You're prompted for a **second** education entry (this used to silently skip instead) |
| 3.5 | Say No to "another?" | Moves to the next question, keeps both entries you already added |
| 3.6 | Reach the Technical Skills question | Suggestion chips appear; click 3-4 of them | All clicked chips show a checkmark and stay selected (multi-select, not single-select) |
| 3.7 | Reach Projects, answer with a real project description | AI-enhanced bullet points appear in the live preview, no leftover phrase like "Here is the improved version" |
| 3.8 | Reach Languages, select several chips | Same multi-select behavior as skills |
| 3.9 | Check the "Languages Known" line in the preview | Text is left-aligned, not centered |
| 3.10 | Finish all questions | Template selector + action buttons appear (Edit Resume, Save, Download PDF, Start New) |

## 4. Resume Editor

| # | Step | Expected |
|---|---|---|
| 4.1 | Click "✎ Edit Resume" | Name, summary, skills, languages become editable fields; each entry gets ↑ ↓ ✕ controls |
| 4.2 | Edit the professional summary text directly | Live preview updates as you type |
| 4.3 | Click ✕ on a project entry | That entry disappears from the preview |
| 4.4 | Click "+ Add project" | A new blank, editable entry appears — even though you just removed the only one |
| 4.5 | Reorder two entries with ↑ / ↓ | Their order visibly swaps in the preview |
| 4.6 | Click "✓ Done Editing" | Preview returns to read-only display |

## 5. Save / Dashboard round-trip

| # | Step | Expected |
|---|---|---|
| 5.1 | Click "💾 Save to My Resumes" | Button briefly shows "Saving...", then "✓ Saved to your account." |
| 5.2 | Click "← Back to Dashboard" | Your resume now appears under "My Resumes" with the correct title and template |
| 5.3 | Click "Continue Editing" on it | Loads back in with all your data intact, lands straight on the preview (not the chat questions) |
| 5.4 | Make a small edit, click "💾 Save Changes" | Same resume updates in place — doesn't create a duplicate on the Dashboard |
| 5.5 | Go back to Dashboard, click "Delete" on the resume, confirm | Resume disappears from the list |

## 6. PDF export (and the critical round-trip)

| # | Step | Expected |
|---|---|---|
| 6.1 | On a completed resume, click "⬇ Download PDF" | A PDF downloads |
| 6.2 | Open the downloaded PDF | Text is real/selectable (you can highlight and copy it) — not a screenshot image |
| 6.3 | **Go to "Analyze a Resume" and upload that exact PDF** | It should parse successfully and NOT show "Could not extract readable text" — this was a real bug, confirm it stays fixed |

## 7. Autosave

| # | Step | Expected |
|---|---|---|
| 7.1 | Start a new resume, answer 2-3 questions, then refresh the browser tab | Your progress is still there — same answers, same chat history |
| 7.2 | Click "↺ Start New Resume", confirm | Progress clears, interview restarts from question 1 |

## 8. Voice mode

| # | Step | Expected |
|---|---|---|
| 8.1 | From the mode-selection screen, click "Speak" | The assistant greets you and asks the first question **out loud** |
| 8.2 | Wait for it to finish talking | The mic automatically starts listening (no need to click it) |
| 8.3 | Speak an answer | Your words appear as text in the input box in real time |
| 8.4 | Let it submit / confirm | AI's confirmation + next question are both spoken, then it listens again automatically |
| 8.5 | Click the mic manually while the assistant is mid-sentence | It stops talking immediately rather than talking over you |
| 8.6 | Click "🔊 Voice Assistant: On" to turn it off | Assistant stops speaking; you can still type/click chips normally |

## 9. Journey B — Resume Analyzer

| # | Step | Expected |
|---|---|---|
| 9.1 | Upload a resume (PDF or DOCX) and paste a real job description | Click "Analyze Resume" |
| 9.2 | Wait for results | Four score rings (Overall/Skills/Experience/Education), missing keywords, strengths, weaknesses, and at least one "current → suggested" rewrite card |
| 9.3 | If logged in, go back to the Dashboard | This analysis now appears under "Past Resume Analyses" with the correct score |
| 9.4 | Try uploading a non-PDF/DOCX file (e.g. a .txt) | Clear error message, not a crash |
| 9.5 | Try submitting with no job description | Clear "please paste a job description" error |

## 10. Error handling

| # | Step | Expected |
|---|---|---|
| 10.1 | Stop the Ollama process, then try the interview or analyzer | Clear, friendly error message — not a blank page or stuck "loading" spinner forever |
| 10.2 | Stop the backend entirely, try logging in | Clear "unable to reach the server" message |

---

## Reporting a failure

If any row doesn't match "Expected," the most useful report is: the row
number, what you saw instead, and (for anything visual) a screenshot —
exactly how bugs have been reported and fixed throughout this project so
far.

---

# Added: Analyzer upgrade and career tools

## 11. Resume Analyzer (PRD-aligned)

| # | Step | Expected |
|---|---|---|
| 11.1 | Analyze a resume exported from this app against a job description | Six score rings, each labelled "calculated" or "estimated"; "How these scores are calculated" explains them |
| 11.2 | Read "What the Job Description Asks For" | Required and preferred skills with ✓ / ✗, responsibilities, qualifications, experience |
| 11.3 | Check Priority Recommendations | Ranked High / Medium / Low |
| 11.4 | Weak Bullet Points: accept one rewrite, edit another | Accept toggles; edited text is kept |
| 11.5 | Click "Download improved PDF" and open it | Real selectable text; accepted rewrites replace the weak bullets; other bullets unchanged |
| 11.6 | Stop Ollama and analyze again | Full analysis still shown, with a notice that AI rewrites are unavailable |
| 11.7 | "Edit in resume builder" (logged in) | Opens the improved resume in the builder |

## 12. Cover Letter Generator

| # | Step | Expected |
|---|---|---|
| 12.1 | Choose a saved resume, paste a job description, enter a company, generate | A letter naming the company and role, starting "Dear…", ending with your name |
| 12.2 | Check the "fit" panel | ✓ skills you have; ✗ skills you lack are listed and NOT claimed in the letter |
| 12.3 | Edit the text, Copy, Download PDF, Save | Each works; the saved letter appears on the Dashboard |
| 12.4 | Try tones: professional / enthusiastic / concise | The letter changes style; concise is shorter |
| 12.5 | Generate with no resume chosen | Clear message, no crash |

## 13. LinkedIn Optimisation

| # | Step | Expected |
|---|---|---|
| 13.1 | Pick a resume, enter a target role, run | Profile strength score, 3+ headline options, an About section, skills, checklist |
| 13.2 | Paste a short headline and a buzzword-heavy About | "Feedback on your current profile" lists specific problems |
| 13.3 | Copy buttons | Text goes to the clipboard |
| 13.4 | Skills with "+" | Marked as not in your resume, "add only if you have it" |

## 14. Mock Interview and Interview Feedback

| # | Step | Expected |
|---|---|---|
| 14.1 | Enter a role, start (resume optional) | Question 1 of N; first is "Tell me about yourself" for mixed |
| 14.2 | Submit an empty answer | A friendly message |
| 14.3 | Submit a short filler-heavy answer, then a detailed STAR answer | The second scores clearly higher; feedback names filler words, missing points and STAR parts |
| 14.4 | Wait a few seconds | An "AI coach" note and a stronger version of your own answer appear (if Ollama is running) |
| 14.5 | Skip a question; finish | Report: overall score, verdict, scores, strengths, areas to improve, practice plan, per-question review |
| 14.6 | Dictate with the microphone (Chrome/Edge) | Words appear in the answer box |
| 14.7 | Logged in: open Dashboard | The session appears under Mock Interview Feedback; "View feedback" reopens it |

## 15. Portfolio Builder

| # | Step | Expected |
|---|---|---|
| 15.1 | Create from a saved resume | Editor on the left, live preview on the right |
| 15.2 | Change the name and the theme | Preview updates within about a second |
| 15.3 | Add a project and fill it in | Appears in the preview |
| 15.4 | Download HTML | A single working .html file |
| 15.5 | Save, then Publish | A live link appears; opening it shows the site; Unpublish makes it 404 |
| 15.6 | Put `<script>alert(1)</script>` in a field and publish | It is shown as text; nothing runs |

## 16. Safety net

| # | Step | Expected |
|---|---|---|
| 16.1 | Run the new frontend against an OLD backend and analyze a resume | A clear message to update the backend, not a blank page |
