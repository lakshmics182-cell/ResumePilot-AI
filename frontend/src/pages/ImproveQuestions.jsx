import { useMemo } from "react";
import "../improve-questions.css";

/*
 * Guided improvement step for the resume analyzer.
 *
 * After the analysis, the app asks the person short questions built from
 * what the analysis found (missing keywords, missing sections, bullets
 * without numbers). Their answers are merged into the resume data, so the
 * downloaded PDF and the builder copy really change.
 *
 * Nothing is invented: a skill is added only if the person says they have
 * it, and a bullet is written only from their own words.
 */

const MAX_KEYWORD_QUESTIONS = 8;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function sentence(text) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");

  if (!clean) {
    return "";
  }

  const first = clean.charAt(0).toUpperCase() + clean.slice(1);

  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function mentions(text, term) {
  return String(text || "")
    .toLowerCase()
    .includes(String(term || "").toLowerCase());
}

function entryLabel(section, entry, index) {
  const raw = String(entry?.title || entry?.bullets?.[0] || "").trim();
  const label = raw.length > 60 ? `${raw.slice(0, 57)}...` : raw;

  return `${section === "projects" ? "Project" : "Experience"} ${
    index + 1
  }${label ? `: ${label}` : ""}`;
}

// Entries a new bullet can be attached to: "projects:0", "experience:1"...
export function bulletTargets(resume) {
  const targets = [];

  ["projects", "experience"].forEach((section) => {
    (resume?.[section] || []).forEach((entry, index) => {
      targets.push({
        value: `${section}:${index}`,
        label: entryLabel(section, entry, index),
      });
    });
  });

  return targets;
}

/* ------------------------------------------------------------------ */
/* Question list built from the analysis                               */
/* ------------------------------------------------------------------ */

