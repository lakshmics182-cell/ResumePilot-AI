import { Component, useEffect, useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ConversationMode from "./pages/ConversationMode";
import CreateResume from "./pages/CreateResume";
import AnalyzeResume from "./pages/AnalyzeResume";
import CareerTools from "./pages/CareerTools";
import CoverLetter from "./pages/CoverLetter";
import LinkedInOptimizer from "./pages/LinkedInOptimizer";
import MockInterview from "./pages/MockInterview";
import PortfolioBuilder from "./pages/PortfolioBuilder";

function getStoredUser() {
  const storedToken = localStorage.getItem(
    "resumepilot_token"
  );
  const storedUser = localStorage.getItem(
    "resumepilot_user"
  );

  if (!storedToken || !storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem("resumepilot_token");
    localStorage.removeItem("resumepilot_user");
    return null;
  }
}

/*
 * If any page crashes while drawing, show a readable message
 * instead of a blank white screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(
      "The app crashed while drawing a page:",
      error,
      info && info.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 560,
            margin: "80px auto",
            padding: "0 20px",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            color: "#302c40",
          }}
        >
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#6b667c", lineHeight: 1.5 }}>
            This page hit an unexpected error. Your saved resumes are safe.
            If you just updated the app, make sure both the backend and
            the frontend are the latest versions and restarted.
          </p>
          <pre
            style={{
              textAlign: "left",
              whiteSpace: "pre-wrap",
              background: "#fdeceb",
              color: "#c0392b",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {String(
              (this.state.error && this.state.error.message) ||
                this.state.error
            )}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 22px",
              border: "none",
              borderRadius: 10,
              background: "#6c4df6",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload the app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(
    getStoredUser
  );
  const [activeResumeId, setActiveResumeId] =
    useState(null);
  const [toolItemId, setToolItemId] = useState(null);
  const [toolOrigin, setToolOrigin] = useState("tools");

  const openTool = (toolPage, itemId = null, origin = "tools") => {
    setToolItemId(itemId);
    setToolOrigin(origin);
    setPage(toolPage);
  };

  const closeTool = () => setPage(toolOrigin);

  /*
   * If the server rejects our saved login token (expired, or the
   * server was restarted with a different secret), clear it and
   * return to the login page instead of leaving the user stuck on
   * an error banner. Login / register requests send no token, so a
   * wrong password is not affected.
   */
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      try {
        const init = args[1] || {};
        const source = args[0];
        const headers = new Headers(
          init.headers ||
            (source instanceof Request ? source.headers : undefined)
        );

        if (
          response.status === 401 &&
          (headers.get("Authorization") || "").startsWith("Bearer ") &&
          localStorage.getItem("resumepilot_token")
        ) {
          let serverMessage = "";

          try {
            const body = await response.clone().json();
            serverMessage = body?.error || "";
          } catch {
            // response had no JSON body
          }

          const method = (
            init.method ||
            (source instanceof Request ? source.method : "GET")
          ).toUpperCase();
          const url = String(
            source instanceof Request ? source.url : source
          ).replace(/^https?:\/\/[^/]+/, "");

          // Shown on the login page so the real cause is visible.
          setAuthNotice(
            `The server rejected your login on ${method} ${url}` +
              (serverMessage ? ` (${serverMessage})` : "") +
              ". Please log in again."
          );

          localStorage.removeItem("resumepilot_token");
          localStorage.removeItem("resumepilot_user");
          setUser(null);
          setPage("login");
        }
      } catch {
        // never let this helper break a normal request
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("resumepilot_token");
    localStorage.removeItem("resumepilot_user");
    setUser(null);
    setPage("home");
  };

  // LOGIN PAGE
  if (page === "login") {
    return (
      <Login
        notice={authNotice}
        onLogin={(loggedInUser) => {
          setAuthNotice("");
          setUser(loggedInUser);
          setPage("dashboard");
        }}
      />
    );
  }

  // DASHBOARD
  if (page === "dashboard" && user) {
    return (
      <Dashboard
        user={user}
        onNewResume={() => {
          // A brand-new resume must not reuse the autosaved
          // draft of a previous (e.g. text-mode) session.
          localStorage.removeItem("resumepilot_draft");
          setActiveResumeId(null);
          setPage("conversation");
        }}
        onContinueDraft={() => {
          setActiveResumeId(null);
          setPage("create-resume");
        }}
        onContinueResume={(resumeId) => {
          setActiveResumeId(resumeId);
          setPage("create-resume");
        }}
        onAnalyze={() => setPage("analyze")}
        onOpenTool={(toolPage, itemId) =>
          openTool(toolPage, itemId ?? null, "dashboard")
        }
        onLogout={handleLogout}
      />
    );
  }

  // SPEAK OR TEXT PAGE
  if (page === "conversation") {
    return (
      <ConversationMode
        onSpeak={() =>
          setPage("create-resume-voice")
        }
        onType={() => setPage("create-resume")}
      />
    );
  }

  // TEXT RESUME BUILDER
  if (page === "create-resume") {
    return (
      <CreateResume
        resumeId={activeResumeId}
        onBackToDashboard={
          user
            ? () => setPage("dashboard")
            : undefined
        }
      />
    );
  }

  // VOICE RESUME BUILDER
  if (page === "create-resume-voice") {
    return (
      <CreateResume
        preferVoice
        resumeId={activeResumeId}
        onBackToDashboard={
          user
            ? () => setPage("dashboard")
            : undefined
        }
      />
    );
  }

  // CAREER TOOLS
  if (page === "tools") {
    return (
      <CareerTools
        onBack={() => setPage("home")}
        onOpen={(toolPage) => openTool(toolPage, null, "tools")}
      />
    );
  }

  if (page === "cover-letter") {
    return <CoverLetter onBack={closeTool} letterId={toolItemId} />;
  }

  if (page === "linkedin") {
    return <LinkedInOptimizer onBack={closeTool} />;
  }

  if (page === "mock-interview") {
    return <MockInterview onBack={closeTool} sessionId={toolItemId} />;
  }

  if (page === "portfolio") {
    return <PortfolioBuilder onBack={closeTool} portfolioId={toolItemId} />;
  }

  // ANALYZE RESUME
  if (page === "analyze") {
    return (
      <AnalyzeResume
        onBack={() =>
          setPage(user ? "dashboard" : "home")
        }
        onEditSaved={(resumeId) => {
          setActiveResumeId(resumeId);
          setPage("create-resume");
        }}
      />
    );
  }

  // HOME PAGE
  return (
    <div className="home-page">

      <header className="brand">
        <div className="brand-logo">R</div>
        <span>ResumePilot</span>

        {user && (
          <div className="account-pill">
            <span>{user.name}</span>
            <button
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="welcome-section">

        <div className="welcome-icon">
          ✦
        </div>

        <h1>
          Welcome to <span>ResumePilot</span>
        </h1>

        <p className="welcome-text">
          Your AI-powered career assistant
        </p>

        <h2>
          What would you like to do?
        </h2>

        <p className="choose-text">
          Choose an option to get started.
        </p>

        <div className="choice-container">

          {/* CREATE RESUME */}

          <button
            className="choice-card"
            onClick={() =>
              setPage(
                user ? "dashboard" : "login"
              )
            }
          >
            <div className="choice-icon create-icon">
              📄
            </div>

            <h3>
              Create Resume
            </h3>

            <p>
              Create a professional and ATS-friendly
              resume with AI assistance.
            </p>

            <span className="card-action">
              Create my resume →
            </span>
          </button>


          {/* ANALYZE RESUME */}

          <button
            className="choice-card"
            onClick={() => setPage("analyze")}
          >
            <div className="choice-icon analyze-icon">
              🔍
            </div>

            <h3>
              Analyze Resume
            </h3>

            <p>
              Upload your resume and discover your
              ATS score, skills gaps and improvements.
            </p>

            <span className="card-action">
              Analyze my resume →
            </span>
          </button>


          {/* CAREER TOOLS */}

          <button
            className="choice-card"
            onClick={() => setPage("tools")}
          >
            <div className="choice-icon tools-icon">
              🚀
            </div>

            <h3>
              Career Tools
            </h3>

            <p>
              Cover letters, LinkedIn tips, mock
              interviews with feedback, and a
              portfolio website.
            </p>

            <span className="card-action">
              Explore tools →
            </span>
          </button>

        </div>

      </main>

      <footer className="home-footer">
        <p>ResumePilot AI</p>
        <span>Build smarter. Apply better.</span>
      </footer>

    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;