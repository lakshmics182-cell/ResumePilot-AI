import { useEffect, useRef, useState } from "react";
import ResumeSource from "../ResumeSource";
import {
  SERVER,
  apiForm,
  apiGet,
  apiSend,
  appendResumeSource,
  emptySource,
  getToken,
  resumeSourceReady,
} from "../toolsApi";

/* A comma-separated list editor that doesn't eat the commas you type. */
function CommaField({ value, onChange, placeholder }) {
  const [text, setText] = useState(value.join(", "));

  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        setText(event.target.value);
        onChange(
          event.target.value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        );
      }}
    />
  );
}

/* One item per line. */
function LinesField({ value, onChange, placeholder, rows = 3 }) {
  const [text, setText] = useState(value.join("\n"));

  return (
    <textarea
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        setText(event.target.value);
        onChange(
          event.target.value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        );
      }}
    />
  );
}

const BLANK = {
  name: "",
  headline: "",
  about: "",
  email: "",
  phone: "",
  location: "",
  links: { github: "", linkedin: "", website: "" },
  skills: [{ group: "Technical skills", items: [] }],
  projects: [],
  experience: [],
  education: [],
  certifications: [],
  achievements: [],
  theme: "indigo",
};

const FALLBACK_THEMES = [
  { id: "indigo", label: "Indigo", accent: "#6c4df6" },
  { id: "midnight", label: "Midnight", accent: "#8fa2ff" },
  { id: "forest", label: "Forest", accent: "#2e8b57" },
  { id: "sunset", label: "Sunset", accent: "#e4572e" },
];

