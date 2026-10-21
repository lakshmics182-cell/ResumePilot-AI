import { useEffect, useRef, useState } from "react";
import { apiGet, getToken } from "./toolsApi";

/*
 * Lets the person say which resume a tool should use:
 *   - one of their saved resumes (needs login)
 *   - an uploaded PDF / DOCX
 *   - pasted text
 *   - (optionally) none
 */
function ResumeSource({ value, onChange, allowNone = false }) {
  const [saved, setSaved] = useState([]);
  const [loadError, setLoadError] = useState("");
  const fileRef = useRef(null);
  const loggedIn = Boolean(getToken());

  useEffect(() => {
    if (!loggedIn) {
      return undefined;
    }

    let cancelled = false;

    apiGet("/resumes")
      .then((data) => {
        if (cancelled) {
          return;
        }

        setSaved(data.resumes || []);

        if (
          value.mode === "saved" &&
          !value.resumeId &&
          data.resumes &&
          data.resumes.length
        ) {
          onChange({ ...value, resumeId: data.resumes[0].id });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
    // Load the list once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    ...(allowNone ? [["none", "Skip"]] : []),
    ...(loggedIn ? [["saved", "My saved resumes"]] : []),
    ["upload", "Upload file"],
    ["paste", "Paste text"],
  ];

  return (
    <div className="resume-source">
      <div className="source-tabs">
        {tabs.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={value.mode === mode ? "active" : ""}
            onClick={() => onChange({ ...value, mode })}
          >
            {label}
          </button>
        ))}
      </div>

      {value.mode === "none" && (
        <p className="source-note">
          Questions will be based on the role you enter. Add a
          resume for questions about your own projects.
        </p>
      )}

      {value.mode === "saved" &&
        (saved.length ? (
          <select
            value={value.resumeId}
            onChange={(event) =>
              onChange({ ...value, resumeId: event.target.value })
            }
          >
            {saved.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        ) : (
          <p className="source-note">
            {loadError ||
              "You haven't saved a resume yet. Build one, or upload or paste a resume instead."}
          </p>
        ))}

      {value.mode === "upload" && (
        <div className="source-upload">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(event) =>
              onChange({
                ...value,
                file: event.target.files?.[0] || null,
              })
            }
          />
          <span>
            {value.file ? value.file.name : "PDF or DOCX"}
          </span>
        </div>
      )}

      {value.mode === "paste" && (
        <textarea
          rows={6}
          placeholder="Paste the text of your resume here..."
          value={value.text}
          onChange={(event) =>
            onChange({ ...value, text: event.target.value })
          }
        />
      )}
    </div>
  );
}

export default ResumeSource;
