import { useEffect, useState } from "react";
import ResumeSource from "../ResumeSource";
import { downloadLetterPdf } from "../resumePdf";
import {
  apiForm,
  apiGet,
  apiSend,
  appendResumeSource,
  emptySource,
  getToken,
  resumeSourceReady,
} from "../toolsApi";

function CoverLetter({ onBack, letterId = null }) {
  const [source, setSource] = useState(() => emptySource());
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState("professional");

  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [savedId, setSavedId] = useState(null);

  // Open a saved letter from the dashboard.
  useEffect(() => {
    if (!letterId) {
      return undefined;
    }

    let cancelled = false;

    apiGet(`/cover-letters/${letterId}`)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setLetter(data.content);
        setCompany(data.company || "");
        setRole(data.role || "");
        setSavedId(data.id);
        setResult({
          aiAvailable: false,
          matchedSkills: [],
          missingSkills: [],
          wordCount: data.content.split(/\s+/).length,
          opened: true,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [letterId]);

  const canGenerate =
    resumeSourceReady(source) &&
    (jobDescription.trim() || role.trim());

  const generate = async () => {
    setError("");
    setStatus("");
    setIsWorking(true);

    try {
      const form = new FormData();
      appendResumeSource(form, source);
      form.set("jobDescription", jobDescription);
      form.set("company", company);
      form.set("role", role);
      form.set("hiringManager", hiringManager);
      form.set("tone", tone);

      const data = await apiForm("/cover-letter", form);

      setResult(data);
      setLetter(data.letter);
      setSavedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setStatus("✓ Copied to clipboard.");
    } catch {
      setStatus("Couldn't copy automatically. Select the text and copy it.");
    }
  };

  const save = async () => {
    if (!getToken()) {
      setStatus("Please log in to save letters to your account.");
      return;
    }

    try {
      const body = {
        title: company ? `Cover letter: ${company}` : "Cover letter",
        company,
        role: role || (result && result.role) || "",
        content: letter,
      };

      if (savedId) {
        await apiSend(`/cover-letters/${savedId}`, "DELETE");
      }

      const saved = await apiSend("/cover-letters", "POST", body);

      setSavedId(saved.id);
      setStatus("✓ Saved to your account.");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const wordCount = letter.trim() ? letter.trim().split(/\s+/).length : 0;

  return (
    <div className="tool-page">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <div className="tool-header">
        <h1>Cover Letter Generator</h1>
        <p>
          Your letter uses only facts from your resume. Skills the job
          asks for that you don't list are never claimed.
        </p>
      </div>

      {!result?.opened && (
        <div className="tool-form">
          <label className="field-label">Your resume</label>
          <ResumeSource value={source} onChange={setSource} />

          <label className="field-label">
            Job description{" "}
            <span className="optional">(or just enter the role below)</span>
          </label>
          <textarea
            rows={6}
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
          />

          <div className="field-row">
            <div>
              <label className="field-label">Company</label>
              <input
                type="text"
                placeholder="Acme Tech"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Role</label>
              <input
                type="text"
                placeholder="Web Developer Intern"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label className="field-label">
                Hiring manager <span className="optional">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Ms. Rao"
                value={hiringManager}
                onChange={(event) => setHiringManager(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Tone</label>
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              >
                <option value="professional">Professional</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="concise">Concise</option>
              </select>
            </div>
          </div>

          {error && <div className="analyze-error">⚠️ {error}</div>}

          <button
            type="button"
            className="analyze-button"
            onClick={generate}
            disabled={isWorking || !canGenerate}
          >
            {isWorking
              ? "✨ Writing your letter..."
              : result
              ? "↻ Generate again"
              : "Generate cover letter →"}
          </button>
        </div>
      )}

      {error && result?.opened && (
        <div className="analyze-error">⚠️ {error}</div>
      )}

      {result && (
        <div className="tool-result">
          {!result.opened &&
            (result.aiAvailable ? (
              <div className="ai-summary">
                <strong>✨ AI-polished</strong>
                <p>
                  The wording was polished by AI and checked so it
                  adds no numbers or technologies that aren't in your
                  resume.
                </p>
              </div>
            ) : (
              <div className="ai-notice">
                This letter was built from a template using your
                resume facts. AI polishing isn't available right now
                (is Ollama running?), but the letter is ready to edit.
              </div>
            ))}

          <div className="result-card">
            <div className="result-card-head">
              <h2>Your letter</h2>
              <span className="word-count">{wordCount} words</span>
            </div>

            <textarea
              className="letter-edit"
              rows={18}
              value={letter}
              onChange={(event) => setLetter(event.target.value)}
            />

            <div className="updated-actions">
              <button
                type="button"
                className="analyze-button"
                onClick={() =>
                  downloadLetterPdf(
                    letter,
                    company ? `Cover_Letter_${company.replace(/\s+/g, "_")}` : "Cover_Letter"
                  )
                }
              >
                ⬇ Download PDF
              </button>
              <button type="button" className="secondary-button" onClick={copy}>
                Copy text
              </button>
              <button type="button" className="secondary-button" onClick={save}>
                💾 {savedId ? "Save again" : "Save to my account"}
              </button>
            </div>

            {status && <div className="save-status">{status}</div>}
          </div>

          {(result.matchedSkills?.length > 0 ||
            result.missingSkills?.length > 0) && (
            <div className="result-card">
              <h2>How well your resume fits</h2>

              {result.matchedSkills.length > 0 && (
                <>
                  <h3 className="results-subtitle">
                    Skills from the job you have (used in the letter)
                  </h3>
                  <div className="keyword-chip-list">
                    {result.matchedSkills.map((skill) => (
                      <span key={skill} className="keyword-chip found">
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {result.missingSkills.length > 0 && (
                <>
                  <h3 className="results-subtitle">
                    Wanted by the job but not in your resume (not
                    claimed in the letter)
                  </h3>
                  <div className="keyword-chip-list">
                    {result.missingSkills.map((skill) => (
                      <span key={skill} className="keyword-chip missing">
                        ✗ {skill}
                      </span>
                    ))}
                  </div>
                  <p className="results-note">
                    Add these to your resume only if you genuinely have
                    them.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CoverLetter;
