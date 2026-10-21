"use strict";

/*
 * Portfolio builder.
 *
 *   portfolioDataFromProfile()  resume profile -> editable portfolio data
 *   sanitizePortfolioData()     trims, caps and validates anything a
 *                               client sends
 *   renderPortfolioHtml()       data -> one standalone HTML page
 *
 * The page is generated on the server from structured data and every
 * value is escaped, so a published portfolio can never run script
 * written by its owner (or anyone else).
 */

const { findSkills } = require("./resumeAnalysis");
const { skillType, educationInfo, entryText } = require("./careerTools");

const THEMES = {
  indigo: {
    label: "Indigo",
    bg: "#f7f6ff",
    card: "#ffffff",
    text: "#26223a",
    muted: "#6b667c",
    accent: "#6c4df6",
    accentText: "#ffffff",
    line: "#e7e3f5",
    hero: "linear-gradient(135deg,#6c4df6,#9b7bff)",
  },
  midnight: {
    label: "Midnight",
    bg: "#0f1222",
    card: "#171b30",
    text: "#eceaf8",
    muted: "#a5a2c0",
    accent: "#8fa2ff",
    accentText: "#0f1222",
    line: "#262b47",
    hero: "linear-gradient(135deg,#1b2147,#2b3478)",
  },
  forest: {
    label: "Forest",
    bg: "#f3f8f4",
    card: "#ffffff",
    text: "#1c2b22",
    muted: "#5d7266",
    accent: "#2e8b57",
    accentText: "#ffffff",
    line: "#dbe9e0",
    hero: "linear-gradient(135deg,#2e8b57,#58b57f)",
  },
  sunset: {
    label: "Sunset",
    bg: "#fff8f3",
    card: "#ffffff",
    text: "#33241f",
    muted: "#7a625a",
    accent: "#e4572e",
    accentText: "#ffffff",
    line: "#f3e0d6",
    hero: "linear-gradient(135deg,#e4572e,#f29e4c)",
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text)
    ? text
    : `https://${text}`;

  try {
    const url = new URL(withScheme);

    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function cap(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function capBlock(value, max) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

function slugify(text) {
  const base = String(text || "portfolio")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  return base || "portfolio";
}

function looksLikeSentence(title) {
  const first = (String(title).match(/^[A-Za-z]+/) || [""])[0].toLowerCase();

  return (
    first.endsWith("ed") ||
    ["built", "led", "wrote", "made", "ran"].includes(first) ||
    String(title).split(/\s+/).length > 6
  );
}

/* ------------------------------------------------------------------ */
/* Resume profile -> portfolio data                                   */
/* ------------------------------------------------------------------ */

function portfolioDataFromProfile(profile, { headline } = {}) {
  const edu = educationInfo(profile);
  const stage = edu.degree
    ? `${edu.degree} ${edu.pursuing ? "Student" : "Graduate"}`
    : "";

  const topSkills = profile.skills
    .filter((name) => skillType(name) === "tech")
    .slice(0, 3);

  const defaultHeadline =
    profile.jobTitle ||
    [stage, topSkills.join(" • ")].filter(Boolean).join(" | ") ||
    "Aspiring professional";

  const groups = [
    {
      group: "Technical skills",
      items: profile.skills.filter((name) => skillType(name) === "tech"),
    },
    {
      group: "Concepts",
      items: profile.skills.filter((name) => skillType(name) === "concept"),
    },
    {
      group: "Professional skills",
      items: profile.skills.filter((name) => skillType(name) === "soft"),
    },
  ].filter((group) => group.items.length);

  const projects = (profile.projects || []).map((entry, index) => {
    const text = entryText(entry);

    return {
      title:
        entry.title && !looksLikeSentence(entry.title)
          ? entry.title
          : `Project ${index + 1}`,
      description: (
        looksLikeSentence(entry.title) && !entry.bullets.includes(entry.title)
          ? [entry.title, ...entry.bullets]
          : entry.bullets
      ).join(" "),
      tech: [...findSkills(text)].filter(
        (name) => skillType(name) === "tech"
      ),
      link: "",
    };
  });

  return {
    name: profile.name || "Your Name",
    headline: headline || defaultHeadline,
    about:
      profile.summary ||
      `I'm ${stage ? `a ${stage.toLowerCase()}` : "an early-career professional"} building skills in ${
        topSkills.join(", ") || "technology"
      }.`,
    email: profile.email || "",
    phone: profile.phone || "",
    location: profile.location || "",
    links: {
      github: profile.links.github || "",
      linkedin: profile.links.linkedin || "",
      website: profile.links.website || "",
    },
    skills: groups,
    projects,
    experience: (profile.experience || []).map((entry) => ({
      title: entry.title,
      details: (entry.bullets || []).join("\n"),
    })),
    education: (profile.education || []).map((entry) => ({
      title: entry.title,
      details: (entry.bullets || []).join("\n"),
    })),
    certifications: (profile.certifications || []).map((entry) =>
      entry.title || (entry.bullets || [])[0] || ""
    ).filter(Boolean),
    achievements: (profile.achievements || []).map((entry) =>
      entry.title || (entry.bullets || [])[0] || ""
    ).filter(Boolean),
    theme: "indigo",
  };
}

/* ------------------------------------------------------------------ */
/* Sanitising client data                                             */
/* ------------------------------------------------------------------ */

function sanitizePortfolioData(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const list = (value, limit) =>
    (Array.isArray(value) ? value : []).slice(0, limit);

  const email = cap(data.email, 120);

  return {
    name: cap(data.name, 80) || "Your Name",
    headline: cap(data.headline, 200),
    about: capBlock(data.about, 3000),
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : "",
    phone: cap(data.phone, 30).replace(/[^\d+\-() ]/g, ""),
    location: cap(data.location, 80),
    links: {
      github: safeUrl(data.links && data.links.github),
      linkedin: safeUrl(data.links && data.links.linkedin),
      website: safeUrl(data.links && data.links.website),
    },
    skills: list(data.skills, 8)
      .map((group) => ({
        group: cap(group && group.group, 60),
        items: list(group && group.items, 40)
          .map((item) => cap(item, 40))
          .filter(Boolean),
      }))
      .filter((group) => group.group && group.items.length),
    projects: list(data.projects, 12)
      .map((project) => ({
        title: cap(project && project.title, 100),
        description: capBlock(project && project.description, 800),
        tech: list(project && project.tech, 15)
          .map((item) => cap(item, 30))
          .filter(Boolean),
        link: safeUrl(project && project.link),
      }))
      .filter((project) => project.title),
    experience: list(data.experience, 10)
      .map((item) => ({
        title: cap(item && item.title, 120),
        details: capBlock(item && item.details, 1200),
      }))
      .filter((item) => item.title),
    education: list(data.education, 6)
      .map((item) => ({
        title: cap(item && item.title, 160),
        details: capBlock(item && item.details, 600),
      }))
      .filter((item) => item.title),
    certifications: list(data.certifications, 15)
      .map((item) => cap(item, 140))
      .filter(Boolean),
    achievements: list(data.achievements, 15)
      .map((item) => cap(item, 160))
      .filter(Boolean),
    theme: THEMES[data.theme] ? data.theme : "indigo",
  };
}

/* ------------------------------------------------------------------ */
/* HTML rendering                                                     */
/* ------------------------------------------------------------------ */

function paragraphs(text) {
  return String(text)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
}

function renderPortfolioHtml(input) {
  const data = sanitizePortfolioData(input);
  const t = THEMES[data.theme];

  const sections = [];
  const nav = [];

  const addSection = (id, title, body) => {
    nav.push(`<a href="#${id}">${esc(title)}</a>`);
    sections.push(
      `<section id="${id}"><h2>${esc(title)}</h2>${body}</section>`
    );
  };

  if (data.about) {
    addSection("about", "About", `<div class="prose">${paragraphs(data.about)}</div>`);
  }

  if (data.skills.length) {
    addSection(
      "skills",
      "Skills",
      data.skills
        .map(
          (group) =>
            `<div class="skill-group"><h3>${esc(group.group)}</h3><div class="chips">${group.items
              .map((item) => `<span class="chip">${esc(item)}</span>`)
              .join("")}</div></div>`
        )
        .join("")
    );
  }

  if (data.projects.length) {
    addSection(
      "projects",
      "Projects",
      `<div class="cards">${data.projects
        .map(
          (project) =>
            `<article class="card"><h3>${esc(project.title)}</h3>${
              project.description ? `<p>${esc(project.description)}</p>` : ""
            }${
              project.tech.length
                ? `<div class="chips small">${project.tech
                    .map((item) => `<span class="chip">${esc(item)}</span>`)
                    .join("")}</div>`
                : ""
            }${
              project.link
                ? `<a class="link" href="${esc(project.link)}" target="_blank" rel="noopener noreferrer">View project →</a>`
                : ""
            }</article>`
        )
        .join("")}</div>`
    );
  }

  if (data.experience.length) {
    addSection(
      "experience",
      "Experience",
      data.experience
        .map(
          (item) =>
            `<div class="timeline-item"><h3>${esc(item.title)}</h3>${
              item.details
                ? `<ul>${item.details
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => `<li>${esc(line)}</li>`)
                    .join("")}</ul>`
                : ""
            }</div>`
        )
        .join("")
    );
  }

  if (data.education.length) {
    addSection(
      "education",
      "Education",
      data.education
        .map(
          (item) =>
            `<div class="timeline-item"><h3>${esc(item.title)}</h3>${
              item.details
                ? `<ul>${item.details
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => `<li>${esc(line)}</li>`)
                    .join("")}</ul>`
                : ""
            }</div>`
        )
        .join("")
    );
  }

  if (data.certifications.length || data.achievements.length) {
    addSection(
      "highlights",
      "Certifications & Achievements",
      `<ul class="plain">${[...data.certifications, ...data.achievements]
        .map((item) => `<li>${esc(item)}</li>`)
        .join("")}</ul>`
    );
  }

  const contactBits = [
    data.email &&
      `<a href="mailto:${esc(data.email)}">${esc(data.email)}</a>`,
    data.phone && `<a href="tel:${esc(data.phone)}">${esc(data.phone)}</a>`,
    data.location && `<span>${esc(data.location)}</span>`,
    data.links.github &&
      `<a href="${esc(data.links.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>`,
    data.links.linkedin &&
      `<a href="${esc(data.links.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`,
    data.links.website &&
      `<a href="${esc(data.links.website)}" target="_blank" rel="noopener noreferrer">Website</a>`,
  ].filter(Boolean);

  if (contactBits.length) {
    addSection(
      "contact",
      "Contact",
      `<div class="contact">${contactBits.join("")}</div>`
    );
  }

  const heroButtons = [
    data.email &&
      `<a class="btn primary" href="mailto:${esc(data.email)}">Get in touch</a>`,
    data.links.github &&
      `<a class="btn" href="${esc(data.links.github)}" target="_blank" rel="noopener noreferrer">GitHub</a>`,
    data.links.linkedin &&
      `<a class="btn" href="${esc(data.links.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.name)} | Portfolio</title>
<meta name="description" content="${esc(data.headline || `${data.name}'s portfolio`)}">
<style>
:root{--bg:${t.bg};--card:${t.card};--text:${t.text};--muted:${t.muted};--accent:${t.accent};--accent-text:${t.accentText};--line:${t.line}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
a{color:var(--accent)}
.nav{position:sticky;top:0;z-index:5;display:flex;gap:18px;flex-wrap:wrap;justify-content:center;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--line);font-size:14px}
.nav a{text-decoration:none;color:var(--muted);font-weight:600}
.nav a:hover{color:var(--accent)}
.hero{background:${t.hero};color:#fff;text-align:center;padding:72px 20px 64px}
.hero h1{margin:0 0 8px;font-size:clamp(32px,6vw,54px);letter-spacing:-.5px}
.hero p{margin:0 auto 24px;max-width:640px;font-size:clamp(15px,2.4vw,19px);opacity:.92}
.btn{display:inline-block;margin:4px;padding:10px 20px;border-radius:999px;border:1.5px solid #fff;color:#fff;text-decoration:none;font-weight:600;font-size:14px}
.btn.primary{background:#fff;color:#222}
main{max-width:920px;margin:0 auto;padding:12px 20px 60px}
section{padding:36px 0 8px}
h2{font-size:24px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid var(--line)}
h3{margin:0 0 6px;font-size:17px}
.prose p{margin:0 0 12px;color:var(--text)}
.skill-group{margin-bottom:16px}
.skill-group h3{font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{padding:5px 12px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:13px;font-weight:600}
.chips.small .chip{font-size:12px;padding:3px 10px;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.card p{margin:0 0 12px;color:var(--muted);font-size:14px}
.link{display:inline-block;margin-top:12px;font-size:14px;font-weight:600;text-decoration:none}
.timeline-item{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 18px;margin-bottom:12px}
.timeline-item ul,.plain{margin:6px 0 0;padding-left:20px;color:var(--muted);font-size:14px}
.plain li{margin-bottom:6px}
.contact{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:15px}
footer{text-align:center;padding:24px;color:var(--muted);font-size:12px}
@media print{.nav{display:none}.hero{padding:24px}}
</style>
</head>
<body>
<nav class="nav">${nav.join("")}</nav>
<header class="hero">
<h1>${esc(data.name)}</h1>
${data.headline ? `<p>${esc(data.headline)}</p>` : ""}
<div>${heroButtons}</div>
</header>
<main>
${sections.join("\n")}
</main>
<footer>Built with ResumePilot AI</footer>
</body>
</html>`;
}

module.exports = {
  THEMES,
  portfolioDataFromProfile,
  sanitizePortfolioData,
  renderPortfolioHtml,
  slugify,
  safeUrl,
};
