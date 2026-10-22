import { API_BASE, API_ORIGIN } from "../config";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../toolsApi";



function authHeaders() {
  const token = localStorage.getItem(
    "resumepilot_token"
  );

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

function getUnfinishedDraft() {
  try {
    const raw = localStorage.getItem(
      "resumepilot_draft"
    );

    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw);

    const hasProgress =
      (draft.currentQuestion || 0) > 0 ||
      Boolean(draft.resumeData?.name);

    return hasProgress ? draft : null;
  } catch {
    return null;
  }
}

function Dashboard({
  user,
  onNewResume,
  onContinueDraft,
  onOpenTool,
  onContinueResume,
  onAnalyze,
  onLogout,
}) {
  const [resumes, setResumes] = useState([]);
  const [reports, setReports] = useState([]);
  const [draft, setDraft] = useState(
    getUnfinishedDraft
  );
  const [letters, setLetters] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [resumesRes, reportsRes] =
          await Promise.all([
            fetch(`${API_BASE}/resumes`, {
              headers: authHeaders(),
            }),
            fetch(
              `${API_BASE}/analysis-reports`,
              { headers: authHeaders() }
            ),
          ]);

        const resumesData =
          await resumesRes.json();
        const reportsData =
          await reportsRes.json();

        if (cancelled) {
          return;
        }

        if (!resumesRes.ok) {
          throw new Error(
            resumesData.error ||
              "Could not load your resumes."
          );
        }

        if (!reportsRes.ok) {
          throw new Error(
            reportsData.error ||
              "Could not load your analysis reports."
          );
        }

        setResumes(resumesData.resumes || []);
        setReports(reportsData.reports || []);
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Dashboard load error:",
            err
          );
          setError(
            err.message ||
              "Unable to reach the server. Please check that the backend is running."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cover letters, portfolios and interview feedback. These load
  // separately so the dashboard still works if one of them fails.
  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      apiGet("/cover-letters"),
      apiGet("/portfolios"),
      apiGet("/interviews"),
    ]).then(([lettersResult, portfoliosResult, interviewsResult]) => {
      if (cancelled) {
        return;
      }

      if (lettersResult.status === "fulfilled") {
        setLetters(lettersResult.value.coverLetters || []);
      }

      if (portfoliosResult.status === "fulfilled") {
        setPortfolios(portfoliosResult.value.portfolios || []);
      }

      if (interviewsResult.status === "fulfilled") {
        setInterviews(interviewsResult.value.sessions || []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const removeDocument = async (path, id, setter) => {
    if (!window.confirm("Delete this? This can't be undone.")) {
      return;
    }

    try {
      await apiSend(`${path}/${id}`, "DELETE");
      setter((previous) => previous.filter((item) => item.id !== id));
    } catch (err) {
      alert(err.message || "Something went wrong while deleting.");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Delete this resume? This can't be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/resumes/${id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Could not delete this resume."
        );
      }

      setResumes((previous) =>
        previous.filter(
          (resume) => resume.id !== id
        )
      );
    } catch (err) {
      console.error("Delete error:", err);
      alert(
        err.message ||
          "Something went wrong while deleting."
      );
    }
  };

  const formatDate = (value) => {
    try {
      return new Date(
        value.replace(" ", "T") + "Z"
      ).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="dashboard-page">

      <header className="dashboard-header">

        <div>
          <h1>
            Welcome back, {user?.name || "there"}
            !
          </h1>
          <p>
            Here's everything you've built with
            ResumePilot.
          </p>
        </div>

        <button
          type="button"
          className="link-button"
          onClick={onLogout}
        >
          Logout
        </button>

      </header>

      <div className="dashboard-actions">

        <button
          type="button"
          className="dashboard-action-card primary"
          onClick={onNewResume}
        >
          <span className="dashboard-action-icon">
            ✨
          </span>
          <span>
            Create New Resume
          </span>
        </button>

        <button
          type="button"
          className="dashboard-action-card"
          onClick={onAnalyze}
        >
          <span className="dashboard-action-icon">
            🔍
          </span>
          <span>
            Analyze a Resume
          </span>
        </button>

      </div>

      <h2 className="dashboard-subtitle">Career toolkit</h2>

      <div className="dashboard-actions tools-row">

        {[
          ["cover-letter", "✉️", "Cover Letter"],
          ["linkedin", "💼", "LinkedIn Optimiser"],
          ["mock-interview", "🎤", "Mock Interview"],
          ["portfolio", "🌐", "Portfolio Builder"],
        ].map(([toolPage, icon, label]) => (
          <button
            key={toolPage}
            type="button"
            className="dashboard-action-card compact"
            onClick={() => onOpenTool(toolPage)}
          >
            <span className="dashboard-action-icon">
              {icon}
            </span>
            <span>
              {label}
            </span>
          </button>
        ))}

      </div>

      {draft && (
        <div className="draft-banner">

          <div>
            <strong>
              You have an unfinished resume
              {draft.resumeData?.name
                ? ` for ${draft.resumeData.name}`
                : ""}
            </strong>
            <span>
              Pick up where you left off, or
              discard it.
            </span>
          </div>

          <div className="draft-banner-actions">
            <button
              type="button"
              onClick={onContinueDraft}
            >
              Continue draft
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                localStorage.removeItem(
                  "resumepilot_draft"
                );
                setDraft(null);
              }}
            >
              Discard
            </button>
          </div>

        </div>
      )}

      {error && (
        <div className="analyze-error">
          ⚠️ {error}
        </div>
      )}

      {isLoading ? (
        <p className="dashboard-loading">
          Loading your dashboard...
        </p>
      ) : (
        <>

          <section className="dashboard-section">

            <h2>
              My Resumes
            </h2>

            {resumes.length === 0 ? (
              <p className="dashboard-empty">
                You haven't saved a resume yet.
                Create one and click "💾 Save to
                My Resumes" to see it here.
              </p>
            ) : (
              <div className="resume-card-grid">

                {resumes.map((resume) => (
                  <div
                    className="resume-card"
                    key={resume.id}
                  >

                    <div className="resume-card-title">
                      {resume.title}
                    </div>

                    <div className="resume-card-meta">
                      {resume.template ===
                      "modern"
                        ? "Modern template"
                        : "Classic template"}
                      {" · Updated "}
                      {formatDate(
                        resume.updated_at
                      )}
                    </div>

                    <div className="resume-card-actions">

                      <button
                        type="button"
                        onClick={() =>
                          onContinueResume(
                            resume.id
                          )
                        }
                      >
                        Continue Editing
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          handleDelete(
                            resume.id
                          )
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                ))}

              </div>
            )}

          </section>

          <section className="dashboard-section">

            <h2>
              Past Resume Analyses
            </h2>

            {reports.length === 0 ? (
              <p className="dashboard-empty">
                No analyses yet. Upload a resume
                and a job description to see your
                match score here.
              </p>
            ) : (
              <div className="report-list">

                {reports.map((report) => (
                  <div
                    className="report-row"
                    key={report.id}
                  >

                    <div className="report-row-score">
                      {report.matchScore}%
                    </div>

                    <div className="report-row-details">

                      <div className="report-row-title">
                        {report.resumeFilename ||
                          "Resume"}
                      </div>

                      <div className="report-row-meta">
                        {formatDate(
                          report.createdAt
                        )}
                      </div>

                    </div>

                  </div>
                ))}

              </div>
            )}

          </section>

          <section className="dashboard-section">

            <h2>
              Mock Interview Feedback
            </h2>

            {interviews.length === 0 ? (
              <p className="dashboard-empty">
                No practice interviews yet. Try a mock
                interview to get scored feedback.
              </p>
            ) : (
              <div className="report-list">

                {interviews.map((session) => (
                  <div
                    className="report-row"
                    key={session.id}
                  >

                    <div className="report-row-score">
                      {session.overallScore}
                    </div>

                    <div className="report-row-details">

                      <div className="report-row-title">
                        {session.role || "Interview"}
                      </div>

                      <div className="report-row-meta">
                        {session.type} ·{" "}
                        {formatDate(session.createdAt)}
                      </div>

                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTool(
                            "mock-interview",
                            session.id
                          )
                        }
                      >
                        View feedback
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeDocument(
                            "/interviews",
                            session.id,
                            setInterviews
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>

                  </div>
                ))}

              </div>
            )}

          </section>

          <section className="dashboard-section">

            <h2>
              My Cover Letters
            </h2>

            {letters.length === 0 ? (
              <p className="dashboard-empty">
                No saved cover letters yet.
              </p>
            ) : (
              <div className="report-list">

                {letters.map((letter) => (
                  <div
                    className="report-row"
                    key={letter.id}
                  >

                    <div className="report-row-details">

                      <div className="report-row-title">
                        {letter.title}
                      </div>

                      <div className="report-row-meta">
                        {formatDate(letter.created_at)}
                      </div>

                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTool(
                            "cover-letter",
                            letter.id
                          )
                        }
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeDocument(
                            "/cover-letters",
                            letter.id,
                            setLetters
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>

                  </div>
                ))}

              </div>
            )}

          </section>

          <section className="dashboard-section">

            <h2>
              My Portfolios
            </h2>

            {portfolios.length === 0 ? (
              <p className="dashboard-empty">
                No portfolio yet. Build one from your
                resume in a few clicks.
              </p>
            ) : (
              <div className="report-list">

                {portfolios.map((portfolio) => (
                  <div
                    className="report-row"
                    key={portfolio.id}
                  >

                    <div className="report-row-details">

                      <div className="report-row-title">
                        {portfolio.title}
                      </div>

                      <div className="report-row-meta">
                        {portfolio.isPublic
                          ? "Published"
                          : "Private"}{" "}
                        · {formatDate(portfolio.updatedAt)}
                      </div>

                    </div>

                    <div className="row-actions">
                      {portfolio.isPublic && (
                        <a
                          className="row-link"
                          href={`${API_ORIGIN}${portfolio.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View site
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onOpenTool(
                            "portfolio",
                            portfolio.id
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeDocument(
                            "/portfolios",
                            portfolio.id,
                            setPortfolios
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>

                  </div>
                ))}

              </div>
            )}

          </section>

        </>
      )}

    </div>
  );
}

export default Dashboard;
