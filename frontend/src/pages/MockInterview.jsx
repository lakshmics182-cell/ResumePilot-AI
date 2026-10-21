import { useEffect, useRef, useState } from "react";
import ResumeSource from "../ResumeSource";
import {
  apiForm,
  apiGet,
  apiSend,
  appendResumeSource,
  emptySource,
  getToken,
  resumeSourceReady,
} from "../toolsApi";

const SpeechRecognitionClass =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const canSpeak =
  typeof window !== "undefined" && Boolean(window.speechSynthesis);

function cleanForSpeech(text) {
  return String(text || "")
    .replace(/\uFE0F|\u200D/g, "")
    .replace(
      /[\u2190-\u21FF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function scoreColor(value) {
  return value >= 75 ? "#2fb572" : value >= 55 ? "#e0a325" : "#e05555";
}

function Ring({ value, label }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="score-ring">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} stroke="#eee9fb" strokeWidth="8" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={scoreColor(value)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="45" textAnchor="middle" fontSize="18" fontWeight="700" fill="#302c40">
          {value}
        </text>
      </svg>
      {label && <span className="score-ring-label">{label}</span>}
    </div>
  );
}

const DIMENSIONS = [
  ["content", "Content"],
  ["structure", "Structure"],
  ["specificity", "Specific detail"],
  ["clarity", "Clarity"],
];

function Bars({ values }) {
  return (
    <div className="mini-bars">
      {DIMENSIONS.map(([key, label]) => (
        <div className="bar-row" key={key}>
          <div className="bar-label">
            <span>{label}</span>
            <span>{values[key]}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${values[key]}%`,
                background: scoreColor(values[key]),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* One answer's feedback: used live and in the final report. */
function FeedbackCard({ evaluation, coach, improved, coachLoading }) {
  return (
    <div className="feedback-card">
      <div className="feedback-top">
        <Ring value={evaluation.score} label="This answer" />
        <Bars values={evaluation.breakdown} />
      </div>

      {evaluation.strengths.length > 0 && (
        <>
          <h3 className="results-subtitle">What worked</h3>
          <ul className="results-list strengths">
            {evaluation.strengths.map((item, index) => (
              <li key={index}>✓ {item.text}</li>
            ))}
          </ul>
        </>
      )}

      {evaluation.improvements.length > 0 && (
        <>
          <h3 className="results-subtitle">How to improve</h3>
          <ul className="results-list weaknesses">
            {evaluation.improvements.map((item, index) => (
              <li key={index}>⚠ {item.text}</li>
            ))}
          </ul>
        </>
      )}

      {evaluation.points.length > 0 && (
        <>
          <h3 className="results-subtitle">Points a strong answer covers</h3>
          <ul className="points-list">
            {evaluation.points.map((point) => (
              <li key={point.label} className={point.matched ? "hit" : "miss"}>
                {point.matched ? "✓" : "✗"} {point.label}
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="outline-box">
        <summary>How a strong answer is structured</summary>
        <ol>
          {evaluation.outline.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
        {evaluation.tip && <p>💡 {evaluation.tip}</p>}
      </details>

      {coachLoading && (
        <p className="coach-note muted">✨ Your AI coach is reviewing this answer...</p>
      )}

      {coach && (
        <div className="coach-note">
          <strong>✨ AI coach</strong>
          <p>{coach}</p>
        </div>
      )}

      {improved && (
        <div className="coach-note">
          <strong>A stronger version of your own answer</strong>
          <p>{improved}</p>
          <span className="muted">
            Uses only what you said. Add your own real details.
          </span>
        </div>
      )}
    </div>
  );
}

function ReportView({ report, onAgain, onBack }) {
  const { summary, items } = report;

  return (
    <div className="tool-result">
      <div className="result-card report-top">
        <Ring value={summary.overall} label="Overall" />
        <div>
          <span className={`verdict ${summary.verdict.tone}`}>
            {summary.verdict.label}
          </span>
          <p className="results-plain">
            You answered {summary.stats.answered} question
            {summary.stats.answered === 1 ? "" : "s"}
            {summary.stats.skipped ? ` and skipped ${summary.stats.skipped}` : ""}
            , averaging about {summary.stats.averageWords} words per answer.
            {summary.stats.fillerWords > 0 &&
              ` You used ${summary.stats.fillerWords} filler word${summary.stats.fillerWords > 1 ? "s" : ""}.`}
          </p>
          {report.id ? (
            <p className="results-note">✓ Saved to your account.</p>
          ) : (
            !getToken() && (
              <p className="results-note">
                Log in to save your interview history and track progress.
              </p>
            )
          )}
        </div>
      </div>

      <div className="result-card">
        <h2>Your scores</h2>
        <Bars values={summary.categories} />
      </div>

      {summary.strengths.length > 0 && (
        <div className="result-card">
          <h2>Strengths</h2>
          <ul className="results-list strengths">
            {summary.strengths.map((text, index) => (
              <li key={index}>✓ {text}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.improvements.length > 0 && (
        <div className="result-card">
          <h2>Areas to improve</h2>
          <ul className="results-list weaknesses">
            {summary.improvements.map((text, index) => (
              <li key={index}>⚠ {text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="result-card">
        <h2>Your practice plan</h2>
        <ol className="recommendation-list plain-ol">
          {summary.actionPlan.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ol>

        {summary.practiceAgain.length > 0 && (
          <>
            <h3 className="results-subtitle">Practise these again</h3>
            <ul className="results-list plain">
              {summary.practiceAgain.map((entry) => (
                <li key={entry.question}>
                  {entry.question} <em>({entry.topic}, {entry.score}/100)</em>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="result-card">
        <h2>Question by question</h2>
        {items.map((item, index) => (
          <details className="review-item" key={index}>
            <summary>
              <span className="category-tag">{item.question.category}</span>
              <span className="review-question">{item.question.text}</span>
              <span
                className="score-chip"
                style={{
                  background: item.evaluation
                    ? scoreColor(item.evaluation.score)
                    : "#c9c5d6",
                }}
              >
                {item.evaluation ? item.evaluation.score : "skipped"}
              </span>
            </summary>

            {item.evaluation ? (
              <>
                <h3 className="results-subtitle">Your answer</h3>
                <p className="your-answer">{item.answer}</p>
                <FeedbackCard
                  evaluation={item.evaluation}
                  coach={item.coach}
                  improved={item.improved}
                />
              </>
            ) : (
              <p className="results-empty">You skipped this question.</p>
            )}
          </details>
        ))}
      </div>

      <div className="updated-actions">
        <button type="button" className="analyze-button" onClick={onAgain}>
          ↻ Practise again
        </button>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function MockInterview({ onBack, sessionId = null }) {
  const [phase, setPhase] = useState(sessionId ? "loading" : "setup");

  const [source, setSource] = useState(() => emptySource(true));
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("fresher");
  const [type, setType] = useState("mixed");
  const [count, setCount] = useState(5);
  const [jobDescription, setJobDescription] = useState("");

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [coach, setCoach] = useState({ loading: false, text: "", improved: "" });
  const [answers, setAnswers] = useState({});

  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const recognitionRef = useRef(null);

  const question = questions[index];

  /* ---------- load a saved session / history ---------- */

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    let cancelled = false;

    apiGet(`/interviews/${sessionId}`)
      .then((data) => {
        if (!cancelled) {
          setReport({ summary: data.summary, items: data.items, id: data.id });
          setPhase("report");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setPhase("setup");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!getToken()) {
      return undefined;
    }

    let cancelled = false;

    apiGet("/interviews")
      .then((data) => {
        if (!cancelled) {
          setHistory(data.sessions || []);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- speech ---------- */

  const stopVoice = () => {
    recognitionRef.current?.stop();

    if (canSpeak) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => stopVoice, []);

  const speakQuestion = (text) => {
    if (!canSpeak || !text) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (phase === "interview" && readAloud && question) {
      speakQuestion(question.text);
    }
    // Read each new question aloud when the toggle is on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, readAloud]);

  const toggleDictation = () => {
    if (!SpeechRecognitionClass) {
      setError(
        "Voice input isn't supported in this browser. Try Chrome or Edge, or type your answer."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    if (canSpeak) {
      window.speechSynthesis.cancel();
    }

    setError("");

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    const base = answer.trim();
    let finalText = "";

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice input stopped. You can try again or type your answer.");
    };
    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += `${piece} `;
        } else {
          interim += piece;
        }
      }

      setAnswer(
        `${base ? `${base} ` : ""}${(finalText + interim).trim()}`
      );
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ---------- interview flow ---------- */

  const start = async () => {
    setError("");
    setIsWorking(true);

    try {
      const form = new FormData();

      if (source.mode !== "none") {
        appendResumeSource(form, source);
      }

      form.set("role", role);
      form.set("level", level);
      form.set("type", type);
      form.set("count", String(count));
      form.set("jobDescription", jobDescription);

      const data = await apiForm("/interviews/questions", form);

      setQuestions(data.questions);
      setIndex(0);
      setAnswer("");
      setEvaluation(null);
      setAnswers({});
      setReport(null);
      setPhase("interview");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      setError("Please type or speak an answer first, or skip the question.");
      return;
    }

    recognitionRef.current?.stop();
    setError("");
    setIsWorking(true);

    const asked = question;
    const given = answer;

    try {
      const data = await apiSend("/interviews/evaluate", "POST", {
        question: asked,
        answer: given,
      });

      setEvaluation(data.evaluation);
      setAnswers((previous) => ({
        ...previous,
        [index]: { question: asked, answer: given, coach: "", improved: "" },
      }));

      // The AI coach note arrives later; scoring never waits for it.
      setCoach({ loading: true, text: "", improved: "" });

      apiSend("/interviews/coach", "POST", {
        question: asked,
        answer: given,
        role,
      })
        .then((result) => {
          setCoach({
            loading: false,
            text: result.coach || "",
            improved: result.improved || "",
          });
          setAnswers((previous) => ({
            ...previous,
            [index]: {
              ...previous[index],
              coach: result.coach || "",
              improved: result.improved || "",
            },
          }));
        })
        .catch(() => setCoach({ loading: false, text: "", improved: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  const finish = async (finalAnswers) => {
    setIsWorking(true);
    setError("");

    try {
      const data = await apiSend("/interviews/finish", "POST", {
        role,
        level,
        type,
        items: questions.map(
          (asked, position) =>
            finalAnswers[position] || { question: asked, answer: "" }
        ),
      });

      setReport({ summary: data.summary, items: data.items, id: data.id });
      setPhase("report");

      if (getToken()) {
        apiGet("/interviews")
          .then((list) => setHistory(list.sessions || []))
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  const goNext = (latestAnswers) => {
    stopVoice();

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setAnswer("");
      setEvaluation(null);
      setCoach({ loading: false, text: "", improved: "" });
      setError("");
    } else {
      finish(latestAnswers);
    }
  };

  const skip = () => {
    const next = {
      ...answers,
      [index]: { question, answer: "", coach: "", improved: "" },
    };

    setAnswers(next);
    goNext(next);
  };

  const removeSession = async (id) => {
    if (!window.confirm("Delete this interview and its feedback?")) {
      return;
    }

    try {
      await apiSend(`/interviews/${id}`, "DELETE");
      setHistory((previous) => previous.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const openSession = async (id) => {
    setError("");

    try {
      const data = await apiGet(`/interviews/${id}`);

      setReport({ summary: data.summary, items: data.items, id: data.id });
      setPhase("report");
    } catch (err) {
      setError(err.message);
    }
  };

  const resetToSetup = () => {
    stopVoice();
    setReport(null);
    setPhase("setup");
  };

  /* ---------- render ---------- */

  if (phase === "loading") {
    return (
      <div className="create-resume-loading">
        <div className="loading-spinner" />
        <p>Loading your interview...</p>
      </div>
    );
  }

  return (
    <div className="tool-page">
      <button
        className="back-button"
        onClick={() => {
          stopVoice();
          onBack();
        }}
      >
        ← Back
      </button>

      <div className="tool-header">
        <h1>Mock Interview</h1>
        <p>
          Practise out loud or in writing, and get a score and feedback on
          every answer.
        </p>
      </div>

      {phase === "setup" && (
        <>
          <div className="tool-form">
            <label className="field-label">
              Your resume <span className="optional">(optional)</span>
            </label>
            <ResumeSource value={source} onChange={setSource} allowNone />

            <label className="field-label">The role you're interviewing for</label>
            <input
              type="text"
              placeholder="Example: Web Developer"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            />

            <div className="field-row three">
              <div>
                <label className="field-label">Level</label>
                <select value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option value="fresher">Fresher / student</option>
                  <option value="experienced">Experienced</option>
                </select>
              </div>
              <div>
                <label className="field-label">Interview type</label>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="mixed">Mixed (HR + technical)</option>
                  <option value="hr">HR &amp; behavioural</option>
                  <option value="technical">Technical &amp; projects</option>
                </select>
              </div>
              <div>
                <label className="field-label">Questions</label>
                <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                  {[3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="field-label">
              A job description <span className="optional">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Paste one to focus the technical questions on its skills..."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
            />

            {error && <div className="analyze-error">⚠️ {error}</div>}

            <button
              type="button"
              className="analyze-button"
              onClick={start}
              disabled={
                isWorking ||
                !role.trim() ||
                (source.mode !== "none" && !resumeSourceReady(source, true))
              }
            >
              {isWorking ? "Preparing your questions..." : "Start interview →"}
            </button>
          </div>

          {history.length > 0 && (
            <div className="result-card">
              <h2>Your past interviews</h2>
              <ul className="history-list">
                {history.map((session) => (
                  <li key={session.id}>
                    <span
                      className="score-chip"
                      style={{ background: scoreColor(session.overallScore) }}
                    >
                      {session.overallScore}
                    </span>
                    <div>
                      <strong>{session.role || "Interview"}</strong>
                      <span className="muted">
                        {" "}
                        · {session.type} · {String(session.createdAt).slice(0, 10)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => openSession(session.id)}
                    >
                      View feedback
                    </button>
                    <button
                      type="button"
                      className="mini-button danger"
                      onClick={() => removeSession(session.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {phase === "interview" && question && (
        <div className="interview-area">
          <div className="interview-progress">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="question-card">
            <div className="question-meta">
              <span className="category-tag">{question.category}</span>
              {canSpeak && (
                <div className="voice-tools">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => speakQuestion(question.text)}
                  >
                    🔊 Read aloud
                  </button>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={readAloud}
                      onChange={(event) => setReadAloud(event.target.checked)}
                    />
                    Auto-read
                  </label>
                </div>
              )}
            </div>
            <h2>{question.text}</h2>
          </div>

          {!evaluation && (
            <div className="answer-box">
              <textarea
                rows={7}
                placeholder="Type your answer, or press the microphone and speak..."
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={isWorking}
              />

              <div className="answer-tools">
                <span className="word-count">
                  {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
                </span>

                <button
                  type="button"
                  className={`mic-button${listening ? " listening" : ""}`}
                  onClick={toggleDictation}
                  title="Speak your answer"
                >
                  {listening ? "⏹" : "🎙️"}
                </button>
              </div>

              {question.tip && (
                <details className="outline-box">
                  <summary>Need a hint?</summary>
                  <p>💡 {question.tip}</p>
                  <ul className="points-list">
                    {question.expectedPoints.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </details>
              )}

              {error && <div className="analyze-error">⚠️ {error}</div>}

              <div className="updated-actions">
                <button
                  type="button"
                  className="analyze-button"
                  onClick={submitAnswer}
                  disabled={isWorking}
                >
                  {isWorking ? "Scoring your answer..." : "Submit answer"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={skip}
                  disabled={isWorking}
                >
                  Skip question
                </button>
              </div>
            </div>
          )}

          {evaluation && (
            <>
              <p className="your-answer">
                <strong>Your answer: </strong>
                {answers[index]?.answer}
              </p>

              <FeedbackCard
                evaluation={evaluation}
                coach={coach.text}
                improved={coach.improved}
                coachLoading={coach.loading}
              />

              {error && <div className="analyze-error">⚠️ {error}</div>}

              <div className="updated-actions">
                <button
                  type="button"
                  className="analyze-button"
                  onClick={() => goNext(answers)}
                  disabled={isWorking}
                >
                  {index + 1 < questions.length
                    ? "Next question →"
                    : isWorking
                    ? "Building your report..."
                    : "Finish & see report →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "report" && report && (
        <ReportView report={report} onAgain={resetToSetup} onBack={onBack} />
      )}
    </div>
  );
}

export default MockInterview;
