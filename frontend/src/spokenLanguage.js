/*
 * Spoken-language understanding for the voice interview.
 *
 * Speech recognition gives us what a person *said* ("my name is
 * ananya patel", "ananya at the rate of gmail dot com", "nine
 * eight seven..."), not what a form field wants. These helpers turn
 * natural speech into clean field values, spot commands ("skip",
 * "go back", "repeat that") and notice feelings ("I'm nervous",
 * "I'm not sure"), so the assistant can respond like a person would.
 *
 * Everything here is plain rule-based text processing: it runs
 * instantly in the browser and needs no AI model.
 */

const LEADING_FILLERS =
  /^(?:(?:um+|uh+|er+|erm|hmm+|well|so|okay|ok|yes|yeah|hi|hello|hey|alright|actually|basically|like)[\s,]+)+/i;

const INNER_FILLERS = /\b(?:um+|uh+|erm|er|hmm+)\b[,\s]*/gi;

function clean(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeFirst(text) {
  return text
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;
}

function stripTrailingPunctuation(text) {
  return text.replace(/[\s.,!?;:]+$/g, "").trim();
}

/* ------------------------------------------------------------------ */
/* Spoken digits -> numbers                                           */
/* ------------------------------------------------------------------ */

const DIGIT_WORDS = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  won: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
};

const REPEATERS = { double: 2, triple: 3 };

export function spokenToDigits(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let digits = "";
  let repeat = 1;

  for (const token of tokens) {
    if (REPEATERS[token]) {
      repeat = REPEATERS[token];
      continue;
    }

    let digit = null;

    if (/^\d+$/.test(token)) {
      digit = token;
    } else if (DIGIT_WORDS[token] !== undefined) {
      digit = DIGIT_WORDS[token];
    }

    if (digit !== null) {
      digits += digit.repeat(repeat);
    }

    repeat = 1;
  }

  return digits;
}

/* ------------------------------------------------------------------ */
/* Field normalizers                                                  */
/* ------------------------------------------------------------------ */

