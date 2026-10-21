"use strict";

/*
 * ResumePilot analysis engine.
 *
 * Everything the scores depend on is CALCULATED here, in plain
 * code, so results are repeatable and explainable:
 *
 *   1. parseResume()            resume text  -> sections + bullets
 *   2. analyzeJobDescription()  job text     -> skills, duties, etc.
 *   3. analyze()                both         -> scores, gaps, advice
 *
 * A local AI model (Ollama) is only used afterwards, to write
 * natural-language rewrites and summaries. See buildLlmPrompt()
 * and applyLlmResult(), which also guard against the model
 * inventing numbers or technologies.
 */

/* ------------------------------------------------------------------ */
/* Skill dictionary                                                   */
/* ------------------------------------------------------------------ */

function term(source) {
  return new RegExp(
    `(?<![A-Za-z0-9+#])(?:${source})(?![A-Za-z0-9+#])`,
    "i"
  );
}

// [name, type, regex source]
const SKILL_DEFINITIONS = [
  ["Python", "tech", "python"],
  ["Java", "tech", "java(?!\\s*script)"],
  ["JavaScript", "tech", "javascript|java\\s+script|ecmascript"],
  ["TypeScript", "tech", "typescript"],
  ["C++", "tech", "c\\+\\+"],
  ["C#", "tech", "c#|c\\s+sharp"],
  ["C", "tech", "c\\s+(?:programming|language)"],
  ["PHP", "tech", "php"],
  ["Ruby", "tech", "ruby"],
  ["Go", "tech", "golang"],
  ["Kotlin", "tech", "kotlin"],
  ["Swift", "tech", "swift"],
  ["SQL", "tech", "sql"],
  ["HTML", "tech", "html5?"],
  ["CSS", "tech", "css3?"],
  ["React", "tech", "react(?:\\.?\\s?js)?"],
  ["Angular", "tech", "angular(?:\\.?\\s?js)?"],
  ["Vue", "tech", "vue(?:\\.?\\s?js)?"],
  ["Node.js", "tech", "node(?:\\.?\\s?js)?"],
  ["Express", "tech", "express(?:\\.?\\s?js)?"],
  ["Django", "tech", "django"],
  ["Flask", "tech", "flask"],
  ["Spring Boot", "tech", "spring(?:\\s*boot)?"],
  ["Bootstrap", "tech", "bootstrap"],
  ["Tailwind CSS", "tech", "tailwind(?:\\s*css)?"],
  ["jQuery", "tech", "jquery"],
  ["Android", "tech", "android"],
  ["REST APIs", "tech", "rest(?:ful)?\\s*apis?|restful|web\\s+services|apis?"],
  ["Backend Development", "concept", "back[\\s-]?end(?:\\s+development)?|server[\\s-]side"],
  ["Frontend Development", "concept", "front[\\s-]?end(?:\\s+development)?"],
  ["Full Stack", "concept", "full[\\s-]?stack"],
  ["MySQL", "tech", "my\\s?sql"],
  ["PostgreSQL", "tech", "postgres(?:ql)?"],
  ["MongoDB", "tech", "mongo\\s?db|mongo"],
  ["Oracle", "tech", "oracle"],
  ["SQLite", "tech", "sqlite"],
  ["Firebase", "tech", "firebase"],
  ["Redis", "tech", "redis"],
  ["Databases", "concept", "databases?|dbms|rdbms"],
  ["Power BI", "tech", "power\\s*bi"],
  ["Tableau", "tech", "tableau"],
  ["Excel", "tech", "(?:ms\\s+|microsoft\\s+)?excel"],
  ["Pandas", "tech", "pandas"],
  ["NumPy", "tech", "numpy"],
  ["Machine Learning", "concept", "machine\\s+learning|ml"],
  ["Deep Learning", "concept", "deep\\s+learning"],
  ["Data Analysis", "concept", "data\\s+analy(?:sis|tics)"],
  ["Data Structures", "concept", "data\\s+structures?"],
  ["Algorithms", "concept", "algorithms?"],
  ["AWS", "tech", "aws|amazon\\s+web\\s+services"],
  ["Azure", "tech", "azure"],
  ["Google Cloud", "tech", "gcp|google\\s+cloud"],
  ["Docker", "tech", "docker"],
  ["Kubernetes", "tech", "kubernetes|k8s"],
  ["Git", "tech", "git(?!\\s*hub)"],
  ["GitHub", "tech", "git\\s?hub"],
  ["CI/CD", "tech", "ci\\s*/\\s*cd|continuous\\s+integration"],
  ["Linux", "tech", "linux"],
  ["Jenkins", "tech", "jenkins"],
  ["SDLC", "concept", "sdlc|software\\s+development\\s+life\\s*cycle"],
  ["Agile", "concept", "agile"],
  ["Scrum", "concept", "scrum"],
  ["OOP", "concept", "oops?|object[\\s-]oriented"],
  ["Testing", "concept", "(?:unit\\s+|software\\s+)?testing|unit\\s+tests?"],
  ["Debugging", "concept", "debug(?:ging)?"],
  ["Problem Solving", "soft", "problem[\\s-]solving|problem\\s+solver"],
  ["Communication", "soft", "communication|communicat(?:e|ing)"],
  ["Teamwork", "soft", "team\\s*work|collaborat(?:e|ion|ive|ing)|team\\s+player"],
  ["Leadership", "soft", "leadership|team\\s+lead"],
  ["Time Management", "soft", "time\\s+management"],
  ["Critical Thinking", "soft", "critical\\s+thinking"],
  ["Adaptability", "soft", "adaptab(?:le|ility)"],
  ["Creativity", "soft", "creativ(?:e|ity)"],
].map(([name, type, source]) => ({
  name,
  type,
  re: term(source),
}));

