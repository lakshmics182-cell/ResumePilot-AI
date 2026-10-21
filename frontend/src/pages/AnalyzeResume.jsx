import { useRef, useState } from "react";
import { downloadResumePdf } from "../resumePdf";
import ImproveQuestions, { applyAnswers } from "./ImproveQuestions";

const ANALYZE_ENDPOINT =
  "http://localhost:5000/api/analyze-resume";

const RESUMES_ENDPOINT =
  "http://localhost:5000/api/resumes";

/* ------------------------------------------------------------------ */
/* Helpers: turn the parsed resume + accepted rewrites into outputs   */
/* ------------------------------------------------------------------ */

function applyAccepted(resume, weakBullets, accepted, edits) {
  const copy = JSON.parse(JSON.stringify(resume));

  weakBullets.forEach((bullet) => {
    if (!accepted[bullet.id]) {
      return;
    }

    const text = (
      edits[bullet.id] ??
      bullet.suggested ??
      ""
    ).trim();

    const entry = copy[bullet.section]?.[bullet.entryIndex];

    if (text && entry && entry.bullets[bullet.bulletIndex] !== undefined) {
      entry.bullets[bullet.bulletIndex] = text;
    }
  });

  return copy;
}

function toPdfData(resume) {
  const skillLines = [];

  if (resume.technicalSkills) {
    skillLines.push(`Technical Skills: ${resume.technicalSkills}`);
  }

  if (resume.nonTechnicalSkills) {
    skillLines.push(
      `Non-Technical Skills: ${resume.nonTechnicalSkills}`
    );
  }

  return {
    name: resume.name,
    contact: [resume.email, resume.phone, resume.location],
    summary: resume.summary,
    sections: [
      { heading: "KEY TECHNICAL PROJECTS", entries: resume.projects },
      { heading: "EDUCATION", entries: resume.education },
      {
        heading: "TECHNICAL AND NON-TECHNICAL SKILLS",
        lines: skillLines,
      },
      { heading: "EXPERIENCE", entries: resume.experience },
      { heading: "CERTIFICATIONS", entries: resume.certifications },
      { heading: "ACHIEVEMENTS", entries: resume.achievements },
      { heading: "LANGUAGES KNOWN", lines: [resume.languages] },
    ],
  };
}

function countWords(text) {
  const words = String(text || "").match(/\S+/g);
  return words ? words.length : 0;
}

function pdfWordCount(data) {
  let total =
    countWords(data.name) +
    countWords((data.contact || []).join(" ")) +
    countWords(data.summary);

  data.sections.forEach((section) => {
    (section.entries || []).forEach((entry) => {
      total += countWords(entry.title);
      (entry.bullets || []).forEach((bullet) => {
        total += countWords(bullet);
      });
    });

    (section.lines || []).forEach((line) => {
      total += countWords(line);
    });
  });

  return total;
}