export function normalizeName(text) {
  let value = clean(text)
    .replace(LEADING_FILLERS, "")
    .replace(
      /^(?:my (?:full |complete )?name(?: is|'s)|i am|i'm|this is|it is|it's|you can call me|call me|they call me|myself)\s+/i,
      ""
    );

  // Keep only the name, drop anything said after it.
  value = value.split(/[,.!?]| and (?:i|my)\b| from /i)[0];

  return clean(value.replace(/[^A-Za-z\s]/g, " "));
}

const EMAIL_PROVIDERS =
  "gmail|yahoo|outlook|hotmail|icloud|rediffmail|protonmail|proton|live";

export function normalizeEmail(text) {
  let value = clean(text)
    .toLowerCase()
    .replace(LEADING_FILLERS, "")
    .replace(
      /^(?:my )?(?:e-?mail(?: address| id)?(?: is)?|it(?:'s| is))\s+/,
      ""
    );

  // "double eight" -> "88", "triple zero" -> "000"
  value = value.replace(
    /\b(double|triple)\s+(zero|one|two|three|four|five|six|seven|eight|nine|\d)\b/g,
    (match, repeat, digit) => {
      const d = /^\d$/.test(digit) ? digit : DIGIT_WORDS[digit];
      return d.repeat(REPEATERS[repeat]);
    }
  );

  value = ` ${value} `
    .replace(/\s+at the rate(?: of)?\s+/g, "@")
    .replace(/\s+at sign\s+/g, "@")
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+underscore\s+/g, "_")
    .replace(/\s+(?:dash|hyphen)\s+/g, "-")
    .replace(/\s+plus\s+/g, "+")
    .replace(/\bg\s+mail\b/g, "gmail");

  value = value.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (word) => DIGIT_WORDS[word]
  );

  value = stripTrailingPunctuation(value.replace(/\s+/g, ""));

  // "...@gmailcom" (the "dot" was not heard) -> "...@gmail.com"
  value = value.replace(
    new RegExp(`@(${EMAIL_PROVIDERS})com$`),
    "@$1.com"
  );

  // The "at" was not heard: "lakshmi182gmail.com" -> "lakshmi182@gmail.com"
  if (!value.includes("@")) {
    value = value.replace(
      new RegExp(`^(.+?)(${EMAIL_PROVIDERS})(?:\\.?com)?$`),
      "$1@$2.com"
    );
  }

  // The ending was not heard: "name@gmail" -> "name@gmail.com"
  value = value.replace(
    new RegExp(`@(${EMAIL_PROVIDERS})$`),
    "@$1.com"
  );

  return value;
}

export function normalizePhone(text) {
  let digits = spokenToDigits(text);

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits;
}

export function normalizeLocation(text) {
  const value = clean(text)
    .replace(LEADING_FILLERS, "")
    .replace(
      /^(?:i (?:currently )?(?:live|stay|reside|am (?:living|staying|based|located)) (?:in|at)|i(?:'m| am) (?:currently )?(?:from|in|based in|located in|living in|staying in)|(?:my )?(?:current )?location is|i(?:'m| am) from|it(?:'s| is)|(?:the )?city (?:is|of))\s+/i,
      ""
    );

  return stripTrailingPunctuation(value);
}

export function normalizeJobTitle(text) {
  const value = clean(text)
    .replace(LEADING_FILLERS, "")
    .replace(
      /^(?:i (?:want|would like|wish|am (?:looking|aiming|applying))(?: to (?:be|become|work as|apply as))?(?: for)?|i(?:'m| am) (?:looking for|applying for|aiming for|a|an)|i'?d like to be)\s+/i,
      ""
    )
    .replace(
      /^(?:the\s+)?(?:job\s+)?(?:title|role|position)\s+(?:is|of)\s+/i,
      ""
    )
    .replace(/^(?:a|an|the)\s+/i, "");

  return stripTrailingPunctuation(value);
}

const TECH_TERMS = {
  javascript: "JavaScript",
  "java script": "JavaScript",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  "my sql": "MySQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  "mongo db": "MongoDB",
  react: "React",
  "react js": "React",
  "node js": "Node.js",
  nodejs: "Node.js",
  node: "Node.js",
  "c++": "C++",
  "c#": "C#",
  "power bi": "Power BI",
  github: "GitHub",
  "git hub": "GitHub",
  git: "Git",
  aws: "AWS",
  ai: "AI",
  ml: "ML",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  "ui ux": "UI/UX",
  "ms excel": "MS Excel",
  python: "Python",
  java: "Java",

  // Spoken languages
  english: "English",
  hindi: "Hindi",
  kannada: "Kannada",
  tamil: "Tamil",
  telugu: "Telugu",
  malayalam: "Malayalam",
  marathi: "Marathi",
  bengali: "Bengali",
  gujarati: "Gujarati",
  punjabi: "Punjabi",
  urdu: "Urdu",
  odia: "Odia",
  tulu: "Tulu",
  konkani: "Konkani",
  sanskrit: "Sanskrit",
  french: "French",
  german: "German",
  spanish: "Spanish",

  // Common soft skills
  communication: "Communication",
  teamwork: "Teamwork",
  "team work": "Teamwork",
  leadership: "Leadership",
  creativity: "Creativity",
  adaptability: "Adaptability",
  "time management": "Time Management",
  "problem solving": "Problem Solving",
  "critical thinking": "Critical Thinking",
  "decision making": "Decision Making",
};

function titleCase(item) {
  return item
    .split(" ")
    .map((word) => capitalizeFirst(word))
    .join(" ");
}

/*
 * People say lists without commas: "html css react js". If every
 * word (or two-word phrase) is a technology we recognise, split it
 * into separate items; otherwise keep the phrase together
 * ("problem solving", "react native").
 */
function splitKnownTerms(item) {
  const tokens = item.split(" ").filter(Boolean);

  if (tokens.length < 2) {
    return [item];
  }

  const found = [];
  let index = 0;

  while (index < tokens.length) {
    const twoWords = tokens.slice(index, index + 2).join(" ");

    if (TECH_TERMS[twoWords]) {
      found.push(twoWords);
      index += 2;
    } else if (TECH_TERMS[tokens[index]]) {
      found.push(tokens[index]);
      index += 1;
    } else {
      return [item];
    }
  }

  return found;
}

export function normalizeList(text) {
  let value = clean(text)
    .toLowerCase()
    .replace(LEADING_FILLERS, "")
    .replace(
      /^(?:my (?:technical |non[- ]technical |soft )?skills (?:are|include)|(?:the )?(?:technical |non[- ]technical |soft )?skills (?:are|include)|i (?:can speak|speak|know|am (?:good|skilled|proficient|fluent|comfortable) (?:at|in|with)|have (?:knowledge|experience) (?:of|in|with)|am familiar with|use|work with)|languages (?:are|i know are)|including)\s+/i,
      ""
    )
    .replace(/\bc plus plus\b/g, "c++")
    .replace(/\bc sharp\b/g, "c#");

  const items = value
    .split(/,|;|&|\band\b|\bas well as\b|\bplus\b/)
    .map((item) => stripTrailingPunctuation(item))
    .filter(Boolean)
    .flatMap((item) => splitKnownTerms(item))
    .map((item) => TECH_TERMS[item] || titleCase(item));

  return [...new Set(items)].join(", ");
}

export function normalizeFreeText(text) {
  const value = clean(text)
    .replace(LEADING_FILLERS, "")
    .replace(INNER_FILLERS, "");

  return capitalizeFirst(clean(value));
}

/* ------------------------------------------------------------------ */
/* Yes / No                                                           */
/* ------------------------------------------------------------------ */

export function normalizeYesNo(text, { allowFresher = false } = {}) {
  const spoken = clean(text)
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ");

  if (
    allowFresher &&
    /\b(fresher|fresh graduate|no (?:work )?experience|never worked|haven't worked|have not worked|just graduated)\b/.test(
      spoken
    )
  ) {
    return "Fresher";
  }

  // Unambiguous negatives win over everything else.
  if (
    /\b(don't have|do not have|dont have|haven't|have not|i have no|none|nothing|nobody)\b/.test(
      spoken
    )
  ) {
    return "No";
  }

  const weakNo = spoken.search(
    /\b(no|nope|nah|not really|not yet|never)\b/
  );
  const yes = spoken.search(
    /\b(yes|yeah|yep|yup|sure|of course|definitely|absolutely|certainly|i do|i have|i did|correct|right|okay|ok|why not)\b/
  );

  if (yes === -1 && weakNo === -1) {
    return null;
  }

  if (yes === -1) {
    return "No";
  }

  if (weakNo === -1) {
    return "Yes";
  }

  return yes < weakNo ? "Yes" : "No";
}

/* ------------------------------------------------------------------ */
/* Commands                                                           */
/* ------------------------------------------------------------------ */

/*
 * Only short utterances count as commands, so a sentence that
 * merely contains the word "back" or "skip" is still treated as an
 * answer.
 */
export function detectIntent(text) {
  const spoken = clean(text)
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = spoken.split(" ").filter(Boolean).length;

  if (!spoken || wordCount > 8) {
    return null;
  }

  if (
    /\b(skip|pass on this|move on|next question|i don't want to answer|i do not want to answer)\b/.test(
      spoken
    )
  ) {
    return "skip";
  }

  if (
    /\b(go back|previous question|previous|take me back|last question|back one)\b/.test(
      spoken
    )
  ) {
    return "previous";
  }

  if (
    /\b(repeat|say that again|say it again|come again|pardon|what was the question|i didn't (?:get|catch|hear)|i did not (?:get|catch|hear))\b/.test(
      spoken
    )
  ) {
    return "repeat";
  }

  if (
    /\b(help|what do you mean|i don't understand|i do not understand|explain|what should i say|give me an example|example)\b/.test(
      spoken
    )
  ) {
    return "help";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Feelings and expressions                                           */
/* ------------------------------------------------------------------ */

const EXPRESSIONS = [
  {
    emotion: "nervous",
    pattern:
      /\b(nervous|anxious|scared|worried|afraid|stressed|stress|panic|panicking|overwhelmed|tense)\b/,
    reply:
      "That's completely okay. We'll take this one step at a time, and there's no rush.",
  },
  {
    emotion: "uncertain",
    pattern:
      /\b(i(?:'m| am)? not sure|not sure|i don't know|i do not know|no idea|unsure|confused|don't remember|do not remember|can't remember|cannot remember|i forgot)\b/,
    reply:
      "No worries. I can give you an example if that helps, or you can say skip and we'll come back to it.",
  },
  {
    emotion: "frustrated",
    pattern:
      /\b(frustrated|annoyed|irritated|ugh|this is (?:hard|difficult|taking too long|wrong)|you got (?:it )?wrong|that's wrong|that is wrong)\b/,
    reply:
      "Sorry about that. Let's fix it together. Tell me again and I'll listen carefully.",
  },
  {
    emotion: "down",
    pattern:
      /\b(sad|tired|exhausted|upset|disappointed|bad day|not feeling well)\b/,
    reply:
      "I'm sorry to hear that. Take your time. We can go as slowly as you like.",
  },
  {
    emotion: "happy",
    pattern:
      /\b(excited|happy|thrilled|proud|awesome|love it|so glad)\b/,
    reply: "That's wonderful to hear!",
  },
  {
    emotion: "thankful",
    pattern: /\b(thank you|thanks|appreciate it|appreciate)\b/,
    reply: "You're very welcome!",
  },
];

const FEELING_FILLER_WORDS = new Set([
  "i", "im", "i'm", "am", "is", "it", "its", "it's", "a", "an",
  "the", "so", "very", "really", "bit", "little", "quite", "but",
  "and", "just", "feeling", "feel", "kind", "of", "sort", "maybe",
  "perhaps", "well", "um", "uh", "oh", "that", "this", "to", "be",
  "honestly", "right", "now", "today", "much", "too", "bad", "good",
  "you", "very", "all", "got", "wrong",
]);

/*
 * Returns { emotion, reply, onlyFeeling } or null.
 * `onlyFeeling` is true when the person said nothing else worth
 * saving as an answer ("I'm nervous", "I'm not sure").
 */
export function detectExpression(text) {
  const spoken = clean(text)
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const { emotion, pattern, reply } of EXPRESSIONS) {
    const match = spoken.match(pattern);

    if (!match) {
      continue;
    }

    const remainder = spoken
      .replace(pattern, " ")
      .split(" ")
      .filter(
        (word) => word && !FEELING_FILLER_WORDS.has(word)
      );

    return {
      emotion,
      reply,
      onlyFeeling: remainder.length === 0,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Speaking back                                                      */
/* ------------------------------------------------------------------ */

/*
 * Text-to-speech reads symbols aloud ("check mark", "sparkles"),
 * so strip emoji and decoration before speaking.
 */
export function cleanForSpeech(text) {
  return String(text || "")
    .replace(/\uFE0F|\u200D/g, "")
    .replace(
      /[\u2190-\u21FF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}