/*
 * A resume that says "SQL" satisfies a job asking for "MySQL";
 * "GitHub" satisfies "Git". Kept deliberately small and explicit.
 */
const IMPLIED_BY = {
  MySQL: ["SQL", "PostgreSQL", "SQLite"],
  PostgreSQL: ["SQL"],
  Oracle: ["SQL"],
  SQLite: ["SQL"],
  Databases: [
    "SQL",
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Oracle",
    "SQLite",
    "Firebase",
    "Redis",
  ],
  Git: ["GitHub"],
};

function hasSkill(skillSet, name) {
  return (
    skillSet.has(name) ||
    (IMPLIED_BY[name] || []).some((other) => skillSet.has(other))
  );
}

function findSkills(text) {
  const found = new Set();
  const value = String(text || "");

  for (const skill of SKILL_DEFINITIONS) {
    if (skill.re.test(value)) {
      found.add(skill.name);
    }
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* Small text helpers                                                 */
/* ------------------------------------------------------------------ */

const BULLET_PATTERN = /^\s*[•●▪▸◦○■□\-*–—]\s+(.*)$/;

function splitLines(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function wordCount(text) {
  const words = String(text || "").match(/\S+/g);
  return words ? words.length : 0;
}

function stripBullet(line) {
  const match = line.match(BULLET_PATTERN);
  return match ? match[1].trim() : line.trim();
}

/* ------------------------------------------------------------------ */
/* Resume parsing                                                     */
/* ------------------------------------------------------------------ */

const SECTION_HEADINGS = {
  summary:
    /^(?:professional\s+)?(?:summary|profile|objective|about(?:\s+me)?|career\s+objective)$/i,
  education:
    /^(?:education|academic(?:\s+background|\s+qualifications?)?|educational\s+qualifications?)$/i,
  experience:
    /^(?:(?:work|professional|internship)\s+)?experience$|^internships?$|^work\s+history$|^employment(?:\s+history)?$/i,
  projects:
    /^(?:(?:key|academic|technical|personal|key\s+technical)\s+)*projects?$/i,
  skills:
    /^(?:technical\s+(?:and\s+non[-\s]?technical\s+)?skills|skills(?:\s+summary)?|core\s+competencies|key\s+skills|technical\s+skills)$/i,
  certifications:
    /^(?:certifications?|licenses?(?:\s+(?:&|and)\s+certifications?)?|courses)$/i,
  achievements:
    /^(?:achievements?|awards?(?:\s+(?:&|and)\s+achievements?)?|accomplishments|honou?rs)$/i,
  languages: /^languages?(?:\s+known)?$/i,
  interests: /^(?:interests|hobbies)$/i,
};

function detectHeading(line) {
  const cleaned = line
    .replace(/[:\-–—]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.split(" ").length > 6) {
    return null;
  }

  for (const [section, pattern] of Object.entries(
    SECTION_HEADINGS
  )) {
    if (pattern.test(cleaned)) {
      return section;
    }
  }

  return null;
}

function looksLikeTitle(line) {
  return (
    wordCount(line) <= 10 &&
    !/[.!?]$/.test(line) &&
    /^[A-Z0-9]/.test(line)
  );
}

function parseEntries(lines) {
  const entries = [];
  let current = null;

  for (const raw of lines) {
    const bullet = raw.match(BULLET_PATTERN);

    if (bullet) {
      if (!current) {
        current = { title: "", bullets: [] };
        entries.push(current);
      }

      current.bullets.push(bullet[1].trim());
      continue;
    }

    const line = raw.trim();
    const lastIndex = current ? current.bullets.length - 1 : -1;

    // A wrapped line belonging to the previous bullet.
    if (
      current &&
      lastIndex >= 0 &&
      (/^[a-z]/.test(line) ||
        (!/[.!?:]$/.test(current.bullets[lastIndex]) &&
          !looksLikeTitle(line)))
    ) {
      current.bullets[lastIndex] += ` ${line}`;
      continue;
    }

    if (looksLikeTitle(line)) {
      current = { title: line, bullets: [] };
      entries.push(current);
      continue;
    }

    // A plain sentence: treat it as a bullet.
    if (!current) {
      current = { title: "", bullets: [] };
      entries.push(current);
    }

    current.bullets.push(line);
  }

  return entries;
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d/;

function parseResume(text) {
  const lines = splitLines(text);

  const sections = {};
  const header = [];
  let currentSection = null;

  for (const line of lines) {
    const heading = detectHeading(line);

    if (heading) {
      currentSection = heading;
      sections[currentSection] = sections[currentSection] || [];
      continue;
    }

    // "Languages Known: English, Kannada" on one line.
    const inlineLanguages = line.match(
      /^languages?(?:\s+known)?\s*:\s*(.+)$/i
    );

    if (inlineLanguages) {
      sections.languages = [inlineLanguages[1]];
      continue;
    }

    if (currentSection === null) {
      header.push(line);
    } else {
      sections[currentSection].push(line);
    }
  }

  // ---- header: name + contact ----
  const headerText = header.join(" | ");
  const email = (headerText.match(EMAIL_PATTERN) || [""])[0];
  const phoneMatch = headerText.match(PHONE_PATTERN);
  const phone = phoneMatch
    ? phoneMatch[0].replace(/[^\d+]/g, "")
    : "";

  const name =
    header.find(
      (line) =>
        /^[A-Za-z][A-Za-z .'-]+$/.test(line) &&
        wordCount(line) >= 1 &&
        wordCount(line) <= 5
    ) || "";

  let location = "";

  for (const line of header) {
    for (const part of line.split(/\s*[|·•]\s*/)) {
      if (
        part &&
        !EMAIL_PATTERN.test(part) &&
        !PHONE_PATTERN.test(part) &&
        part !== name &&
        /[A-Za-z]{3}/.test(part) &&
        !/linkedin|github|http|www\./i.test(part) &&
        wordCount(part) <= 6 &&
        !location
      ) {
        location = part;
      }
    }
  }

  // ---- skills ----
  const skillsText = (sections.skills || []).join(" ");
  const nonTechMatch = skillsText.match(
    /non[-\s]?technical\s+skills\s*:\s*(.*)$/i
  );
  const techMatch = skillsText.match(
    /technical\s+skills\s*:\s*(.*?)(?=non[-\s]?technical\s+skills\s*:|$)/i
  );

  const technicalSkills = techMatch
    ? techMatch[1].trim()
    : nonTechMatch
    ? ""
    : skillsText.trim();

  const nonTechnicalSkills = nonTechMatch
    ? nonTechMatch[1].trim()
    : "";

  return {
    name,
    email,
    phone,
    location,
    summary: (sections.summary || []).join(" ").trim(),
    education: parseEntries(sections.education || []),
    experience: parseEntries(sections.experience || []),
    projects: parseEntries(sections.projects || []),
    certifications: parseEntries(sections.certifications || []),
    achievements: parseEntries(sections.achievements || []),
    technicalSkills,
    nonTechnicalSkills,
    languages: (sections.languages || []).join(", ").trim(),
    foundHeadings: Object.keys(sections),
  };
}

/* ------------------------------------------------------------------ */
/* Job description analysis                                           */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  (
    "a an the and or of to in for with on at by from as is are be been being this that these those it its " +
    "you your we our they their will can may must should would could able have has had not no but if then than " +
    "such etc any all each other more most some into out up about over under per via using use used work working " +
    "knowledge understanding basic good strong skills skill experience years year ability etc similar related " +
    "role job candidate looking required requirements preferred plus"
  ).split(" ")
);

const PREFERRED_CUE =
  /\b(preferred|nice\s+to\s+have|good\s+to\s+have|a\s+plus|bonus|desirable|advantage|optional)\b/i;

const RESPONSIBILITY_CUE =
  /\b(responsible\s+for|you\s+will|you'll|duties|design|develop|build|maintain|implement|collaborate|participate|deliver|write|test|deploy|support|assist|manage|create)\b/i;

const QUALIFICATION_CUE =
  /\b(b\.?\s?tech|b\.?\s?e\b|bachelor'?s?|b\.?\s?sc|bca|bba|b\.?\s?com|m\.?\s?tech|master'?s?|mca|m\.?\s?sc|mba|ph\.?\s?d|diploma|degree|graduate|graduation|qualification)\b/i;

const JD_HEADINGS = [
  [
    "preferred",
    /^(?:preferred|nice\s+to\s+have|good\s+to\s+have|bonus|desirable)(?:\s+(?:skills|qualifications))?$/i,
  ],
  [
    "responsibilities",
    /^(?:key\s+)?(?:responsibilities|duties|what\s+you(?:'ll|\s+will)\s+do|the\s+role|role\s+and\s+responsibilities|job\s+description)$/i,
  ],
  [
    "qualifications",
    /^(?:qualifications?|education(?:al)?(?:\s+qualifications?)?|eligibility)$/i,
  ],
  [
    "requirements",
    /^(?:requirements?|(?:key\s+|core\s+)?skills(?:\s+required)?|required\s+skills|core\s+competencies|what\s+we(?:'re|\s+are)\s+looking\s+for|must\s+have|who\s+you\s+are|technical\s+skills)$/i,
  ],
  ["about", /^(?:about(?:\s+(?:us|the\s+company|the\s+role))?|overview|company)$/i],
];

function detectJdHeading(line) {
  const cleaned = line
    .replace(/[:\-–—]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.split(" ").length > 7) {
    return null;
  }

  for (const [bucket, pattern] of JD_HEADINGS) {
    if (pattern.test(cleaned)) {
      return bucket;
    }
  }

  return null;
}

/*
 * Many job descriptions (management, operations, marketing...) list
 * skills that aren't in the technology dictionary, such as
 * "Stakeholder & Vendor Management". Short skill-like lines that the
 * dictionary doesn't cover are kept as "phrase skills" and matched by
 * their significant words.
 */
const PHRASE_NOISE =
  /^(?:arrow|scroll|click|apply|share|save|back\s+to\s+top|read\s+more|show\s+more|see\s+more|menu|home|login|sign\s+in)\b/i;

function phraseTokens(phrase) {
  return String(phrase)
    .toLowerCase()
    .match(/[a-z]{4,}/g)
    ?.filter((word) => !STOPWORDS.has(word)) || [];
}

function extractPhraseSkills(lines, takenNames) {
  const phrases = [];

  for (const line of lines) {
    if (findSkills(line).size > 0) {
      continue;
    }

    // "Domain->Product Development->Lifecycle Management": the
    // first parts are category labels; keep the last two.
    const parts = line.split(/->|→/);
    const segments = parts.length >= 3 ? parts.slice(-2) : parts;

    for (const segment of segments) {
      const text = segment
        .replace(/\(.*?\)/g, " ")
        .replace(/[.;:]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (
        text.length < 5 ||
        wordCount(text) > 6 ||
        PHRASE_NOISE.test(text) ||
        /[.!?]\s/.test(text) ||
        phraseTokens(text).length === 0 ||
        takenNames.has(text.toLowerCase())
      ) {
        continue;
      }

      takenNames.add(text.toLowerCase());
      phrases.push(text);
    }
  }

  return phrases.slice(0, 12);
}

/*
 * Returns (skillName) => boolean for a piece of text: dictionary
 * skills via findSkills + equivalences, phrase skills via word
 * prefixes (so "vendors" matches "Vendor Management").
 */
function makeSkillMatcher(text, phraseNames) {
  const dictionary = findSkills(text);
  const prefixes = new Set(
    (String(text).toLowerCase().match(/[a-z]{4,}/g) || []).map(
      (word) => word.slice(0, 6)
    )
  );

  return (name) => {
    if (phraseNames.has(name)) {
      const tokens = phraseTokens(name);
      const hits = tokens.filter((token) =>
        prefixes.has(token.slice(0, 6))
      ).length;

      return hits >= Math.max(1, Math.ceil(tokens.length * 0.6));
    }

    return hasSkill(dictionary, name);
  };
}

function analyzeJobDescription(jobDescription) {
  const rawLines = splitLines(jobDescription);

  const buckets = {
    requirements: [],
    responsibilities: [],
    qualifications: [],
    preferred: [],
    about: [],
  };

  let mode = null;

  for (const raw of rawLines) {
    const heading = detectJdHeading(raw);

    if (heading) {
      mode = heading;
      continue;
    }

    const line = stripBullet(raw);

    if (!line) {
      continue;
    }

    let bucket = mode;

    if (PREFERRED_CUE.test(line)) {
      bucket = "preferred";
    } else if (!bucket) {
      // No heading seen yet: decide from the wording.
      bucket = QUALIFICATION_CUE.test(line)
        ? "qualifications"
        : RESPONSIBILITY_CUE.test(line) &&
          !/\b(knowledge|understanding|proficien|experience\s+(?:in|with))\b/i.test(
            line
          )
        ? "responsibilities"
        : "requirements";
    }

    buckets[bucket].push(line);
  }

  // ---- skills: required vs preferred ----
  const required = new Map();
  const preferred = new Map();

  const note = (map, text) => {
    for (const name of findSkills(text)) {
      map.set(name, true);
    }
  };

  for (const line of buckets.requirements) note(required, line);
  for (const line of buckets.responsibilities) note(required, line);
  for (const line of buckets.qualifications) note(required, line);
  for (const line of buckets.preferred) note(preferred, line);

  for (const name of required.keys()) {
    preferred.delete(name);
  }

  // Skill-like lines the dictionary doesn't know about.
  const phraseNames = new Set();
  const taken = new Set(
    SKILL_DEFINITIONS.map((skill) => skill.name.toLowerCase())
  );

  const titleLine =
    rawLines.length > 1 && wordCount(rawLines[0]) <= 8
      ? stripBullet(rawLines[0])
      : "";

  for (const phrase of extractPhraseSkills(
    [...buckets.requirements, ...buckets.qualifications].filter(
      (line) =>
        !QUALIFICATION_CUE.test(line) && line !== titleLine
    ),
    taken
  )) {
    required.set(phrase, true);
    phraseNames.add(phrase);
  }

  for (const phrase of extractPhraseSkills(buckets.preferred, taken)) {
    if (!required.has(phrase)) {
      preferred.set(phrase, true);
      phraseNames.add(phrase);
    }
  }

  // ---- experience requirement ----
  const fullText = rawLines.join(" ");
  const yearsMatch = fullText.match(
    /(\d{1,2})\s*\+?\s*(?:(?:to|-|–)\s*(\d{1,2})\s*\+?\s*)?years?/i
  );

  const entryLevel =
    /\b(fresher|freshers|entry[-\s]level|no\s+experience|recent\s+graduate|0\s*(?:-|–|to)\s*1\s*years?)\b/i.test(
      fullText
    );

  const requiredYears = entryLevel
    ? 0
    : yearsMatch
    ? Number(yearsMatch[1])
    : null;

  const experienceText = yearsMatch
    ? yearsMatch[0].trim()
    : entryLevel
    ? "Entry level / fresher"
    : "";

  // ---- degree requirement ----
  const degreeMatch = fullText.match(QUALIFICATION_CUE);
  const needsMaster =
    /\b(m\.?\s?tech|master'?s?|mca|m\.?\s?sc|mba|ph\.?\s?d)\b/i.test(
      fullText
    );

  // ---- extra keywords: repeated JD terms that aren't dictionary skills ----
  const counts = new Map();

  for (const token of fullText
    .toLowerCase()
    .match(/[a-z][a-z+#.]{2,}/g) || []) {
    const word = token.replace(/\.+$/, "");

    if (!STOPWORDS.has(word)) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  const skillNamesLower = new Set(
    SKILL_DEFINITIONS.map((skill) => skill.name.toLowerCase())
  );

  const extraKeywords = [...counts.entries()]
    .filter(
      ([word, count]) =>
        count >= 2 && !skillNamesLower.has(word)
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return {
    requiredSkills: [...required.keys()],
    preferredSkills: [...preferred.keys()],
    phraseNames,
    responsibilities: buckets.responsibilities,
    qualifications: buckets.qualifications,
    requirements: buckets.requirements,
    experience: { text: experienceText, years: requiredYears },
    degree: {
      mentioned: Boolean(degreeMatch),
      level: needsMaster ? "master" : degreeMatch ? "bachelor" : null,
    },
    extraKeywords,
  };
}

/* ------------------------------------------------------------------ */
/* Resume quality checks                                              */
/* ------------------------------------------------------------------ */

const STRONG_VERBS = new Set(
  (
    "developed built designed implemented created led managed optimized optimised improved reduced increased " +
    "automated deployed integrated analyzed analysed collaborated delivered launched engineered tested maintained " +
    "migrated streamlined architected configured coordinated researched presented trained mentored established " +
    "organized organised produced achieved resolved debugged refactored published won secured completed earned " +
    "participated demonstrated utilized utilised applied constructed generated executed spearheaded"
  ).split(" ")
);

const WEAK_OPENER =
  /^(?:worked\s+(?:on|with)|responsible\s+for|helped|assisted|involved\s+in|tasked\s+with|duties\s+included|handled|did|made|was\s+part\s+of)\b/i;

const FIRST_PERSON = /\b(?:i|my|me|myself)\b/i;

const WEAK_TIPS = {
  "weak-opener":
    "Starts with a vague phrase. Open with a strong action verb (Developed, Built, Designed, Implemented).",
  "too-short":
    "Too short to show impact. Say what you built, with which tools, and why it mattered.",
  "first-person":
    "Uses I/my. Resume bullets read stronger without first-person pronouns.",
  "no-action-verb":
    "Doesn't start with an action verb. Lead with what you did.",
  "no-metric":
    "No numbers. Add a real figure if you have one (users, % improvement, time saved, team size).",
  "too-long":
    "Very long. Split it or trim it to one clear achievement.",
};

const ISSUE_WEIGHT = {
  "weak-opener": 3,
  "too-short": 2,
  "first-person": 2,
  "no-action-verb": 1,
  "too-long": 1,
  "no-metric": 1,
};

function bulletIssues(text) {
  const issues = [];
  const words = wordCount(text);
  const firstWord = (text.match(/^[A-Za-z]+/) || [""])[0].toLowerCase();

  if (WEAK_OPENER.test(text)) {
    issues.push("weak-opener");
  } else if (firstWord && !STRONG_VERBS.has(firstWord)) {
    issues.push("no-action-verb");
  }

  if (words < 6 && !/\d/.test(text)) issues.push("too-short");
  if (words > 35) issues.push("too-long");
  if (FIRST_PERSON.test(text)) issues.push("first-person");
  if (!/\d/.test(text)) issues.push("no-metric");

  return issues;
}

function collectBullets(parsed) {
  const list = [];

  for (const section of ["experience", "projects", "achievements"]) {
    parsed[section].forEach((entry, entryIndex) => {
      entry.bullets.forEach((text, bulletIndex) => {
        list.push({
          id: `${section}-${entryIndex}-${bulletIndex}`,
          section,
          entryIndex,
          bulletIndex,
          current: text,
          entryText: `${entry.title} ${entry.bullets.join(" ")}`,
        });
      });
    });
  }

  return list;
}

function currentYear() {
  return new Date().getFullYear();
}

function estimateYearsOfExperience(parsed) {
  const text = parsed.experience
    .map((entry) => `${entry.title} ${entry.bullets.join(" ")}`)
    .join(" ");

  let total = 0;

  const rangePattern =
    /((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now)/gi;

  let match;

  while ((match = rangePattern.exec(text))) {
    const start = Number(match[1]);
    const end = /\d/.test(match[2])
      ? Number(match[2])
      : currentYear();

    if (end >= start) {
      total += end - start;
    }
  }

  return total;
}

/* ------------------------------------------------------------------ */
/* Main analysis                                                      */
/* ------------------------------------------------------------------ */

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function analyze({ resumeText, pages = null, jobDescription }) {
  const parsed = parseResume(resumeText);
  const jd = analyzeJobDescription(jobDescription);

  const resumeMatch = makeSkillMatcher(resumeText, jd.phraseNames);
  const words = wordCount(resumeText);

  const projectsAndExperienceText = [
    ...parsed.projects,
    ...parsed.experience,
  ]
    .map((entry) => `${entry.title} ${entry.bullets.join(" ")}`)
    .join(" ");

  const workMatch = makeSkillMatcher(
    projectsAndExperienceText,
    jd.phraseNames
  );

  // ---------- skills ----------
  const requiredCount = jd.requiredSkills.length;
  const preferredCount = jd.preferredSkills.length;

  const matchedRequired = jd.requiredSkills.filter((name) =>
    resumeMatch(name)
  );
  const matchedPreferred = jd.preferredSkills.filter((name) =>
    resumeMatch(name)
  );

  const skillsDenominator = requiredCount + 0.5 * preferredCount;

  const skillsScore =
    skillsDenominator > 0
      ? clamp(
          ((matchedRequired.length +
            0.5 * matchedPreferred.length) /
            skillsDenominator) *
            100
        )
      : null;

  // ---------- project relevance ----------
  const hasWork =
    parsed.projects.length + parsed.experience.length > 0;

  const projectRelevance =
    requiredCount > 0
      ? clamp(
          (jd.requiredSkills.filter((name) =>
            workMatch(name)
          ).length /
            requiredCount) *
            100
        )
      : null;

  // ---------- experience ----------
  const resumeYears = estimateYearsOfExperience(parsed);
  const hasExperience = parsed.experience.length > 0;

  let experienceScore;
  let experienceNote;

  if (jd.experience.years === null || jd.experience.years === 0) {
    experienceScore = hasExperience ? 95 : hasWork ? 80 : 60;
    experienceNote = hasExperience
      ? "The role is entry level and you list experience."
      : hasWork
      ? "The role is entry level; your projects count in your favour."
      : "The role is entry level, but no projects or experience were found.";
  } else if (resumeYears > 0) {
    experienceScore = clamp(
      (resumeYears / jd.experience.years) * 100
    );
    experienceNote = `The job asks for ${jd.experience.years}+ years; about ${resumeYears} found in your dates.`;
  } else {
    experienceScore = hasExperience ? 50 : 15;
    experienceNote = `The job asks for ${jd.experience.years}+ years and no dated experience was found.`;
  }

  // ---------- education ----------
  const educationText = parsed.education
    .map((entry) => `${entry.title} ${entry.bullets.join(" ")}`)
    .join(" ");

  const hasMaster =
    /\b(m\.?\s?tech|master'?s?|mca|m\.?\s?sc|mba|ph\.?\s?d)\b/i.test(
      educationText
    );
  const hasBachelor =
    /\b(b\.?\s?tech|b\.?\s?e\b|bachelor'?s?|b\.?\s?sc|bca|bba|b\.?\s?com)\b/i.test(
      educationText
    );
  const pursuing = /\b(pursuing|currently|expected|final\s+year)\b/i.test(
    educationText
  );

  let educationScore;
  let educationNote;

  if (jd.degree.mentioned) {
    const met =
      jd.degree.level === "master"
        ? hasMaster
        : hasMaster || hasBachelor;

    educationScore = met ? (pursuing ? 85 : 100) : 35;
    educationNote = met
      ? "A matching degree was found."
      : "The job mentions a degree that wasn't found in your education section.";
  } else {
    educationScore = parsed.education.length > 0 ? 80 : 50;
    educationNote =
      "The job doesn't state a degree; scored on having an education section.";
  }

  // ---------- bullets ----------
  const bullets = collectBullets(parsed);

  const analysedBullets = bullets.map((bullet) => ({
    ...bullet,
    issues: bulletIssues(bullet.current),
  }));

  const withoutNumbers = analysedBullets.filter((bullet) =>
    bullet.issues.includes("no-metric")
  ).length;

  const candidates = analysedBullets
    .map((bullet) => ({
      ...bullet,
      weight: bullet.issues.reduce(
        (sum, issue) => sum + (ISSUE_WEIGHT[issue] || 0),
        0
      ),
    }))
    .filter((bullet) => bullet.weight >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const weakBullets = candidates.map((bullet) => ({
    id: bullet.id,
    section: bullet.section,
    entryIndex: bullet.entryIndex,
    bulletIndex: bullet.bulletIndex,
    current: bullet.current,
    issues: bullet.issues,
    tips: bullet.issues
      .filter((issue) => issue !== "no-metric")
      .map((issue) => WEAK_TIPS[issue]),
    suggested: null,
  }));

  const internal = {
    allowedSkills: Object.fromEntries(
      candidates.map((bullet) => [
        bullet.id,
        [...findSkills(bullet.entryText)],
      ])
    ),
  };

  // ---------- formatting / ATS ----------
  const issues = [];
  let penalty = 0;

  const addIssue = (severity, message, cost) => {
    issues.push({ severity, message });
    penalty += cost;
  };

  if (!parsed.email) {
    addIssue("high", "No email address was found. ATS systems and recruiters need one.", 15);
  }

  if (!parsed.phone) {
    addIssue("high", "No phone number was found.", 10);
  }

  const headings = new Set(parsed.foundHeadings);

  if (!headings.has("education")) {
    addIssue("high", 'No "Education" heading was found. ATS parsers look for standard section names.', 10);
  }

  if (!headings.has("skills")) {
    addIssue("high", 'No "Skills" heading was found. A dedicated skills section helps keyword matching.', 10);
  }

  if (!headings.has("experience") && !headings.has("projects")) {
    addIssue("medium", 'No "Experience" or "Projects" heading was found.', 10);
  }

  if (words < 100) {
    addIssue("high", `Only about ${words} words were extracted. The resume looks very short, or its text isn't readable.`, 15);
  } else if (words < 200) {
    addIssue("low", `About ${words} words is on the short side. Add detail to your projects and skills if you have more to show.`, 5);
  } else if (words > 900) {
    addIssue("medium", `About ${words} words is long. Aim for one page (roughly 400–700 words) for early-career roles.`, 10);
  }

  if (pages && pages > 2) {
    addIssue("medium", `The resume is ${pages} pages. Keep it to 1–2 pages.`, 5);
  }

  const symbolCount = (
    String(resumeText).match(
      /[\u2190-\u21FF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}]/gu
    ) || []
  ).length;

  if (symbolCount > 6) {
    addIssue("medium", "Many icons or decorative symbols were found. ATS parsers can misread them; use plain text.", 10);
  }

  if (analysedBullets.length === 0) {
    addIssue("medium", "No bullet points were found under Experience, Projects or Achievements. Bullets are easier for ATS and recruiters to scan.", 10);
  }

  if (
    analysedBullets.filter((bullet) =>
      bullet.issues.includes("first-person")
    ).length > 2
  ) {
    addIssue("low", 'Several bullets use "I" or "my". Resumes read stronger in implied first person.', 5);
  }

  if (!/linkedin|github/i.test(resumeText)) {
    addIssue("low", "No LinkedIn or GitHub link was found. Adding one is a common recruiter expectation.", 0);
  }

  const atsScore = clamp(100 - penalty);

  // ---------- overall (weighted) ----------
  const weighted = [
    [skillsScore, 40],
    [projectRelevance, 25],
    [experienceScore, 20],
    [educationScore, 15],
  ].filter(([score]) => score !== null);

  const weightTotal = weighted.reduce((sum, [, weight]) => sum + weight, 0);

  const overall = weightTotal
    ? clamp(
        weighted.reduce(
          (sum, [score, weight]) => sum + score * weight,
          0
        ) / weightTotal
      )
    : 0;

  // ---------- gaps, strengths, weaknesses ----------
  const missingRequired = jd.requiredSkills.filter(
    (name) => !resumeMatch(name)
  );
  const missingPreferred = jd.preferredSkills.filter(
    (name) => !resumeMatch(name)
  );

  const resumeLower = String(resumeText).toLowerCase();

  const keywords = jd.extraKeywords.map((word) => ({
    term: word,
    found: resumeLower.includes(word),
  }));

  const strengths = [];
  const weaknesses = [];

  if (matchedRequired.length > 0) {
    strengths.push(
      `Your resume already covers ${matchedRequired.length} of ${requiredCount} required skills: ${matchedRequired.join(", ")}.`
    );
  }

  if (parsed.projects.length > 0) {
    strengths.push(
      `You list ${parsed.projects.length} project${parsed.projects.length > 1 ? "s" : ""}, which gives evidence for your skills.`
    );
  }

  if (analysedBullets.length - withoutNumbers > 0) {
    strengths.push("Some bullets already include numbers, which recruiters notice.");
  }

  if (parsed.email && parsed.phone) {
    strengths.push("Your contact details are complete.");
  }

  if (missingRequired.length > 0) {
    weaknesses.push(
      `${missingRequired.length} required skill${missingRequired.length > 1 ? "s are" : " is"} missing: ${missingRequired.join(", ")}.`
    );
  }

  if (analysedBullets.length >= 3 && withoutNumbers / analysedBullets.length > 0.6) {
    weaknesses.push(
      `${withoutNumbers} of ${analysedBullets.length} bullets contain no numbers, so achievements aren't measurable.`
    );
  }

  if (weakBullets.length > 0) {
    weaknesses.push(
      `${weakBullets.length} bullet point${weakBullets.length > 1 ? "s are" : " is"} weak (vague opener, too short, or first-person).`
    );
  }

  if (projectRelevance !== null && projectRelevance < 50 && requiredCount > 0) {
    weaknesses.push(
      "Many required skills appear only in your skills list, not in a project or experience bullet that proves them."
    );
  }

  // ---------- priority recommendations ----------
  const recommendations = [];

  if (missingRequired.length > 0) {
    recommendations.push({
      priority: "High",
      title: `Cover the ${missingRequired.length} missing required skill${missingRequired.length > 1 ? "s" : ""}`,
      detail: `The job asks for ${missingRequired.join(", ")}. Add each one only if you genuinely have it: list it under Skills and show it in a project or experience bullet.`,
    });
  }

  if (weakBullets.length > 0) {
    recommendations.push({
      priority: weakBullets.length >= 3 ? "High" : "Medium",
      title: `Rewrite ${weakBullets.length} weak bullet point${weakBullets.length > 1 ? "s" : ""}`,
      detail: "Start each with an action verb and state what you built, with which tools, and the result. Suggested rewrites are below.",
    });
  }

  const highIssues = issues.filter((issue) => issue.severity === "high");

  if (highIssues.length > 0) {
    recommendations.push({
      priority: "High",
      title: "Fix ATS formatting problems",
      detail: highIssues.map((issue) => issue.message).join(" "),
    });
  }

  if (analysedBullets.length >= 3 && withoutNumbers / analysedBullets.length > 0.6) {
    recommendations.push({
      priority: "Medium",
      title: "Add measurable results",
      detail: "Where you can, add real numbers: users, accuracy, time saved, team size, or marks. Don't invent figures.",
    });
  }

  if (projectRelevance !== null && projectRelevance < 50 && requiredCount > 0) {
    recommendations.push({
      priority: "Medium",
      title: "Prove your skills in projects",
      detail: "Mention the required technologies inside project or experience bullets, not just in the skills list.",
    });
  }

  if (jd.experience.years && resumeYears < jd.experience.years) {
    recommendations.push({
      priority: "Medium",
      title: "Highlight relevant experience",
      detail: `The role asks for ${jd.experience.years}+ years. Emphasise internships, freelance work, and substantial projects.`,
    });
  }

  if (missingPreferred.length > 0) {
    recommendations.push({
      priority: "Low",
      title: "Nice-to-have skills",
      detail: `Mentioned as preferred: ${missingPreferred.join(", ")}.`,
    });
  }

  const mediumIssues = issues.filter((issue) => issue.severity === "medium");

  if (mediumIssues.length > 0) {
    recommendations.push({
      priority: "Low",
      title: "Polish formatting",
      detail: mediumIssues.map((issue) => issue.message).join(" "),
    });
  }

  const rank = { High: 0, Medium: 1, Low: 2 };
  recommendations.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return {
    scores: {
      overall: {
        value: overall,
        basis: "calculated",
        note: "Weighted: skills 40%, project relevance 25%, experience 20%, education 15%.",
      },
      skills: {
        value: skillsScore,
        basis: "calculated",
        note:
          skillsScore === null
            ? "No recognisable skills were found in the job description."
            : `${matchedRequired.length} of ${requiredCount} required skills found${preferredCount ? `, ${matchedPreferred.length} of ${preferredCount} preferred (counted at half weight)` : ""}.`,
      },
      projectRelevance: {
        value: projectRelevance,
        basis: "calculated",
        note:
          projectRelevance === null
            ? "No recognisable skills were found in the job description."
            : "Share of required skills that appear inside your project or experience bullets.",
      },
      experience: {
        value: experienceScore,
        basis: "estimated",
        note: experienceNote,
      },
      education: {
        value: educationScore,
        basis: "estimated",
        note: educationNote,
      },
      atsFormat: {
        value: atsScore,
        basis: "calculated",
        note: "Starts at 100 and loses points for each formatting problem found.",
      },
    },
    jobAnalysis: {
      requiredSkills: jd.requiredSkills.map((name) => ({
        name,
        found: resumeMatch(name),
      })),
      preferredSkills: jd.preferredSkills.map((name) => ({
        name,
        found: resumeMatch(name),
      })),
      responsibilities: jd.responsibilities,
      qualifications: jd.qualifications,
      requirements: jd.requirements,
      experience: jd.experience,
      keywords,
    },
    missingKeywords: [
      ...missingRequired,
      ...missingPreferred,
      ...keywords.filter((k) => !k.found).map((k) => k.term),
    ],
    formattingIssues: issues,
    weakBullets,
    recommendations,
    strengths,
    weaknesses,
    resume: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      summary: parsed.summary,
      education: parsed.education,
      experience: parsed.experience,
      projects: parsed.projects,
      certifications: parsed.certifications,
      achievements: parsed.achievements,
      technicalSkills: parsed.technicalSkills,
      nonTechnicalSkills: parsed.nonTechnicalSkills,
      languages: parsed.languages,
      wordCount: words,
      pages,
    },
    stats: {
      bulletCount: analysedBullets.length,
      bulletsWithoutNumbers: withoutNumbers,
    },
    aiAvailable: false,
    aiSummary: "",
    _internal: internal,
  };
}

/* ------------------------------------------------------------------ */
/* AI (Ollama) assist: wording only, with guardrails                  */
/* ------------------------------------------------------------------ */

function buildLlmPrompt(analysis) {
  const bullets = analysis.weakBullets
    .map(
      (bullet, index) =>
        `${index + 1}. "${bullet.current}" (problems: ${bullet.issues.join(", ")})`
    )
    .join("\n");

  const matched = analysis.jobAnalysis.requiredSkills
    .filter((skill) => skill.found)
    .map((skill) => skill.name);

  const missing = analysis.jobAnalysis.requiredSkills
    .filter((skill) => !skill.found)
    .map((skill) => skill.name);

  return `
You are a careful resume coach for students and early-career candidates.

FACTS (already calculated, do not change them):
- Required skills the resume covers: ${matched.join(", ") || "none"}
- Required skills the resume is missing: ${missing.join(", ") || "none"}
- Overall match: ${analysis.scores.overall.value}%
- Bullets without any number: ${analysis.stats.bulletsWithoutNumbers} of ${analysis.stats.bulletCount}

WEAK BULLET POINTS TO REWRITE:
${bullets || "(none)"}

RULES FOR REWRITES:
- Keep the same meaning. Do NOT invent numbers, employers, dates, results or technologies.
- Only mention a technology if it already appears in that bullet.
- Start with a strong action verb, write one clear sentence of at most 25 words, no first person.

Return ONLY valid JSON in exactly this shape:
{
  "rewrites": [ { "id": 1, "suggested": "string" } ],
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "summary": "two sentences of encouraging, specific advice"
}
"strengths" and "weaknesses" must be based only on the FACTS above.
`;
}

function numbersIn(text) {
  return new Set(String(text).match(/\d+(?:\.\d+)?/g) || []);
}

function applyLlmResult(analysis, llm) {
  if (!llm || typeof llm !== "object") {
    return analysis;
  }

  const allowedByBullet = analysis._internal.allowedSkills;
  let applied = 0;

  if (Array.isArray(llm.rewrites)) {
    for (const item of llm.rewrites) {
      const index = Number(item && item.id) - 1;
      const bullet = analysis.weakBullets[index];

      if (
        !bullet ||
        typeof item.suggested !== "string"
      ) {
        continue;
      }

      const suggested = item.suggested.replace(/\s+/g, " ").trim();

      if (
        suggested.length < 12 ||
        suggested.length > 260 ||
        suggested.toLowerCase() === bullet.current.toLowerCase()
      ) {
        continue;
      }

      // Reject invented numbers.
      const originalNumbers = numbersIn(bullet.current);
      const inventedNumber = [...numbersIn(suggested)].some(
        (value) => !originalNumbers.has(value)
      );

      if (inventedNumber) {
        continue;
      }

      // Reject technologies that weren't in this entry.
      const allowed = new Set(allowedByBullet[bullet.id] || []);
      const inventedSkill = [...findSkills(suggested)].some(
        (name) =>
          !allowed.has(name) &&
          SKILL_DEFINITIONS.find((skill) => skill.name === name)
            .type === "tech"
      );

      if (inventedSkill) {
        continue;
      }

      bullet.suggested = suggested;
      applied += 1;
    }
  }

  const cleanList = (value) =>
    Array.isArray(value)
      ? value
          .filter((entry) => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 5 && entry.length <= 220)
          .slice(0, 4)
      : [];

  const strengths = cleanList(llm.strengths);
  const weaknesses = cleanList(llm.weaknesses);

  if (strengths.length) {
    analysis.strengths = strengths;
    applied += 1;
  }

  if (weaknesses.length) {
    analysis.weaknesses = weaknesses;
    applied += 1;
  }

  if (
    typeof llm.summary === "string" &&
    llm.summary.trim().length > 10
  ) {
    analysis.aiSummary = llm.summary.trim().slice(0, 500);
    applied += 1;
  }

  // Only claim AI help if something from it was actually used.
  analysis.aiAvailable = applied > 0;

  return analysis;
}

module.exports = {
  analyze,
  SKILL_DEFINITIONS,
  parseResume,
  analyzeJobDescription,
  buildLlmPrompt,
  applyLlmResult,
  findSkills,
};