function toBuilderData(resume) {
  const toEntries = (entries) =>
    entries.map((entry) => ({
      original:
        entry.title || (entry.bullets && entry.bullets[0]) || "",
      enhanced:
        entry.bullets && entry.bullets.length
          ? entry.bullets.join("\n")
          : entry.title,
    }));

  return {
    name: resume.name || "",
    email: resume.email || "",
    phone: resume.phone || "",
    jobTitle: "",
    location: resume.location || "",
    about: resume.summary || "",
    strengths: "",
    careerGoal: "",
    professionalSummary: resume.summary || "",
    education: toEntries(resume.education),
    technicalSkills: resume.technicalSkills || "",
    nonTechnicalSkills: resume.nonTechnicalSkills || "",
    projects: toEntries(resume.projects),
    experience: toEntries(resume.experience),
    certifications: toEntries(resume.certifications),
    achievements: toEntries(resume.achievements),
    languages: resume.languages || "",
  };
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

function ScoreRing({ label, score, basis, note }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const hasScore = score !== null && score !== undefined;
  const offset = hasScore
    ? circumference - (score / 100) * circumference
    : circumference;

  const color = !hasScore
    ? "#c9c5d6"
    : score >= 75
    ? "#2fb572"
    : score >= 50
    ? "#e0a325"
    : "#e05555";

  return (
    <div className="score-ring" title={note}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#eee9fb"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="45"
          textAnchor="middle"
          fontSize={hasScore ? "18" : "13"}
          fontWeight="700"
          fill="#302c40"
        >
          {hasScore ? score : "N/A"}
        </text>
      </svg>
      <span className="score-ring-label">{label}</span>
      <span className="score-ring-basis">{basis}</span>
    </div>
  );
}

function SkillChips({ skills }) {
  if (!skills || skills.length === 0) {
    return <p className="results-empty">None detected.</p>;
  }

  return (
    <div className="keyword-chip-list">
      {skills.map((skill) => (
        <span
          key={skill.name}
          className={`keyword-chip ${
            skill.found ? "found" : "missing"
          }`}
        >
          {skill.found ? "✓" : "✗"} {skill.name}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  if (!items || items.length === 0) {
    return <p className="results-empty">None detected.</p>;
  }

  return (
    <ul className="results-list plain">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

const ISSUE_LABELS = {
  "weak-opener": "Weak opener",
  "too-short": "Too short",
  "first-person": "First person",
  "no-action-verb": "No action verb",
  "no-metric": "No numbers",
  "too-long": "Too long",
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function AnalyzeResume({ onBack, onEditSaved }) {
  const [step, setStep] = useState("upload");
  // step: "upload" -> "jobDescription" -> "results"

  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const [accepted, setAccepted] = useState({});
  const [edits, setEdits] = useState({});
  const [answers, setAnswers] = useState({});
  const [isOpeningBuilder, setIsOpeningBuilder] =
    useState(false);
  const [builderMessage, setBuilderMessage] = useState("");

  const fileInputRef = useRef(null);

  const takeFile = (file) => {
    if (!file) {
      return;
    }

    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }

    setError("");
    setResumeFile(file);
    setStep("jobDescription");
  };

  const resetAll = () => {
    setStep("upload");
    setResumeFile(null);
    setJobDescription("");
    setResults(null);
    setError("");
    setAccepted({});
    setEdits({});
    setAnswers({});
    setBuilderMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile) {
      setError("Please upload your resume first.");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please paste the job description.");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("jobDescription", jobDescription.trim());

      const token = localStorage.getItem("resumepilot_token");

      const response = await fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Resume analysis failed.");
      }

      // An older backend answers in a different shape. Say so clearly
      // instead of crashing while drawing the results.
      const looksValid =
        data &&
        data.scores &&
        data.jobAnalysis &&
        data.resume &&
        Array.isArray(data.weakBullets) &&
        Array.isArray(data.recommendations) &&
        Array.isArray(data.formattingIssues) &&
        Array.isArray(data.strengths) &&
        Array.isArray(data.weaknesses) &&
        Array.isArray(data.missingKeywords);

      if (!looksValid) {
        throw new Error(
          "The server sent an older style of analysis. Please replace backend/server.js and backend/resumeAnalysis.js with the latest versions, restart the backend (node server.js), and try again."
        );
      }

      setResults(data);
      setAccepted({});
      setEdits({});
      setAnswers({});
      setBuilderMessage("");
      setStep("results");
    } catch (err) {
      console.error("Resume analysis error:", err);

      setError(
        err.message ||
          "Unable to analyze the resume right now. Please check that the backend is running."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* ---------- improved resume ---------- */

  const withRewrites = results
    ? applyAccepted(
        results.resume,
        results.weakBullets,
        accepted,
        edits
      )
    : null;

  const merged = withRewrites
    ? applyAnswers(withRewrites, answers)
    : null;

  const improvedResume = merged ? merged.resume : null;
  const answersApplied = merged ? merged.applied : 0;

  const acceptedCount = Object.values(accepted).filter(Boolean).length;

  const pdfData = improvedResume ? toPdfData(improvedResume) : null;

  const structureIncomplete =
    pdfData &&
    results.resume.wordCount > 0 &&
    pdfWordCount(pdfData) < results.resume.wordCount * 0.6;

  const handleDownload = () => {
    if (pdfData) {
      downloadResumePdf(pdfData);
    }
  };

  const handleEditInBuilder = async () => {
    const token = localStorage.getItem("resumepilot_token");

    if (!token) {
      setBuilderMessage(
        "Please log in to open this resume in the builder."
      );
      return;
    }

    setIsOpeningBuilder(true);
    setBuilderMessage("");

    try {
      const response = await fetch(RESUMES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: improvedResume.name || "Improved resume",
          template: "classic",
          resumeData: toBuilderData(improvedResume),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save the improved resume."
        );
      }

      if (onEditSaved) {
        onEditSaved(data.id);
      } else {
        setBuilderMessage("✓ Saved to My Resumes.");
      }
    } catch (err) {
      setBuilderMessage(
        err.message || "Could not save the improved resume."
      );
    } finally {
      setIsOpeningBuilder(false);
    }
  };

  /* ---------- render ---------- */

  const scoreList = results
    ? [
        ["Overall Match", results.scores.overall],
        ["Skills", results.scores.skills],
        ["Project Relevance", results.scores.projectRelevance],
        ["Experience", results.scores.experience],
        ["Education", results.scores.education],
        ["ATS Format", results.scores.atsFormat],
      ]
    : [];

  return (
    <div className="analyze-page">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      {/* ================= STEP 1: UPLOAD ================= */}

      {step === "upload" && (
        <div className="analyze-content">
          <div className="analyze-big-icon">🔍</div>

          <h1>Analyze Your Resume</h1>

          <p>
            Upload your resume and compare it with a job
            description to see what's missing.
          </p>

          <div
            className="upload-box"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              takeFile(event.dataTransfer.files?.[0]);
            }}
          >
            <div className="upload-icon">📄</div>

            <h3>Upload your resume</h3>

            <p>PDF or DOCX files</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(event) =>
                takeFile(event.target.files?.[0])
              }
            />
          </div>

          {error && (
            <div className="analyze-error">⚠️ {error}</div>
          )}
        </div>
      )}

      {/* ================= STEP 2: JOB DESCRIPTION ================= */}

      {step === "jobDescription" && (
        <div className="analyze-content">
          <div className="analyze-big-icon">📋</div>

          <h1>Paste the Job Description</h1>

          <p>
            Resume uploaded: <strong>{resumeFile?.name}</strong>
            {" — "}
            <button
              type="button"
              className="link-button"
              onClick={resetAll}
            >
              change file
            </button>
          </p>

          <textarea
            className="job-description-input"
            placeholder="Paste the job description from LinkedIn, Indeed, or the company website..."
            value={jobDescription}
            onChange={(event) =>
              setJobDescription(event.target.value)
            }
            rows={10}
          />

          {error && (
            <div className="analyze-error">⚠️ {error}</div>
          )}

          <button
            type="button"
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !jobDescription.trim()}
          >
            {isAnalyzing
              ? "✨ Analyzing your resume..."
              : "Analyze Resume →"}
          </button>
        </div>
      )}

      {/* ================= STEP 3: RESULTS ================= */}

      {step === "results" && results && (
        <div className="analyze-results">
          <div className="results-header">
            <h1>Analysis Results</h1>

            <button
              type="button"
              className="link-button"
              onClick={resetAll}
            >
              ↺ Analyze another resume
            </button>
          </div>

          {results.aiAvailable ? (
            results.aiSummary && (
              <div className="ai-summary">
                <strong>✨ AI advice</strong>
                <p>{results.aiSummary}</p>
              </div>
            )
          ) : (
            <div className="ai-notice">
              AI wording help isn't available right now (is
              Ollama running?). Your scores, skill matching and
              checks below are calculated without AI and are
              still valid. Rewrite suggestions need the AI.
            </div>
          )}

          <div className="score-grid">
            {scoreList.map(([label, score]) => (
              <ScoreRing
                key={label}
                label={label}
                score={score.value}
                basis={score.basis}
                note={score.note}
              />
            ))}
          </div>

          <details className="score-explain">
            <summary>How these scores are calculated</summary>
            <ul>
              {scoreList.map(([label, score]) => (
                <li key={label}>
                  <strong>{label}</strong> ({score.basis}):{" "}
                  {score.note}
                </li>
              ))}
            </ul>
            <p>
              "Calculated" scores come directly from matching
              your resume text against the job description.
              "Estimated" scores use simple rules (for example,
              date ranges for experience) and are a guide, not
              an exact figure.
            </p>
          </details>

          {results.recommendations.length > 0 && (
            <div className="results-section">
              <h2>Priority Recommendations</h2>

              <ol className="recommendation-list">
                {results.recommendations.map((item, index) => (
                  <li key={index}>
                    <span
                      className={`priority-badge ${item.priority.toLowerCase()}`}
                    >
                      {item.priority}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="results-section">
            <h2>What the Job Description Asks For</h2>

            <h3 className="results-subtitle">Required skills</h3>
            <SkillChips
              skills={results.jobAnalysis.requiredSkills}
            />

            {results.jobAnalysis.preferredSkills.length > 0 && (
              <>
                <h3 className="results-subtitle">
                  Preferred skills
                </h3>
                <SkillChips
                  skills={results.jobAnalysis.preferredSkills}
                />
              </>
            )}

            {results.jobAnalysis.experience.text && (
              <>
                <h3 className="results-subtitle">Experience</h3>
                <p className="results-plain">
                  {results.jobAnalysis.experience.text}
                </p>
              </>
            )}

            {results.jobAnalysis.responsibilities.length > 0 && (
              <>
                <h3 className="results-subtitle">
                  Responsibilities
                </h3>
                <BulletList
                  items={results.jobAnalysis.responsibilities}
                />
              </>
            )}

            {results.jobAnalysis.qualifications.length > 0 && (
              <>
                <h3 className="results-subtitle">
                  Qualifications
                </h3>
                <BulletList
                  items={results.jobAnalysis.qualifications}
                />
              </>
            )}

            {results.jobAnalysis.requirements.length > 0 && (
              <>
                <h3 className="results-subtitle">Requirements</h3>
                <BulletList
                  items={results.jobAnalysis.requirements}
                />
              </>
            )}

            {results.jobAnalysis.keywords.length > 0 && (
              <>
                <h3 className="results-subtitle">
                  Other repeated keywords
                </h3>
                <SkillChips
                  skills={results.jobAnalysis.keywords.map(
                    (keyword) => ({
                      name: keyword.term,
                      found: keyword.found,
                    })
                  )}
                />
              </>
            )}
          </div>

          {results.missingKeywords.length > 0 && (
            <div className="results-section">
              <h2>Missing Keywords</h2>
              <div className="keyword-chip-list">
                {results.missingKeywords.map((keyword) => (
                  <span
                    className="keyword-chip missing"
                    key={keyword}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {results.strengths.length > 0 && (
            <div className="results-section">
              <h2>Strengths</h2>
              <ul className="results-list strengths">
                {results.strengths.map((item, index) => (
                  <li key={index}>✓ {item}</li>
                ))}
              </ul>
            </div>
          )}

          {results.weaknesses.length > 0 && (
            <div className="results-section">
              <h2>Areas to Improve</h2>
              <ul className="results-list weaknesses">
                {results.weaknesses.map((item, index) => (
                  <li key={index}>⚠ {item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="results-section">
            <h2>Weak Bullet Points</h2>

            {results.weakBullets.length === 0 ? (
              <p className="results-empty">
                No weak bullet points found. Nice work.
              </p>
            ) : (
              results.weakBullets.map((bullet) => (
                <div className="weak-bullet" key={bullet.id}>
                  <div className="issue-tags">
                    {bullet.issues.map((issue) => (
                      <span className="issue-tag" key={issue}>
                        {ISSUE_LABELS[issue] || issue}
                      </span>
                    ))}
                  </div>

                  <div className="suggestion-card">
                    <div className="suggestion-current">
                      <strong>Current</strong>
                      <p>{bullet.current}</p>
                    </div>

                    <div className="suggestion-arrow">→</div>

                    <div className="suggestion-suggested">
                      <strong>Suggested</strong>

                      {bullet.suggested ? (
                        <textarea
                          className="suggestion-edit"
                          value={
                            edits[bullet.id] ?? bullet.suggested
                          }
                          onChange={(event) =>
                            setEdits((previous) => ({
                              ...previous,
                              [bullet.id]: event.target.value,
                            }))
                          }
                          rows={3}
                        />
                      ) : (
                        <p className="results-empty">
                          {results.aiAvailable
                            ? "The AI couldn't write a safe rewrite for this line."
                            : "Needs the AI to write a rewrite."}
                        </p>
                      )}
                    </div>
                  </div>

                  {bullet.tips.length > 0 && (
                    <ul className="bullet-tips">
                      {bullet.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  )}

                  {bullet.suggested && (
                    <button
                      type="button"
                      className={`accept-button${
                        accepted[bullet.id] ? " accepted" : ""
                      }`}
                      onClick={() =>
                        setAccepted((previous) => ({
                          ...previous,
                          [bullet.id]: !previous[bullet.id],
                        }))
                      }
                    >
                      {accepted[bullet.id]
                        ? "✓ Accepted — click to undo"
                        : "Accept this rewrite"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="results-section">
            <h2>Formatting &amp; ATS Check</h2>

            {results.formattingIssues.length === 0 ? (
              <p className="results-empty">
                No formatting problems found.
              </p>
            ) : (
              <ul className="issue-list">
                {results.formattingIssues.map((issue, index) => (
                  <li key={index}>
                    <span
                      className={`priority-badge ${
                        issue.severity === "high"
                          ? "high"
                          : issue.severity === "medium"
                          ? "medium"
                          : "low"
                      }`}
                    >
                      {issue.severity}
                    </span>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}

            <p className="results-note">
              This checks the text of your file. It can't see
              visual layout such as columns, tables or images.
            </p>
          </div>

          <ImproveQuestions
            results={results}
            answers={answers}
            onChange={setAnswers}
          />

          <div className="results-section updated-resume">
            <h2>Your Updated Resume</h2>

            <p>
              {acceptedCount + answersApplied > 0
                ? [
                    acceptedCount > 0
                      ? `${acceptedCount} rewrite${
                          acceptedCount > 1 ? "s" : ""
                        } applied`
                      : "",
                    answersApplied > 0
                      ? `${answersApplied} improvement${
                          answersApplied > 1 ? "s" : ""
                        } added from your answers`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" and ") + "."
                : "Accept rewrites and answer the questions above, then download. Without them, the PDF is your same resume re-formatted as a clean, ATS-friendly file."}
            </p>

            {structureIncomplete && (
              <div className="ai-notice">
                We couldn't fully read every section of your
                resume, so the new PDF may be missing some
                content. Check it before sending it anywhere,
                or rebuild it in the resume builder.
              </div>
            )}

            <div className="updated-actions">
              <button
                type="button"
                className="analyze-button"
                onClick={handleDownload}
              >
                ⬇ Download improved PDF
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleEditInBuilder}
                disabled={isOpeningBuilder}
              >
                {isOpeningBuilder
                  ? "Saving..."
                  : "✎ Edit in resume builder"}
              </button>
            </div>

            {builderMessage && (
              <div className="save-status">{builderMessage}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyzeResume;