function PortfolioBuilder({ onBack, portfolioId = null }) {
  const [data, setData] = useState(null);
  const [themes, setThemes] = useState(FALLBACK_THEMES);
  const [version, setVersion] = useState(0);
  const [source, setSource] = useState(() => emptySource());
  const [html, setHtml] = useState("");

  const [meta, setMeta] = useState(null); // saved portfolio info
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const timerRef = useRef(null);

  /* ---------- open a saved portfolio ---------- */

  useEffect(() => {
    if (!portfolioId) {
      return undefined;
    }

    let cancelled = false;

    apiGet(`/portfolios/${portfolioId}`)
      .then((saved) => {
        if (cancelled) {
          return;
        }

        setData(saved.data);
        setMeta({
          id: saved.id,
          slug: saved.slug,
          isPublic: saved.isPublic,
          url: saved.url,
        });
        setVersion((v) => v + 1);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  /* ---------- live preview ---------- */

  useEffect(() => {
    if (!data) {
      return undefined;
    }

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      apiSend("/portfolio/render", "POST", { data })
        .then((result) => setHtml(result.html))
        .catch((err) => setError(err.message));
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [data]);

  /* ---------- data editing helpers ---------- */

  const setField = (key, value) =>
    setData((previous) => ({ ...previous, [key]: value }));

  const setLink = (key, value) =>
    setData((previous) => ({
      ...previous,
      links: { ...previous.links, [key]: value },
    }));

  const updateItem = (listKey, position, patch) =>
    setData((previous) => ({
      ...previous,
      [listKey]: previous[listKey].map((item, i) =>
        i === position ? { ...item, ...patch } : item
      ),
    }));

  const addItem = (listKey, blank) => {
    setData((previous) => ({
      ...previous,
      [listKey]: [...previous[listKey], blank],
    }));
    setVersion((v) => v + 1);
  };

  const removeItem = (listKey, position) => {
    setData((previous) => ({
      ...previous,
      [listKey]: previous[listKey].filter((_, i) => i !== position),
    }));
    setVersion((v) => v + 1);
  };

  /* ---------- actions ---------- */

  const generate = async () => {
    setError("");
    setIsWorking(true);

    try {
      const form = new FormData();
      appendResumeSource(form, source);

      const result = await apiForm("/portfolio/from-resume", form);

      setData(result.data);
      setThemes(result.themes);
      setMeta(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWorking(false);
    }
  };

  const startBlank = () => {
    setData(BLANK);
    setMeta(null);
    setVersion((v) => v + 1);
  };

  const save = async (makePublic) => {
    if (!getToken()) {
      setStatus("Please log in to save and publish your portfolio.");
      return;
    }

    setStatus("");
    setError("");

    try {
      const isPublic =
        makePublic === undefined ? Boolean(meta && meta.isPublic) : makePublic;

      const body = { title: data.name, data, isPublic };

      const saved = meta
        ? await apiSend(`/portfolios/${meta.id}`, "PUT", body)
        : await apiSend("/portfolios", "POST", body);

      setMeta({
        id: saved.id,
        slug: saved.slug,
        isPublic: saved.isPublic,
        url: saved.url,
      });

      setStatus(
        saved.isPublic
          ? "✓ Saved and published."
          : "✓ Saved (private)."
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const download = () => {
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `${(data.name || "portfolio").replace(/\s+/g, "_")}_portfolio.html`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const publicLink = meta ? `${SERVER}${meta.url}` : "";

  /* ---------- start screen ---------- */

  if (!data) {
    return (
      <div className="tool-page">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>

        <div className="tool-header">
          <h1>Portfolio Builder</h1>
          <p>
            Turn your resume into a personal website you can edit, download
            or publish.
          </p>
        </div>

        <div className="tool-form">
          <label className="field-label">Start from your resume</label>
          <ResumeSource value={source} onChange={setSource} />

          {error && <div className="analyze-error">⚠️ {error}</div>}

          <button
            type="button"
            className="analyze-button"
            onClick={generate}
            disabled={isWorking || !resumeSourceReady(source)}
          >
            {isWorking ? "Building your portfolio..." : "Create my portfolio →"}
          </button>

          <button
            type="button"
            className="link-button center"
            onClick={startBlank}
          >
            or start from a blank portfolio
          </button>
        </div>
      </div>
    );
  }

  /* ---------- editor + live preview ---------- */

  return (
    <div className="portfolio-page">
      <div className="portfolio-bar">
        <button className="back-button inline" onClick={onBack}>
          ← Back
        </button>

        <div className="portfolio-actions">
          <button type="button" className="secondary-button small" onClick={download} disabled={!html}>
            ⬇ Download HTML
          </button>
          <button type="button" className="secondary-button small" onClick={() => save()}>
            💾 {meta ? "Save changes" : "Save"}
          </button>
          <button
            type="button"
            className="analyze-button small"
            onClick={() => save(!(meta && meta.isPublic))}
          >
            {meta && meta.isPublic ? "Unpublish" : "🌐 Publish"}
          </button>
        </div>
      </div>

      {(status || error || (meta && meta.isPublic)) && (
        <div className="portfolio-status">
          {error && <span className="status-error">⚠️ {error}</span>}
          {status && <span>{status}</span>}
          {meta && meta.isPublic && (
            <span>
              Live at{" "}
              <a href={publicLink} target="_blank" rel="noopener noreferrer">
                {publicLink}
              </a>
            </span>
          )}
        </div>
      )}

      <div className="portfolio-layout">
        <div className="portfolio-editor" key={version}>
          <h2>Theme</h2>
          <div className="theme-picker">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={data.theme === theme.id ? "active" : ""}
                onClick={() => setField("theme", theme.id)}
              >
                <span style={{ background: theme.accent }} />
                {theme.label}
              </button>
            ))}
          </div>

          <h2>Basics</h2>
          <label className="field-label">Name</label>
          <input type="text" value={data.name} onChange={(e) => setField("name", e.target.value)} />
          <label className="field-label">Headline</label>
          <input type="text" value={data.headline} onChange={(e) => setField("headline", e.target.value)} />
          <label className="field-label">About</label>
          <textarea rows={5} value={data.about} onChange={(e) => setField("about", e.target.value)} />

          <div className="field-row">
            <div>
              <label className="field-label">Email</label>
              <input type="text" value={data.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input type="text" value={data.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
          </div>
          <label className="field-label">Location</label>
          <input type="text" value={data.location} onChange={(e) => setField("location", e.target.value)} />

          <h2>Links</h2>
          <label className="field-label">GitHub</label>
          <input type="text" value={data.links.github} placeholder="github.com/yourname" onChange={(e) => setLink("github", e.target.value)} />
          <label className="field-label">LinkedIn</label>
          <input type="text" value={data.links.linkedin} placeholder="linkedin.com/in/yourname" onChange={(e) => setLink("linkedin", e.target.value)} />
          <label className="field-label">Website</label>
          <input type="text" value={data.links.website} onChange={(e) => setLink("website", e.target.value)} />

          <h2>Skills</h2>
          {data.skills.map((group, position) => (
            <div className="editor-item" key={position}>
              <input
                type="text"
                value={group.group}
                placeholder="Group name"
                onChange={(e) => updateItem("skills", position, { group: e.target.value })}
              />
              <CommaField
                value={group.items}
                placeholder="Python, React, SQL"
                onChange={(items) => updateItem("skills", position, { items })}
              />
              <button type="button" className="mini-button danger" onClick={() => removeItem("skills", position)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="mini-button" onClick={() => addItem("skills", { group: "", items: [] })}>
            + Add skill group
          </button>

          <h2>Projects</h2>
          {data.projects.map((project, position) => (
            <div className="editor-item" key={position}>
              <input type="text" value={project.title} placeholder="Project title" onChange={(e) => updateItem("projects", position, { title: e.target.value })} />
              <textarea rows={3} value={project.description} placeholder="What it does and what you built" onChange={(e) => updateItem("projects", position, { description: e.target.value })} />
              <CommaField value={project.tech} placeholder="Technologies: React, Firebase" onChange={(tech) => updateItem("projects", position, { tech })} />
              <input type="text" value={project.link} placeholder="Link (GitHub or live demo)" onChange={(e) => updateItem("projects", position, { link: e.target.value })} />
              <button type="button" className="mini-button danger" onClick={() => removeItem("projects", position)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="mini-button" onClick={() => addItem("projects", { title: "", description: "", tech: [], link: "" })}>
            + Add project
          </button>

          <h2>Experience</h2>
          {data.experience.map((item, position) => (
            <div className="editor-item" key={position}>
              <input type="text" value={item.title} placeholder="Role, company, dates" onChange={(e) => updateItem("experience", position, { title: e.target.value })} />
              <textarea rows={3} value={item.details} placeholder="One achievement per line" onChange={(e) => updateItem("experience", position, { details: e.target.value })} />
              <button type="button" className="mini-button danger" onClick={() => removeItem("experience", position)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="mini-button" onClick={() => addItem("experience", { title: "", details: "" })}>
            + Add experience
          </button>

          <h2>Education</h2>
          {data.education.map((item, position) => (
            <div className="editor-item" key={position}>
              <input type="text" value={item.title} placeholder="Degree, college, year" onChange={(e) => updateItem("education", position, { title: e.target.value })} />
              <textarea rows={2} value={item.details} placeholder="Details (optional)" onChange={(e) => updateItem("education", position, { details: e.target.value })} />
              <button type="button" className="mini-button danger" onClick={() => removeItem("education", position)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="mini-button" onClick={() => addItem("education", { title: "", details: "" })}>
            + Add education
          </button>

          <h2>Certifications</h2>
          <LinesField value={data.certifications} placeholder="One per line" onChange={(items) => setField("certifications", items)} />
          <h2>Achievements</h2>
          <LinesField value={data.achievements} placeholder="One per line" onChange={(items) => setField("achievements", items)} />
        </div>

        <div className="portfolio-preview">
          <div className="preview-label">Live preview</div>
          <iframe
            title="Portfolio preview"
            sandbox=""
            srcDoc={html}
          />
        </div>
      </div>

    </div>
  );
}

export default PortfolioBuilder;
