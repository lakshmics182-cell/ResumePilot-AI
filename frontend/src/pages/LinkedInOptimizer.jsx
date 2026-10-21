import { useState } from "react";
import ResumeSource from "../ResumeSource";
import {
  apiForm,
  appendResumeSource,
  emptySource,
  resumeSourceReady,
} from "../toolsApi";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="mini-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function scoreColor(value) {
  return value >= 75 ? "#2fb572" : value >= 50 ? "#e0a325" : "#e05555";
}

function LinkedInOptimizer({ onBack }) {
  const [source, setSource] = useState(() => emptySource());
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [currentHeadline, setCurrentHeadline] = useState("");
  const [currentAbout, setCurrentAbout] = useState("");

  const [plan, setPlan] = useState(null);
  const [about, setAbout] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    setIsWorking(true);

    try {
      const form = new FormData();
      appendResumeSource(form, source);
      form.set("targetRole", targetRole);
      form.set("jobDescription", jobDescription);
      form.set("currentHeadline", currentHeadline);
      form.set("currentAbout", currentAbout);

      const data = await apiForm("/linkedin-optimize", form);

      setPlan(data);
      setAbout(data.about.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="tool-page">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <div className="tool-header">
        <h1>LinkedIn Optimisation</h1>
        <p>
          Headlines, an About section, skills and a checklist, all
          built from your real resume.
        </p>
      </div>

      <div className="tool-form">
        <label className="field-label">Your resume</label>
        <ResumeSource value={source} onChange={setSource} />

        <label className="field-label">The role you're targeting</label>
        <input
          type="text"
          placeholder="Example: Full Stack Developer"
          value={targetRole}
          onChange={(event) => setTargetRole(event.target.value)}
        />

        <label className="field-label">
          A job description <span className="optional">(optional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Paste one if you have it, to match its keywords..."
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
        />

        <label className="field-label">
          Your current LinkedIn headline{" "}
          <span className="optional">(optional, for feedback)</span>
        </label>
        <input
          type="text"
          value={currentHeadline}
          onChange={(event) => setCurrentHeadline(event.target.value)}
        />

        <label className="field-label">
          Your current About section{" "}
          <span className="optional">(optional, for feedback)</span>
        </label>
        <textarea
          rows={4}
          value={currentAbout}
          onChange={(event) => setCurrentAbout(event.target.value)}
        />

        {error && <div className="analyze-error">⚠️ {error}</div>}

        <button
          type="button"
          className="analyze-button"
          onClick={run}
          disabled={
            isWorking || !targetRole.trim() || !resumeSourceReady(source)
          }
        >
          {isWorking ? "✨ Building your plan..." : "Optimise my profile →"}
        </button>
      </div>

      {plan && (
        <div className="tool-result">
          {plan.aiAvailable ? (
            <div className="ai-summary">
              <strong>✨ AI-polished</strong>
              <p>
                Some wording was polished by AI and checked so it adds
                no numbers or technologies that aren't in your resume.
              </p>
            </div>
          ) : (
            <div className="ai-notice">
              This plan was built directly from your resume. AI
              polishing isn't available right now (is Ollama
              running?).
            </div>
          )}

          <div className="result-card">
            <h2>Profile strength</h2>

            <div className="score-line">
              <span
                className="score-badge"
                style={{ background: scoreColor(plan.score.value) }}
              >
                {plan.score.value}
              </span>
              <span>out of 100 for a {plan.targetRole} profile</span>
            </div>

            {plan.score.breakdown.map((part) => (
              <div className="bar-row" key={part.label}>
                <div className="bar-label">
                  <span>{part.label}</span>
                  <span>
                    {part.points === null
                      ? "—"
                      : `${part.points}/${part.max}`}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${
                        part.points === null
                          ? 0
                          : (part.points / part.max) * 100
                      }%`,
                    }}
                  />
                </div>
                <p className="bar-note">{part.note}</p>
              </div>
            ))}
          </div>

          <div className="result-card">
            <h2>Headline options</h2>
            {plan.headlineOptions.map((option, index) => (
              <div className="copy-row" key={index}>
                <div>
                  <span className="mini-tag">{option.style}</span>
                  <p>{option.text}</p>
                </div>
                <CopyButton text={option.text} />
              </div>
            ))}
          </div>

          <div className="result-card">
            <div className="result-card-head">
              <h2>About section</h2>
              <span className="word-count">
                {about.trim() ? about.trim().split(/\s+/).length : 0} words
              </span>
            </div>
            <textarea
              className="letter-edit"
              rows={10}
              value={about}
              onChange={(event) => setAbout(event.target.value)}
            />
            <div className="updated-actions">
              <CopyButton text={about} />
            </div>
          </div>

          <div className="result-card">
            <h2>Skills to list on LinkedIn</h2>
            <div className="keyword-chip-list">
              {plan.skills.map((skill) => (
                <span
                  key={skill.name}
                  className={`keyword-chip ${
                    skill.inResume ? "found" : "missing"
                  }`}
                  title={skill.reason}
                >
                  {skill.inResume ? "✓" : "+"} {skill.name}
                </span>
              ))}
            </div>
            <p className="results-note">
              ✓ = in your resume. + = common for this role. Add it only
              if you genuinely have the skill. Hover a skill for why.
            </p>
          </div>

          {plan.entries.length > 0 && (
            <div className="result-card">
              <h2>Projects &amp; experience descriptions</h2>
              {plan.entries.map((entry, index) => (
                <div className="copy-row" key={index}>
                  <div>
                    <span className="mini-tag">{entry.kind}</span>
                    <strong>{entry.title}</strong>
                    <p className="pre-line">{entry.description}</p>
                  </div>
                  <CopyButton
                    text={`${entry.title}\n${entry.description}`}
                  />
                </div>
              ))}
            </div>
          )}

          {plan.feedback.length > 0 && (
            <div className="result-card">
              <h2>Feedback on your current profile</h2>
              <ul className="issue-list">
                {plan.feedback.map((item, index) => (
                  <li key={index}>
                    <span className={`priority-badge ${item.severity}`}>
                      {item.severity}
                    </span>
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="result-card">
            <h2>Profile checklist</h2>
            <ul className="checklist">
              {plan.checklist.map((item) => (
                <li key={item.item}>
                  <span
                    className={`check-mark ${
                      item.done === true ? "done" : ""
                    }`}
                  >
                    {item.done === true ? "✓" : "○"}
                  </span>
                  <div>
                    <strong>{item.item}</strong>
                    <p>{item.tip}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default LinkedInOptimizer;
