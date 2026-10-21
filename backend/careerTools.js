"use strict";

/*
 * Career tools: cover letters and LinkedIn optimisation.
 *
 * Like the analyzer, everything is built from the person's real
 * resume data with plain code, so it works with no AI at all.
 * Ollama (when running) is only asked to polish the wording, and its
 * output is rejected if it invents numbers, technologies or
 * placeholders.
 */

const {
  parseResume,
  analyzeJobDescription,
  findSkills,
  SKILL_DEFINITIONS,
} = require("./resumeAnalysis");

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
/* ------------------------------------------------------------------ */

const TYPE_ORDER = { tech: 0, concept: 1, soft: 2 };

function skillType(name) {
  const found = SKILL_DEFINITIONS.find((skill) => skill.name === name);
  return found ? found.type : "tech";
}

function orderSkills(names) {
  return [...names].sort(
    (a, b) =>
      (TYPE_ORDER[skillType(a)] ?? 0) -
      (TYPE_ORDER[skillType(b)] ?? 0)
  );
}

function words(text) {
  const found = String(text || "").match(/\S+/g);
  return found ? found.length : 0;
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function stripEnd(text) {
  return String(text || "").replace(/[\s.,;:!]+$/g, "").trim();
}

function joinList(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function splitList(text) {
  return String(text || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(list) {
  const seen = new Set();
  const out = [];

  for (const item of list) {
    const key = String(item).toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }

  return out;
}

/*
 * Some dictionary names are also everyday words ("express my
 * interest", "excel at", "react quickly"). When checking AI text for
 * invented technologies, those names only count when written like the
 * technology (capitalised).
 */
const CASE_SENSITIVE_TECH = {
  Express: /\bExpress(?:\.js)?\b/,
  Excel: /\bExcel\b/,
  Swift: /\bSwift\b/,
  "Spring Boot": /\bSpring Boot\b/,
  React: /\bReact(?:\.?js)?\b/,
  Oracle: /\bOracle\b/,
  Ruby: /\bRuby\b/,
  Flask: /\bFlask\b/,
  Git: /\bGit\b/,
};

function inventedTech(text, allowedSet) {
  return [...findSkills(text)].some((name) => {
    if (allowedSet.has(name) || skillType(name) !== "tech") {
      return false;
    }

    const strict = CASE_SENSITIVE_TECH[name];

    return strict ? strict.test(text) : true;
  });
}

function numbersIn(text) {
  return new Set(String(text).match(/\d+(?:\.\d+)?/g) || []);
}

function entryText(entry) {
  return `${entry.title || ""} ${(entry.bullets || []).join(" ")}`;
}

/* ------------------------------------------------------------------ */
/* Profile: one shape for every resume source                         */
/* ------------------------------------------------------------------ */

function extractLinks(text) {
  const value = String(text || "");

  const grab = (pattern) => {
    const match = value.match(pattern);

    if (!match) {
      return "";
    }

    return /^https?:\/\//i.test(match[0])
      ? match[0]
      : `https://${match[0]}`;
  };

  const github = grab(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.-]+/i
  );
  const linkedin = grab(
    /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+/i
  );

  return { github, linkedin };
}

function finishProfile(profile) {
  const text = profileText(profile);

  const dictionary = [...findSkills(text)];

  const listed = [
    ...splitList(profile.technicalSkills),
    ...splitList(profile.nonTechnicalSkills),
  ];

  const known = new Set(
    SKILL_DEFINITIONS.map((skill) => skill.name.toLowerCase())
  );

  // Dictionary names win ("javascript" -> "JavaScript"); anything the
  // person listed that we don't recognise is kept as they typed it.
  const extras = listed.filter(
    (item) =>
      !known.has(item.toLowerCase()) &&
      !dictionary.some(
        (name) => name.toLowerCase() === item.toLowerCase()
      )
  );

  return {
    ...profile,
    skills: unique([...orderSkills(dictionary), ...extras]),
    links: {
      ...extractLinks(text),
      ...(profile.links || {}),
    },
    rawText: text,
  };
}

function profileText(profile) {
  const entries = [
    ...(profile.education || []),
    ...(profile.experience || []),
    ...(profile.projects || []),
    ...(profile.certifications || []),
    ...(profile.achievements || []),
  ].map(entryText);

  return [
    profile.name,
    profile.email,
    profile.phone,
    profile.location,
    profile.jobTitle,
    profile.summary,
    profile.technicalSkills,
    profile.nonTechnicalSkills,
    profile.languages,
    ...entries,
    profile.sourceText || "",
  ]
    .filter(Boolean)
    .join("\n");
}

function profileFromText(text) {
  const parsed = parseResume(text);

  return finishProfile({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    location: parsed.location,
    jobTitle: "",
    summary: parsed.summary,
    technicalSkills: parsed.technicalSkills,
    nonTechnicalSkills: parsed.nonTechnicalSkills,
    languages: parsed.languages,
    education: parsed.education,
    experience: parsed.experience,
    projects: parsed.projects,
    certifications: parsed.certifications,
    achievements: parsed.achievements,
    sourceText: text,
  });
}

function profileFromBuilder(data) {
  const toEntries = (list, shorten) =>
    (list || []).map((item) => {
      const original =
        item && typeof item === "object" ? item.original : item;
      const enhanced =
        item && typeof item === "object" ? item.enhanced : item;

      const bullets = String(enhanced || original || "")
        .split(/\n+/)
        .map((line) => line.replace(/^[•●▪▸\-*]\s*/, "").trim())
        .filter(Boolean);

      const title = String(original || "").trim();

      return {
        title:
          shorten && words(title) > 9
            ? `${title.split(/\s+/).slice(0, 9).join(" ")}…`
            : title,
        bullets: shorten && bullets.length ? bullets : bullets,
      };
    });

  const languages = Array.isArray(data.languages)
    ? data.languages.join(", ")
    : data.languages || "";

  return finishProfile({
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    location: data.location || "",
    jobTitle: data.jobTitle || "",
    summary:
      data.professionalSummary ||
      [data.about, data.careerGoal].filter(Boolean).join(" "),
    technicalSkills: data.technicalSkills || "",
    nonTechnicalSkills: data.nonTechnicalSkills || "",
    languages,
    education: toEntries(data.education, false),
    experience: toEntries(data.experience, true),
    projects: toEntries(data.projects, true),
    certifications: toEntries(data.certifications, false),
    achievements: toEntries(data.achievements, false),
  });
}

/* ------------------------------------------------------------------ */
/* Education details (used by both tools)                             */
/* ------------------------------------------------------------------ */

const DEGREES = [
  ["MCA", /\bmca\b|master of computer applications/i],
  ["M.Tech", /\bm\.?\s?tech\b|master of technology/i],
  ["MBA", /\bmba\b/i],
  ["M.Sc", /\bm\.?\s?sc\b|master of science/i],
  ["BCA", /\bbca\b|bachelor of computer applications/i],
  ["B.Tech", /\bb\.?\s?tech\b|bachelor of technology/i],
  ["B.E.", /\bb\.e\b\.?|bachelor of engineering/i],
  ["B.Sc", /\bb\.?\s?sc\b|bachelor of science/i],
  ["BBA", /\bbba\b/i],
  ["B.Com", /\bb\.?\s?com\b/i],
  ["Diploma", /\bdiploma\b/i],
];

function educationInfo(profile) {
  const text = (profile.education || []).map(entryText).join(" ");
  const degree = (DEGREES.find(([, pattern]) => pattern.test(text)) ||
    [])[0] || "";

  const pursuing =
    /\b(pursuing|currently|expected|final\s+year|\d(?:st|nd|rd|th)\s+year)\b/i.test(
      text
    );

  const field = (text.match(
    /(computer science|computer applications|information technology|data science|artificial intelligence|electronics|mechanical|civil|commerce|business administration)/i
  ) || [""])[0];

  let institution = "";

  for (const entry of profile.education || []) {
    for (const part of String(entry.title).split(",")) {
      if (
        !institution &&
        /(college|university|institute|school|academy)/i.test(part)
      ) {
        institution = part.trim();
      }
    }
  }

  return { degree, pursuing, field, institution };
}

/* ------------------------------------------------------------------ */
/* Cover letter                                                       */
/* ------------------------------------------------------------------ */

function inferRole(jobDescription) {
  const first = String(jobDescription || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (first && words(first) <= 8 && !/[.!?]$/.test(first)) {
    return first.split(/\s[-–—|,]\s/)[0].trim();
  }

  return "";
}

const IRREGULAR_PAST = new Set(
  "built led wrote ran made won began taught drew spoke chose took gave found kept held set put got".split(
    " "
  )
);

function firstPersonClause(bullet) {
  const clean = stripEnd(bullet);
  const first = (clean.match(/^[A-Za-z]+/) || [""])[0].toLowerCase();

  if (!first) {
    return "";
  }

  if (first.endsWith("ed") || IRREGULAR_PAST.has(first)) {
    return `I ${lowerFirst(clean)}`;
  }

  return `my work included ${lowerFirst(clean)}`;
}

/*
 * Builder entries often store the whole description as the "title"
 * ("Built a website using React"). Only quote a title when it reads
 * like a name.
 */
function projectLead(entry) {
  const title = String(entry.title || "").trim();
  const first = (title.match(/^[A-Za-z]+/) || [""])[0].toLowerCase();
  const looksLikeSentence =
    first.endsWith("ed") || IRREGULAR_PAST.has(first) || words(title) > 5;

  return title && !looksLikeSentence
    ? `In my project "${title}",`
    : "In one of my projects,";
}

function buildCoverLetterDraft(
  profile,
  { company, role, tone = "professional", hiringManager, jobDescription } = {}
) {
  const jd = jobDescription ? analyzeJobDescription(jobDescription) : null;

  const profileSkills = new Set(profile.skills.map((s) => s.toLowerCase()));

  const wanted = jd
    ? [...jd.requiredSkills, ...jd.preferredSkills].filter(
        (name) => !jd.phraseNames.has(name)
      )
    : [];

  const matched = wanted.filter((name) =>
    profileSkills.has(name.toLowerCase())
  );

  const missing = wanted.filter(
    (name) => !profileSkills.has(name.toLowerCase())
  );

  const techSkills = profile.skills.filter(
    (name) => skillType(name) === "tech"
  );

  const topSkills = unique([...matched, ...techSkills, ...profile.skills])
    .slice(0, 5);

  const position =
    role || inferRole(jobDescription) || profile.jobTitle || "open";

  const organisation = company || "your organisation";

  const edu = educationInfo(profile);

  let eduSentence;

  if (edu.degree) {
    const field = edu.field ? ` in ${edu.field}` : "";
    const where = edu.institution ? ` at ${edu.institution}` : "";

    eduSentence = edu.pursuing
      ? `I am currently pursuing my ${edu.degree}${field}${where}.`
      : `I hold a ${edu.degree}${field}${where}.`;
  } else {
    eduSentence =
      "I am an early-career candidate with a strong interest in this field.";
  }

  const roleLabel =
    position === "open" ? "open position" : `${position} position`;

  const opening =
    tone === "enthusiastic"
      ? `I was excited to see the ${roleLabel} at ${organisation}, and I would love the chance to contribute to your team. ${eduSentence}`
      : tone === "concise"
      ? `I am applying for the ${roleLabel} at ${organisation}. ${eduSentence}`
      : `I am writing to express my interest in the ${roleLabel} at ${organisation}. ${eduSentence}`;

  const skillsSentence = topSkills.length
    ? `My skills include ${joinList(topSkills)}${
        matched.length
          ? ", which align closely with the requirements of this role"
          : ""
      }.`
    : "I bring a willingness to learn quickly and a strong work ethic.";

  // Best evidence: experience first, then the project that uses the
  // most matched skills.
  const evidence = [
    ...(profile.experience || []).map((entry) => ({
      entry,
      kind: "experience",
    })),
    ...(profile.projects || []).map((entry) => ({
      entry,
      kind: "project",
    })),
  ].filter(({ entry }) => entry.bullets && entry.bullets.length);

  evidence.sort((a, b) => {
    const score = ({ entry, kind }) =>
      [...findSkills(entryText(entry))].filter((name) =>
        matched.includes(name)
      ).length +
      (kind === "experience" ? 0.5 : 0);

    return score(b) - score(a);
  });

  const lines = [];

  if (evidence.length) {
    const { entry, kind } = evidence[0];
    const clause = firstPersonClause(entry.bullets[0]);

    if (clause) {
      const lead =
        kind === "experience" && entry.title
          ? `In my role as ${entry.title},`
          : projectLead(entry);

      lines.push(`${lead} ${clause}.`);
    }

    if (tone !== "concise" && entry.bullets[1]) {
      const second = firstPersonClause(entry.bullets[1]);

      if (second && second.startsWith("I ")) {
        lines.push(`I also ${second.slice(2)}.`);
      }
    }
  }

  if (tone !== "concise") {
    const foundation = topSkills.slice(0, 3);

    if (edu.degree && foundation.length) {
      lines.push(
        `My studies and hands-on practice have given me a solid foundation in ${joinList(foundation)}, and I enjoy turning what I learn into working solutions.`
      );
    }

    const cert = (profile.certifications || [])[0];

    if (cert && cert.title) {
      lines.push(`I have also earned the ${stripEnd(cert.title)} certification.`);
    }

    const achievement = (profile.achievements || [])[0];

    if (achievement && achievement.title) {
      const clause = firstPersonClause(achievement.title);

      if (clause.startsWith("I ")) {
        lines.push(`Outside the classroom, ${clause}.`);
      }
    }
  }

  const fit =
    tone === "enthusiastic"
      ? `I am eager to bring my energy and curiosity to ${organisation}, and to keep learning alongside experienced colleagues while contributing from day one.`
      : tone === "concise"
      ? `I would welcome the chance to contribute to ${organisation}.`
      : `I am motivated by the opportunity to apply these skills in a professional setting, and I am eager to learn from the team at ${organisation} while contributing to its goals.`;

  const contact = [profile.email, profile.phone]
    .filter(Boolean)
    .join(" or ");

  const closing = `Thank you for considering my application. I would welcome the opportunity to discuss how I can contribute to your team${
    contact ? `, and I can be reached at ${contact}` : ""
  }.`;

  const paragraphs = [
    `Dear ${hiringManager || "Hiring Manager"},`,
    opening,
    [skillsSentence, ...lines].join(" "),
    fit,
    closing,
    `Sincerely,\n${profile.name || "Your Name"}`,
  ];

  return {
    letter: paragraphs.join("\n\n"),
    role: position === "open" ? "" : position,
    matchedSkills: matched,
    missingSkills: missing,
  };
}

function buildCoverLetterPrompt(profile, context) {
  const facts = {
    name: profile.name,
    education: (profile.education || []).map(entryText).slice(0, 3),
    skills: profile.skills.slice(0, 12),
    experience: (profile.experience || [])
      .slice(0, 2)
      .map((entry) => ({ title: entry.title, bullets: entry.bullets.slice(0, 3) })),
    projects: (profile.projects || [])
      .slice(0, 3)
      .map((entry) => ({ title: entry.title, bullets: entry.bullets.slice(0, 3) })),
  };

  return `
You are an expert career coach writing a cover letter for a student or early-career candidate.

CANDIDATE FACTS (the ONLY facts you may use):
${JSON.stringify(facts, null, 2)}

TARGET: ${context.role || "the role"} at ${context.company || "the company"}
SKILLS THE JOB WANTS THAT THE CANDIDATE HAS: ${context.matched.join(", ") || "none listed"}
TONE: ${context.tone}

RULES:
- 230 to 300 words, 3 or 4 short paragraphs, starting "Dear ${context.hiringManager || "Hiring Manager"}," and ending with "Sincerely," and the candidate's name.
- Use ONLY the candidate facts above. Do NOT invent numbers, employers, achievements, technologies or claims about the company.
- Do not use placeholders like [Company] and no markdown.

Return ONLY valid JSON: { "letter": "the full letter text" }
`;
}

function validateCoverLetter(letter, profile, tone) {
  if (typeof letter !== "string") {
    return null;
  }

  const text = letter.replace(/\r/g, "").trim();
  const count = words(text);
  const minimum = tone === "concise" ? 80 : 120;

  if (count < minimum || count > 450 || !/^dear\b/i.test(text)) {
    return null;
  }

  if (/\[[^\]]+\]|\*\*|^#/m.test(text)) {
    return null;
  }

  const allowedNumbers = numbersIn(profile.rawText);
  const inventedNumber = [...numbersIn(text)].some(
    (value) => !allowedNumbers.has(value)
  );

  if (inventedNumber) {
    return null;
  }

  const allowedSkills = new Set(
    findSkills(profile.rawText).values()
  );

  return inventedTech(text, allowedSkills) ? null : text;
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                           */
/* ------------------------------------------------------------------ */

const ROLE_PROFILES = [
  {
    key: "fullstack",
    label: "Full Stack Developer",
    match: /full[\s-]?stack|mern|mean/i,
    skills: ["JavaScript", "React", "Node.js", "HTML", "CSS", "SQL", "MongoDB", "REST APIs", "Git", "Docker"],
  },
  {
    key: "frontend",
    label: "Frontend Developer",
    match: /front[\s-]?end|ui developer|react developer/i,
    skills: ["HTML", "CSS", "JavaScript", "React", "TypeScript", "Git", "Bootstrap", "REST APIs"],
  },
  {
    key: "backend",
    label: "Backend Developer",
    match: /back[\s-]?end|node\.?js developer|java developer|python developer/i,
    skills: ["Python", "Java", "Node.js", "SQL", "REST APIs", "MongoDB", "Docker", "Git", "Spring Boot", "Django"],
  },
  {
    key: "web",
    label: "Web Developer",
    match: /web developer|web designer/i,
    skills: ["HTML", "CSS", "JavaScript", "React", "PHP", "Bootstrap", "Git"],
  },
  {
    key: "dataanalyst",
    label: "Data Analyst",
    match: /data analyst|business analyst|analytics|bi developer/i,
    skills: ["SQL", "Excel", "Power BI", "Tableau", "Python", "Pandas", "Data Analysis", "Problem Solving", "Communication"],
  },
  {
    key: "datascience",
    label: "Data Scientist",
    match: /data scien|machine learning|ml engineer|ai engineer/i,
    skills: ["Python", "Machine Learning", "Pandas", "NumPy", "SQL", "Deep Learning", "Data Analysis", "Git"],
  },
  {
    key: "mobile",
    label: "Android Developer",
    match: /android|mobile app|ios developer/i,
    skills: ["Android", "Java", "Kotlin", "Firebase", "REST APIs", "Git"],
  },
  {
    key: "devops",
    label: "Cloud / DevOps Engineer",
    match: /devops|cloud|sre|site reliability/i,
    skills: ["AWS", "Docker", "Kubernetes", "Linux", "CI/CD", "Git", "Jenkins", "Azure", "Google Cloud"],
  },
  {
    key: "qa",
    label: "QA / Test Engineer",
    match: /\bqa\b|test engineer|quality assurance|tester/i,
    skills: ["Testing", "SQL", "Debugging", "Agile", "Problem Solving", "Communication"],
  },
  {
    key: "manager",
    label: "Program / Project Manager",
    match: /program manager|project manager|product manager|scrum master/i,
    skills: ["Agile", "Scrum", "Leadership", "Communication", "Time Management", "Problem Solving", "Teamwork"],
  },
  {
    key: "software",
    label: "Software Developer",
    match: /software|developer|engineer|programmer/i,
    skills: ["Python", "Java", "JavaScript", "SQL", "Git", "Data Structures", "Algorithms", "OOP", "REST APIs", "Problem Solving"],
  },
];

function roleSkillsFor(targetRole) {
  const found = ROLE_PROFILES.find((role) => role.match.test(targetRole || ""));

  return found ? [...found.skills] : [];
}

function pickRoleProfile(targetRole, profile, jobDescription) {
  const found = ROLE_PROFILES.find((role) => role.match.test(targetRole));

  let skills;

  if (found) {
    skills = [...found.skills];
  } else {
    skills = profile.skills.slice(0, 8);
  }

  if (jobDescription) {
    const jd = analyzeJobDescription(jobDescription);

    skills = unique([
      ...jd.requiredSkills.filter((name) => !jd.phraseNames.has(name)),
      ...skills,
    ]).slice(0, 12);
  }

  return {
    label: targetRole,
    skills,
  };
}

const BUZZWORDS =
  /\b(passionate|hard[\s-]?working|team player|motivated|go[\s-]?getter|self[\s-]?starter|results[\s-]?driven|dynamic|detail[\s-]?oriented)\b/gi;

function buildLinkedInPlan(
  profile,
  { targetRole, jobDescription, currentHeadline = "", currentAbout = "" }
) {
  const role = pickRoleProfile(targetRole, profile, jobDescription);
  const edu = educationInfo(profile);

  const have = new Set(profile.skills.map((skill) => skill.toLowerCase()));
  const rawLower = profile.rawText.toLowerCase();

  const presentRoleSkills = role.skills.filter(
    (name) => have.has(name.toLowerCase()) || rawLower.includes(name.toLowerCase())
  );
  const missingRoleSkills = role.skills.filter(
    (name) => !presentRoleSkills.includes(name)
  );

  const topSkills = unique([
    ...presentRoleSkills,
    ...profile.skills.filter((name) => skillType(name) === "tech"),
  ]).slice(0, 3);

  const stage = edu.degree
    ? `${edu.degree} ${edu.pursuing ? "Student" : "Graduate"}`
    : "";

  const label = role.label;

  const headlineOptions = [
    {
      style: "Skills-focused",
      text: [
        label,
        topSkills.join(" • "),
        stage,
      ]
        .filter(Boolean)
        .join(" | "),
    },
    {
      style: "Stage-focused",
      text: [
        stage,
        `Aspiring ${label}`,
        topSkills.slice(0, 2).join(" & "),
      ]
        .filter(Boolean)
        .join(" | "),
    },
    {
      style: "Open to work",
      text: [label, "Open to opportunities", topSkills.join(", ")]
        .filter(Boolean)
        .join(" | "),
    },
  ].map((option) => ({ ...option, text: option.text.slice(0, 220) }));

  // ---- About ----
  const intro = stage
    ? `I'm a ${stage.replace(/ Student$/, " student").replace(/ Graduate$/, " graduate")} with a strong interest in ${label.toLowerCase()} work.`
    : `I'm an early-career professional with a strong interest in ${label.toLowerCase()} work.`;

  const aboutParts = [intro];

  if (topSkills.length || presentRoleSkills.length) {
    aboutParts.push(
      `I work with ${joinList(unique([...presentRoleSkills, ...topSkills]).slice(0, 6))}.`
    );
  }

  const showcase = [
    ...(profile.projects || []),
    ...(profile.experience || []),
  ]
    .filter((entry) => entry.bullets && entry.bullets.length)
    .slice(0, 2);

  for (const entry of showcase) {
    const clause = firstPersonClause(entry.bullets[0]);

    if (clause) {
      aboutParts.push(`${projectLead(entry)} ${clause}.`);
    }
  }

  if (edu.degree && edu.institution) {
    aboutParts.splice(
      1,
      0,
      edu.pursuing
        ? `I'm currently pursuing my ${edu.degree} at ${edu.institution}.`
        : `I completed my ${edu.degree} at ${edu.institution}.`
    );
  }

  if ((profile.certifications || []).length) {
    aboutParts.push(
      `My certifications include ${joinList(
        profile.certifications
          .slice(0, 2)
          .map((cert) => stripEnd(cert.title))
          .filter(Boolean)
      )}.`
    );
  }

  aboutParts.push(
    `I'm looking for ${
      (profile.experience || []).length ? "new" : "entry-level and internship"
    } ${label} opportunities where I can learn, contribute and grow.`
  );

  aboutParts.push(
    `Feel free to connect with me${
      profile.email ? ` or reach out at ${profile.email}` : ""
    }.`
  );

  const aboutText = aboutParts.join("\n\n");

  // ---- Skills to list ----
  const skillSuggestions = [
    ...presentRoleSkills.map((name) => ({
      name,
      priority: "High",
      inResume: true,
      reason: `Core ${label} skill that you already have.`,
    })),
    ...profile.skills
      .filter(
        (name) =>
          !presentRoleSkills.includes(name) && skillType(name) !== "soft"
      )
      .slice(0, 4)
      .map((name) => ({
        name,
        priority: "Medium",
        inResume: true,
        reason: "Appears in your resume. Keep it in your skills list.",
      })),
    ...missingRoleSkills.slice(0, 5).map((name) => ({
      name,
      priority: "Medium",
      inResume: false,
      reason: `Common for ${label} roles. Add it only if you genuinely have it.`,
    })),
  ].slice(0, 15);

  // ---- Experience / project descriptions ----
  const entries = [
    ...(profile.projects || []).map((entry) => ({ ...entry, kind: "Project" })),
    ...(profile.experience || []).map((entry) => ({ ...entry, kind: "Experience" })),
  ].map((entry) => ({
    kind: entry.kind,
    title: entry.title,
    description: (entry.bullets || []).map((b) => `• ${b}`).join("\n"),
  }));

  // ---- Checklist ----
  const checklist = [
    {
      item: "Professional profile photo",
      done: null,
      tip: "A clear, well-lit headshot makes your profile far more likely to be opened.",
    },
    {
      item: `Banner image related to ${label}`,
      done: null,
      tip: "Use a simple banner that shows your skills or your name and role.",
    },
    {
      item: "Custom public profile URL",
      done: Boolean(profile.links.linkedin),
      tip: "Set linkedin.com/in/yourname under Edit public profile & URL.",
    },
    {
      item: "Featured section with your best project or portfolio",
      done: Boolean(profile.links.github),
      tip: "Pin your GitHub, portfolio site or a strong project write-up.",
    },
    {
      item: "10–15 relevant skills, with your top 3 pinned",
      done: profile.skills.length >= 10,
      tip: "Recruiters search by skill. Pin the three most relevant to your target role.",
    },
    {
      item: "Education with college, degree and dates",
      done: (profile.education || []).length > 0,
      tip: "Add your college, degree, field of study and years.",
    },
    {
      item: "Projects added with the technologies used",
      done: (profile.projects || []).length >= 1,
      tip: "Use the Projects section and name the tools you used in each.",
    },
    {
      item: "Certifications listed",
      done: (profile.certifications || []).length > 0,
      tip: "Add courses and certificates with the issuing organisation.",
    },
    {
      item: "1–2 recommendations",
      done: null,
      tip: "Ask a professor, mentor or internship lead to write a short recommendation.",
    },
    {
      item: '"Open to work" turned on (recruiters only)',
      done: null,
      tip: "Choose the visibility that suits you in Profile → Open to.",
    },
  ];

  // ---- Current profile feedback ----
  const feedback = [];
  const headline = String(currentHeadline).trim();
  const about = String(currentAbout).trim();
  const aboutWords = words(about);

  if (headline) {
    if (headline.length < 40) {
      feedback.push({
        severity: "high",
        message: `Your headline is only ${headline.length} characters. Use the space to add your role and top skills.`,
      });
    }

    if (headline.length > 220) {
      feedback.push({
        severity: "medium",
        message: "Your headline is longer than LinkedIn's 220-character limit.",
      });
    }

    if (!headline.toLowerCase().includes(label.split(" ")[0].toLowerCase())) {
      feedback.push({
        severity: "high",
        message: `Your headline doesn't mention "${label}". Recruiters search for the role title.`,
      });
    }
  }

  if (about) {
    if (aboutWords < 60) {
      feedback.push({
        severity: "high",
        message: `Your About section is only ${aboutWords} words. Aim for 100–250 words covering who you are, your skills and what you want next.`,
      });
    } else if (aboutWords > 320) {
      feedback.push({
        severity: "low",
        message: `Your About section is ${aboutWords} words. Shorter (100–250 words) is easier to read.`,
      });
    }

    const skillsMentioned = presentRoleSkills.filter((name) =>
      about.toLowerCase().includes(name.toLowerCase())
    ).length;

    if (skillsMentioned < 3) {
      feedback.push({
        severity: "medium",
        message: "Your About section mentions fewer than three key skills. Add the tools you use so recruiters find you.",
      });
    }

    const buzz = (about.match(BUZZWORDS) || []).length;

    if (buzz > 2) {
      feedback.push({
        severity: "medium",
        message: `Your About section uses ${buzz} generic buzzwords (such as "passionate" or "team player"). Replace them with specific projects or results.`,
      });
    }

    if (!/\b(connect|reach|contact|email|message)\b/i.test(about)) {
      feedback.push({
        severity: "low",
        message: "End with a short call to action, such as inviting people to connect or email you.",
      });
    }
  }

  // ---- Score ----
  const roleFit = role.skills.length
    ? Math.round((presentRoleSkills.length / role.skills.length) * 50)
    : 25;

  const completeness =
    (profile.summary ? 5 : 0) +
    Math.round((Math.min(8, profile.skills.length) / 8) * 8) +
    Math.round((Math.min(2, (profile.projects || []).length + (profile.experience || []).length) / 2) * 7) +
    ((profile.education || []).length ? 5 : 0) +
    (profile.links.github || profile.links.linkedin ? 5 : 0);

  let current = 0;
  const hasCurrent = Boolean(headline || about);

  if (hasCurrent) {
    current =
      (headline.toLowerCase().includes(label.split(" ")[0].toLowerCase())
        ? 6
        : 0) +
      (headline.length >= 50 && headline.length <= 220 ? 4 : 0) +
      (aboutWords >= 100 && aboutWords <= 320 ? 6 : 0) +
      (presentRoleSkills.filter((name) =>
        about.toLowerCase().includes(name.toLowerCase())
      ).length >= 3
        ? 4
        : 0);
  }

  const total = hasCurrent
    ? roleFit + completeness + current
    : Math.round(((roleFit + completeness) / 80) * 100);

  const breakdown = [
    {
      label: "Role fit",
      points: roleFit,
      max: 50,
      note: `${presentRoleSkills.length} of ${role.skills.length} typical ${label} skills are in your resume.`,
    },
    {
      label: "Profile completeness",
      points: completeness,
      max: 30,
      note: "Summary, skills, projects or experience, education and links.",
    },
    {
      label: "Your current headline and About",
      points: hasCurrent ? current : null,
      max: 20,
      note: hasCurrent
        ? "Based on the headline and About text you pasted."
        : "Paste your current headline and About section to include this.",
    },
  ];

  return {
    targetRole: label,
    score: { value: Math.max(0, Math.min(100, total)), breakdown },
    headlineOptions,
    about: {
      text: aboutText,
      wordCount: words(aboutText),
    },
    skills: skillSuggestions,
    keywordGaps: missingRoleSkills,
    entries,
    checklist,
    feedback,
    aiAvailable: false,
  };
}

function buildLinkedInPrompt(profile, plan) {
  const facts = {
    targetRole: plan.targetRole,
    stageHint: plan.headlineOptions[0].text,
    skills: profile.skills.slice(0, 12),
    education: (profile.education || []).map(entryText).slice(0, 2),
    projects: (profile.projects || [])
      .slice(0, 3)
      .map((entry) => ({ title: entry.title, bullets: entry.bullets.slice(0, 2) })),
    experience: (profile.experience || [])
      .slice(0, 2)
      .map((entry) => ({ title: entry.title, bullets: entry.bullets.slice(0, 2) })),
  };

  return `
You write LinkedIn profiles for students and early-career candidates.

FACTS (the ONLY facts you may use):
${JSON.stringify(facts, null, 2)}

TASK: write 3 different LinkedIn headlines (each at most 200 characters) and one About section of 110 to 200 words in the first person. Put the target role and top skills in the headlines. End the About with a short invitation to connect.

RULES: Use ONLY the facts above. Do NOT invent numbers, employers, awards, technologies or results. No emojis, no hashtags, no placeholders.

Return ONLY valid JSON:
{ "headlines": ["string", "string", "string"], "about": "string" }
`;
}

function applyLinkedInAi(plan, profile, llm) {
  if (!llm || typeof llm !== "object") {
    return plan;
  }

  const allowedNumbers = numbersIn(profile.rawText);
  const allowedSkills = new Set(findSkills(profile.rawText).values());

  const safe = (text) =>
    ![...numbersIn(text)].some((value) => !allowedNumbers.has(value)) &&
    !inventedTech(text, allowedSkills) &&
    !/\[[^\]]+\]/.test(text);

  let applied = 0;

  if (Array.isArray(llm.headlines)) {
    const good = llm.headlines
      .filter((item) => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length >= 20 && item.length <= 220 && safe(item))
      .slice(0, 3);

    if (good.length) {
      plan.headlineOptions = [
        ...good.map((text) => ({ style: "AI-polished", text })),
        ...plan.headlineOptions,
      ].slice(0, 4);
      applied += 1;
    }
  }

  if (typeof llm.about === "string") {
    const about = llm.about.replace(/\r/g, "").trim();
    const count = words(about);

    if (count >= 70 && count <= 320 && safe(about)) {
      plan.about = { text: about, wordCount: count };
      applied += 1;
    }
  }

  plan.aiAvailable = applied > 0;

  return plan;
}

module.exports = {
  profileFromText,
  profileFromBuilder,
  educationInfo,
  inferRole,
  buildCoverLetterDraft,
  buildCoverLetterPrompt,
  validateCoverLetter,
  buildLinkedInPlan,
  buildLinkedInPrompt,
  applyLinkedInAi,
  skillType,
  roleSkillsFor,
  entryText,
  words,
  numbersIn,
  unique,
  joinList,
};