export function buildQuestions(results) {
  if (!results) {
    return [];
  }

  const resume = results.resume || {};
  const questions = [];

  if (!hasText(resume.summary)) {
    questions.push({
      id: "summary",
      type: "summary",
      title: "Professional summary",
      prompt:
        "Your resume has no summary. In 2 sentences: who are you, and what role are you aiming for?",
      placeholder:
        "e.g. Final-year CS student with hands-on React and Node.js project experience, looking for a frontend internship.",
    });
  }

  const seen = new Set();

  (results.missingKeywords || [])
    .map((keyword) => String(keyword || "").trim())
    .filter((keyword) => {
      const key = keyword.toLowerCase();

      if (!keyword || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, MAX_KEYWORD_QUESTIONS)
    .forEach((keyword) => {
      questions.push({
        id: `kw:${keyword.toLowerCase()}`,
        type: "keyword",
        keyword,
        title: keyword,
        prompt: `The job asks for "${keyword}", which isn't on your resume. Do you have experience with it?`,
      });
    });

  const bulletsWithoutNumbers = results.stats?.bulletsWithoutNumbers || 0;

  if (bulletsWithoutNumbers > 0) {
    questions.push({
      id: "metric",
      type: "metric",
      title: "Add a measurable result",
      prompt: `${bulletsWithoutNumbers} of your bullets have no numbers. Pick one project or job and describe a result with a number (users, % faster, team size, time saved).`,
      placeholder:
        "e.g. Reduced page load time by 40% by lazy-loading images",
    });
  }

  if (!(resume.achievements || []).length) {
    questions.push({
      id: "achievement",
      type: "achievement",
      title: "Achievement (optional)",
      prompt:
        "You have no achievements listed. Any award, rank, hackathon, scholarship or recognition? Skip if none.",
      placeholder: "e.g. Finalist, Smart India Hackathon 2025",
    });
  }

  if (!hasText(resume.technicalSkills) && !hasText(resume.nonTechnicalSkills)) {
    questions.push({
      id: "skills",
      type: "skills",
      title: "Skills",
      prompt:
        "No skills section was found. List the tools and technologies you actually use, separated by commas.",
      placeholder: "e.g. JavaScript, React, Node.js, SQL, Git",
    });
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/* Merge answers into the resume                                       */
/* ------------------------------------------------------------------ */

function addSkills(resume, skills) {
  const existing = String(resume.technicalSkills || "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const have = new Set(existing.map((skill) => skill.toLowerCase()));

  skills.forEach((skill) => {
    const clean = String(skill || "").trim();

    if (clean && !have.has(clean.toLowerCase())) {
      existing.push(clean);
      have.add(clean.toLowerCase());
    }
  });

  resume.technicalSkills = existing.join(", ");
}

function addBullet(resume, target, text) {
  const [section, rawIndex] = String(target || "").split(":");
  const entry = resume[section]?.[Number(rawIndex)];

  if (!entry || !text) {
    return false;
  }

  entry.bullets = [...(entry.bullets || []), text];
  return true;
}

export function applyAnswers(resume, answers) {
  const copy = JSON.parse(JSON.stringify(resume));
  const newSkills = [];
  let applied = 0;

  Object.entries(answers || {}).forEach(([id, answer]) => {
    if (!answer) {
      return;
    }

    if (id === "summary" && hasText(answer.text)) {
      copy.summary = sentence(answer.text);
      applied += 1;
      return;
    }

    if (id === "skills" && hasText(answer.text)) {
      addSkills(copy, answer.text.split(","));
      applied += 1;
      return;
    }

    if (id === "achievement" && hasText(answer.text)) {
      copy.achievements = [
        ...(copy.achievements || []),
        { title: sentence(answer.text), bullets: [] },
      ];
      applied += 1;
      return;
    }

    if (id === "metric" && hasText(answer.text)) {
      if (addBullet(copy, answer.target, sentence(answer.text))) {
        applied += 1;
      }
      return;
    }

    if (id.startsWith("kw:") && answer.has === "yes") {
      const keyword = answer.keyword;

      newSkills.push(keyword);
      applied += 1;

      if (hasText(answer.text) && answer.target) {
        let text = sentence(answer.text);

        // Make sure the bullet actually contains the keyword.
        if (!mentions(text, keyword)) {
          text = `${text.replace(/\.$/, "")} using ${keyword}.`;
        }

        addBullet(copy, answer.target, text);
      }
    }
  });

  if (newSkills.length) {
    addSkills(copy, newSkills);
  }

  return { resume: copy, applied };
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

function ImproveQuestions({ results, answers, onChange }) {
  const questions = useMemo(() => buildQuestions(results), [results]);
  const targets = useMemo(() => bulletTargets(results?.resume), [results]);

  if (!questions.length) {
    return null;
  }

  const setAnswer = (id, patch) =>
    onChange({ ...answers, [id]: { ...(answers[id] || {}), ...patch } });

  const targetSelect = (id, value) => (
    <select
      className="improve-select"
      value={value || ""}
      onChange={(event) => setAnswer(id, { target: event.target.value })}
    >
      <option value="">Choose where to add it</option>
      {targets.map((target) => (
        <option key={target.value} value={target.value}>
          {target.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="results-section improve-section">
      <h2>Improve your resume with a few questions</h2>

      <p className="improve-intro">
        Answer what applies and skip the rest. Only add things that are
        true: you may be asked about them in an interview. Your answers are
        added to the resume you download.
      </p>

      {questions.map((question) => {
        const answer = answers[question.id] || {};

        return (
          <div className="improve-card" key={question.id}>
            <strong className="improve-title">{question.title}</strong>
            <p className="improve-prompt">{question.prompt}</p>

            {question.type === "keyword" && (
              <>
                <div className="improve-choice">
                  <button
                    type="button"
                    className={`improve-pill${
                      answer.has === "yes" ? " active" : ""
                    }`}
                    onClick={() =>
                      setAnswer(question.id, {
                        has: "yes",
                        keyword: question.keyword,
                      })
                    }
                  >
                    Yes, I have
                  </button>
                  <button
                    type="button"
                    className={`improve-pill${
                      answer.has === "no" ? " active" : ""
                    }`}
                    onClick={() =>
                      setAnswer(question.id, {
                        has: "no",
                        keyword: question.keyword,
                      })
                    }
                  >
                    No / skip
                  </button>
                </div>

                {answer.has === "yes" && (
                  <>
                    <textarea
                      className="improve-input"
                      rows={2}
                      placeholder={`Where did you use ${question.keyword}, and what did you do? (optional, becomes a bullet)`}
                      value={answer.text || ""}
                      onChange={(event) =>
                        setAnswer(question.id, { text: event.target.value })
                      }
                    />
                    {hasText(answer.text) &&
                      targets.length > 0 &&
                      targetSelect(question.id, answer.target)}
                    <small className="improve-hint">
                      "{question.keyword}" will be added to your skills.
                    </small>
                  </>
                )}
              </>
            )}

            {question.type === "metric" && (
              <>
                <textarea
                  className="improve-input"
                  rows={2}
                  placeholder={question.placeholder}
                  value={answer.text || ""}
                  onChange={(event) =>
                    setAnswer(question.id, { text: event.target.value })
                  }
                />
                {hasText(answer.text) && targetSelect(question.id, answer.target)}
              </>
            )}

            {["summary", "achievement", "skills"].includes(question.type) && (
              <textarea
                className="improve-input"
                rows={question.type === "summary" ? 3 : 2}
                placeholder={question.placeholder}
                value={answer.text || ""}
                onChange={(event) =>
                  setAnswer(question.id, { text: event.target.value })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ImproveQuestions;
