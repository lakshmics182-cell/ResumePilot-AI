"use strict";

/*
 * Mock interview engine.
 *
 *   buildQuestions()  picks questions tailored to the role and resume
 *   analyzeAnswer()   scores one answer (the "interview feedback")
 *   summarize()       builds the final report for a whole session
 *
 * Scoring is rule-based and explainable: it looks at how well the
 * answer covers the expected points, how it is structured (STAR for
 * behavioural questions), how specific it is, and how clear it
 * sounds (length, filler words, hedging). An AI coach note can be
 * added on top, but nothing here depends on it.
 */

const { findSkills } = require("./resumeAnalysis");

/* ------------------------------------------------------------------ */
/* Question bank                                                      */
/* ------------------------------------------------------------------ */

const P = (label, keys) => ({ label, keys });

const HR_QUESTIONS = [
  {
    id: "hr-intro",
    category: "HR",
    text: "Tell me about yourself.",
    topic: "Introduction",
    points: [
      P("Who you are right now (course or current role)", "student|pursuing|graduat|currently|studying|final year|i am a|i'm a|working as"),
      P("Relevant skills, projects or experience", "project|built|developed|skill|experience|worked|internship|learn"),
      P("What you want next / why this role", "looking for|want to|goal|interested|passion|opportunit|aspire|career|role|grow"),
    ],
    tip: "Use present, past, future: who you are now, what you have done, and what you want next. Keep it under two minutes.",
  },
  {
    id: "hr-why-role",
    category: "HR",
    text: "Why are you interested in this role?",
    topic: "Motivation",
    points: [
      P("What attracts you to the work itself", "interest|enjoy|love|passion|excite|fascinat|curious"),
      P("How your skills or projects fit", "skill|project|experience|built|learn|background|course"),
      P("Where you want to grow", "grow|learn|career|future|goal|develop|long[- ]term"),
    ],
    tip: "Connect something you have actually done to the role. Avoid generic answers like 'it is a good opportunity'.",
  },
  {
    id: "hr-strengths",
    category: "HR",
    text: "What are your biggest strengths?",
    topic: "Strengths",
    points: [
      P("Two or three specific strengths", "strength|good at|skilled|strong|quick learner|problem[- ]solv|communicat|team"),
      P("Evidence or an example of each", "for example|for instance|when i|example|project|once|during"),
      P("Why they matter for this job", "role|job|team|company|helps|useful|benefit|contribute"),
    ],
    tip: "Pick strengths relevant to the job and back each with a one-line example.",
  },
  {
    id: "hr-weakness",
    category: "HR",
    text: "What is one weakness you are working on?",
    topic: "Self-awareness",
    points: [
      P("A real, honest weakness", "weakness|struggle|used to|find it hard|difficult|not good|working on|improv"),
      P("What you are doing to improve", "improv|practice|course|learn|working on|steps|habit|plan|started"),
      P("Progress so far", "now|better|progress|result|since|have started|managed"),
    ],
    tip: "Choose a genuine but non-critical weakness, then show the steps you are taking and the progress you have made.",
  },
  {
    id: "hr-five-years",
    category: "HR",
    text: "Where do you see yourself in five years?",
    topic: "Career goals",
    points: [
      P("A realistic career direction", "senior|lead|expert|role|career|grow|develop|manager|specialis"),
      P("Skills you want to build", "skill|learn|technolog|certif|expertise|knowledge"),
      P("How this job helps you get there", "this role|this company|this job|opportunit|experience here|contribute"),
    ],
    tip: "Show ambition that fits the company. Focus on skills you want to build rather than job titles.",
  },
  {
    id: "hr-why-hire",
    category: "HR",
    text: "Why should we hire you over other candidates?",
    topic: "Value proposition",
    points: [
      P("Your most relevant skills", "skill|experience|knowledge|trained|proficien|good at"),
      P("Proof: a project or result", "project|built|developed|result|achiev|example|internship|certif"),
      P("What you will contribute", "contribute|help|add value|bring|team|company|learn quickly|reliable"),
    ],
    tip: "Match your strongest evidence to what the job asks for. Be confident, not boastful.",
  },
  {
    id: "hr-salary-learning",
    category: "HR",
    text: "How do you keep your skills up to date?",
    topic: "Learning",
    points: [
      P("Specific resources or habits", "course|youtube|documentation|blog|book|practice|tutorial|udemy|coursera|read"),
      P("A recent example of learning something new", "recently|last|learned|learnt|started|completed|built"),
      P("How you apply what you learn", "apply|project|build|use|practice|implement"),
    ],
    tip: "Name concrete resources and one recent thing you learned and used.",
  },
];

const BEHAVIOURAL_QUESTIONS = [
  { id: "bh-team-conflict", category: "Behavioural", text: "Tell me about a time you had a disagreement with a teammate. How did you handle it?", topic: "Conflict" },
  { id: "bh-failure", category: "Behavioural", text: "Describe a time you failed or made a mistake. What did you learn?", topic: "Learning from failure" },
  { id: "bh-deadline", category: "Behavioural", text: "Tell me about a time you had to meet a tight deadline.", topic: "Time management" },
  { id: "bh-learn-fast", category: "Behavioural", text: "Describe a time you had to learn something new quickly.", topic: "Adaptability" },
  { id: "bh-initiative", category: "Behavioural", text: "Give an example of when you took the initiative without being asked.", topic: "Initiative" },
  { id: "bh-feedback", category: "Behavioural", text: "Tell me about a time you received critical feedback. How did you respond?", topic: "Handling feedback" },
  { id: "bh-pressure", category: "Behavioural", text: "Describe a situation where you worked under pressure.", topic: "Pressure" },
  { id: "bh-leadership", category: "Behavioural", text: "Tell me about a time you led a team or a task.", topic: "Leadership", level: "any" },
].map((question) => ({
  ...question,
  points: [
    P("The situation and your task", "when|during|while|project|team|college|internship|situation|task|responsible|assigned"),
    P("The specific actions YOU took", "i (?:built|developed|created|designed|decided|led|organi[sz]ed|worked|talked|discussed|researched|learned|wrote|tested|fixed|solved|planned|used|started|took|asked|suggested)"),
    P("The result or what you learned", "result|resulted|achieved|improved|increased|reduced|saved|learned|learnt|successfully|outcome|completed|finally|feedback"),
  ],
  tip: "Use the STAR method: Situation, Task, Action, Result. Spend most of your time on what you did and what happened.",
}));

const TECHNICAL_QUESTIONS = [
  // JavaScript
  { id: "js-equality", skills: ["JavaScript"], topic: "JavaScript", text: "What is the difference between == and === in JavaScript?", points: [P("Strict equality compares value and type", "strict|type|both"), P("Loose equality converts types (coercion)", "coerc|convert|conversion|loose"), P("A concrete example", "example|for instance|'5'|\"5\"|5 ==|1 ==")], tip: "Give a one-line example such as 5 == '5' versus 5 === '5'." },
  { id: "js-closure", skills: ["JavaScript"], topic: "JavaScript", text: "Explain closures in JavaScript.", points: [P("A function remembers variables from its outer scope", "outer|scope|remember|lexical|enclos|access"), P("Why they are useful (privacy, callbacks, counters)", "private|privacy|callback|counter|factory|encaps|state"), P("An example", "example|for instance|return")], tip: "Describe a counter function that keeps its own private count." },
  { id: "js-async", skills: ["JavaScript", "Node.js"], topic: "Asynchronous JavaScript", text: "How do promises and async/await help with asynchronous code?", points: [P("Non-blocking operations such as API calls or timers", "non[- ]?block|asynchronous|api|fetch|timer|callback|wait"), P("Promise states or then/catch", "pending|resolved|rejected|then|catch|fulfil|promise"), P("async/await reads like synchronous code", "await|readab|synchronous|cleaner|simpler")], tip: "Mention error handling with try/catch or .catch()." },
  // Python
  { id: "py-list-tuple", skills: ["Python"], topic: "Python", text: "What is the difference between a list and a tuple in Python?", points: [P("Lists are mutable", "mutable|changed|modif|edit"), P("Tuples are immutable", "immutable|cannot be changed|can't be changed|fixed|unchangeable"), P("When you would use each", "use|faster|hashable|key|fixed data|collection|when")], tip: "Mention that tuples can be dictionary keys because they are hashable." },
  { id: "py-dict", skills: ["Python"], topic: "Python", text: "What is a dictionary in Python and when would you use one?", points: [P("Stores key-value pairs", "key|value|pair"), P("Fast lookup by key", "fast|lookup|quick|hash|constant|o\\(1\\)"), P("A real use case", "example|for instance|count|store|map|lookup|frequency")], tip: "Use a real example such as counting word frequencies." },
  // Java / OOP
  { id: "oop-pillars", skills: ["Java", "OOP", "Python", "C++"], topic: "Object-oriented programming", text: "Explain the four pillars of object-oriented programming.", points: [P("Encapsulation", "encapsulat|hiding|private"), P("Inheritance", "inherit|parent|child|extend"), P("Polymorphism", "polymorph|overrid|overload|many forms"), P("Abstraction", "abstract|hide complexity|interface")], tip: "Give one-line definitions and a tiny example for at least two of them." },
  { id: "java-jvm", skills: ["Java"], topic: "Java", text: "What is the difference between JDK, JRE and JVM?", points: [P("JVM runs bytecode", "jvm|bytecode|virtual machine"), P("JRE = JVM plus libraries to run programs", "jre|runtime|libraries"), P("JDK = JRE plus development tools like the compiler", "jdk|compiler|develop|tools|javac")], tip: "Think of it as nested: JDK contains JRE, which contains JVM." },
  { id: "java-abstract-interface", skills: ["Java", "OOP"], topic: "Java", text: "What is the difference between an abstract class and an interface?", points: [P("Abstract classes can hold state and implemented methods", "state|field|variable|implemented|constructor|concrete"), P("Interfaces define a contract that classes implement", "contract|implement|interface|multiple"), P("When to choose each", "use|when|choose|multiple inheritance|common base")], tip: "Mention that a class can implement many interfaces but extend only one class." },
  // React
  { id: "react-state-props", skills: ["React"], topic: "React", text: "What is the difference between state and props in React?", points: [P("Props are passed from a parent and are read-only", "prop|parent|read[- ]only|passed"), P("State is managed inside the component and can change", "state|usestate|internal|change|mutable|setstate"), P("Changing state re-renders the component", "re-?render|update|rerender|refresh")], tip: "Give an example like a counter (state) inside a button component that receives a label (prop)." },
  { id: "react-hooks", skills: ["React"], topic: "React", text: "What are hooks? Explain useState and useEffect.", points: [P("Hooks let function components use state and lifecycle features", "hook|function component|functional"), P("useState stores a value and a setter", "usestate|state|setter|set"), P("useEffect runs side effects such as fetching data", "useeffect|side effect|fetch|lifecycle|mount|dependency|dependencies")], tip: "Mention the dependency array of useEffect." },
  { id: "react-vdom", skills: ["React"], topic: "React", text: "What is the virtual DOM and why does React use it?", points: [P("A lightweight copy of the real DOM", "copy|lightweight|in[- ]memory|virtual"), P("React compares old and new versions (diffing)", "diff|compar|reconcil"), P("Only the changes are applied, which is efficient", "efficient|only|update|performance|minimal|fast")], tip: "Keep it simple: compare, then update only what changed." },
  // HTML / CSS
  { id: "css-box", skills: ["CSS", "HTML"], topic: "CSS", text: "Explain the CSS box model.", points: [P("Content", "content"), P("Padding and border", "padding|border"), P("Margin", "margin")], tip: "Describe it from the inside out: content, padding, border, margin." },
  { id: "css-flex-grid", skills: ["CSS"], topic: "CSS", text: "When would you use Flexbox and when would you use Grid?", points: [P("Flexbox is one-dimensional (row or column)", "one[- ]dimension|row|column|single|flex"), P("Grid is two-dimensional (rows and columns)", "two[- ]dimension|grid|rows and columns|layout"), P("An example of each", "example|for instance|navbar|card|page layout|gallery")], tip: "Navigation bars suit Flexbox; full page layouts suit Grid." },
  { id: "html-semantic", skills: ["HTML"], topic: "HTML", text: "What is semantic HTML and why does it matter?", points: [P("Tags that describe meaning (header, nav, article)", "header|nav|article|section|footer|meaning|semantic"), P("Better accessibility and screen readers", "accessib|screen reader|a11y"), P("Helps SEO and readability", "seo|search|readab|maintain|clean")], tip: "Contrast a div soup with header, main and footer." },
  // SQL
  { id: "sql-joins", skills: ["SQL", "MySQL", "Databases"], topic: "SQL", text: "Explain INNER JOIN and LEFT JOIN with an example.", points: [P("INNER JOIN returns only matching rows", "inner|only match|both tables|common"), P("LEFT JOIN returns all left rows, with nulls when there is no match", "left|all rows|null|no match|unmatched"), P("An example with two tables", "example|for instance|customers|orders|students|table")], tip: "Use customers and orders as your example tables." },
  { id: "sql-keys", skills: ["SQL", "MySQL", "Databases"], topic: "SQL", text: "What are primary keys and foreign keys?", points: [P("A primary key uniquely identifies a row", "unique|identif|primary"), P("A foreign key references another table", "foreign|reference|link|relationship"), P("They keep data consistent (integrity)", "integrity|consisten|constraint|relationship|valid")], tip: "Mention that a primary key can't be null." },
  { id: "sql-where-having", skills: ["SQL", "MySQL"], topic: "SQL", text: "What is the difference between WHERE and HAVING?", points: [P("WHERE filters rows before grouping", "where|before|row"), P("HAVING filters groups after aggregation", "having|after|group|aggregat"), P("An example with GROUP BY", "example|group by|count|sum|avg")], tip: "Example: total orders per customer, keeping only customers with more than 5 orders." },
  // Node / REST
  { id: "node-event-loop", skills: ["Node.js"], topic: "Node.js", text: "What is the Node.js event loop?", points: [P("Node runs JavaScript on a single thread", "single[- ]thread|one thread|single thread"), P("Non-blocking I/O handled through callbacks or queues", "non[- ]?block|callback|queue|i/?o|asynchronous"), P("Why that makes Node good for many concurrent requests", "concurrent|scal|many requests|efficient|fast|handle")], tip: "Mention that long CPU-heavy tasks can block the loop." },
  { id: "rest-methods", skills: ["REST APIs", "Node.js", "Express"], topic: "REST APIs", text: "Explain the main HTTP methods used in REST APIs.", points: [P("GET reads data and POST creates data", "get|post|read|create|fetch"), P("PUT or PATCH updates and DELETE removes", "put|patch|update|delete|remove"), P("Status codes or a real endpoint example", "status|200|201|404|500|example|endpoint|/api")], tip: "Mention idempotency: GET, PUT and DELETE are idempotent." },
  { id: "rest-status", skills: ["REST APIs", "Node.js", "Express"], topic: "REST APIs", text: "What do the HTTP status codes 200, 404 and 500 mean?", points: [P("200 means success", "200|success|ok"), P("404 means the resource was not found", "404|not found"), P("500 means a server error", "500|server error|internal")], tip: "Add one more, such as 401 for unauthorised." },
  // CS fundamentals
  { id: "ds-array-list", skills: ["Data Structures", "Java", "Python", "C++"], topic: "Data structures", text: "What is the difference between an array and a linked list?", points: [P("Arrays use contiguous memory with fast index access", "contiguous|index|constant|o\\(1\\)|random access|fixed"), P("Linked lists use nodes with pointers", "node|pointer|reference|next"), P("Trade-offs for insertion and deletion", "insert|delet|resize|trade|slow|fast")], tip: "Compare access time and insertion time." },
  { id: "ds-stack-queue", skills: ["Data Structures"], topic: "Data structures", text: "What is the difference between a stack and a queue?", points: [P("A stack is LIFO", "lifo|last in|last-in|stack"), P("A queue is FIFO", "fifo|first in|first-in|queue"), P("Real examples (undo, print queue)", "undo|browser|print|call stack|task|example|bfs|dfs")], tip: "Give an everyday example for each." },
  { id: "algo-bigo", skills: ["Algorithms", "Data Structures"], topic: "Algorithms", text: "What is time complexity? Explain Big-O with an example.", points: [P("How runtime grows with input size", "grow|input size|scale|runtime|time taken|efficien"), P("Common classes such as O(1), O(n), O(log n)", "o\\(|constant|linear|logarithm|quadratic|log n"), P("An example such as binary search or a loop", "binary search|loop|example|for instance|nested")], tip: "Binary search is a good O(log n) example." },
  // Tools
  { id: "git-pull-fetch", skills: ["Git", "GitHub"], topic: "Git", text: "What is the difference between git fetch and git pull?", points: [P("fetch downloads changes without merging", "fetch|download|without merg|doesn't merge|does not merge"), P("pull = fetch plus merge", "pull|merge|fetch and merge|fetch \\+"), P("When you would use each", "when|safe|review|inspect|before|use")], tip: "Fetch is safer when you want to review changes first." },
  { id: "git-conflict", skills: ["Git", "GitHub"], topic: "Git", text: "How do you resolve a merge conflict?", points: [P("Open the conflicted files and find the markers", "marker|<<<<|conflict|open|file"), P("Decide which changes to keep and edit them", "keep|choose|decide|edit|combine|resolve"), P("Add, commit and verify", "add|commit|test|verify|push")], tip: "Mention testing after you resolve it." },
  // ML
  { id: "ml-supervised", skills: ["Machine Learning", "Python"], topic: "Machine learning", text: "What is the difference between supervised and unsupervised learning?", points: [P("Supervised learning uses labelled data", "label|supervis|known output|target"), P("Unsupervised learning finds patterns in unlabelled data", "unlabel|unsupervis|pattern|cluster|without label"), P("Examples of each", "classif|regress|cluster|example|spam|prediction")], tip: "Spam detection (supervised) versus customer segmentation (unsupervised)." },
  { id: "ml-overfit", skills: ["Machine Learning", "Python"], topic: "Machine learning", text: "What is overfitting and how can you reduce it?", points: [P("The model memorises training data and performs poorly on new data", "memori|training data|new data|generali|unseen"), P("Ways to reduce it (more data, regularisation, cross-validation)", "regulari|more data|cross[- ]valid|dropout|simplif|early stop"), P("How you would detect it", "validation|test|gap|accuracy|compare")], tip: "Mention comparing training and validation accuracy." },
  // Cloud, testing, process
  { id: "cloud-basics", skills: ["AWS", "Azure", "Google Cloud"], topic: "Cloud", text: "What is cloud computing, and which cloud services do you know?", points: [P("On-demand resources over the internet, pay as you go", "on[- ]demand|internet|pay|scal|elastic"), P("Services you know (EC2, S3, Lambda, etc.)", "ec2|s3|lambda|azure|gcp|compute|storage|service"), P("Why teams use the cloud", "cost|scal|availab|maintain|flexib|speed")], tip: "Only mention services you can actually explain." },
  { id: "test-unit-integration", skills: ["Testing"], topic: "Testing", text: "What is the difference between unit testing and integration testing?", points: [P("Unit tests check one small piece in isolation", "unit|isolat|single|function|small"), P("Integration tests check that parts work together", "integrat|together|modules|combined|interact"), P("Why both matter", "bug|confidence|regress|quality|catch|early")], tip: "Use a login feature as your example." },
  { id: "agile-scrum", skills: ["Agile", "Scrum"], topic: "Agile", text: "Explain Agile and Scrum in simple terms.", points: [P("Work in short iterations (sprints)", "sprint|iterat|short|increment"), P("Roles or ceremonies (product owner, stand-up, retrospective)", "product owner|scrum master|stand[- ]?up|retrospective|planning|backlog"), P("Regular feedback and adapting to change", "feedback|adapt|change|flexib|customer")], tip: "Describe how a two-week sprint works." },
  { id: "excel-analysis", skills: ["Excel", "Power BI", "Data Analysis", "Tableau"], topic: "Data analysis", text: "How would you analyse a dataset in Excel or Power BI?", points: [P("Clean the data first (duplicates, blanks)", "clean|duplicate|blank|missing|format"), P("Use pivot tables or formulas to summarise", "pivot|formula|vlookup|xlookup|sumif|summar|measure|dax"), P("Visualise and explain the insights", "chart|dashboard|visual|insight|trend|report")], tip: "Walk through your steps in order, ending with the insight you found." },
];

const GENERIC_TECHNICAL = [
  { id: "gen-debug", category: "Technical", topic: "Problem solving", text: "How do you debug a problem when you cannot find the cause?", points: [P("Reproduce the problem reliably", "reproduce|replicate|steps|consistent"), P("Isolate it (logs, breakpoints, divide and conquer)", "log|print|breakpoint|debugger|isolat|narrow|divide|step"), P("Search documentation or ask for help, then verify the fix", "documentation|search|google|stack ?overflow|ask|colleague|verify|test")], tip: "Show a calm, step-by-step process." },
  { id: "gen-hard-problem", category: "Technical", topic: "Problem solving", text: "Describe a technical problem you solved and how you approached it.", points: [P("The problem and why it was hard", "problem|challeng|difficult|bug|issue"), P("Your approach and tools", "approach|tried|used|tool|research|break|step|debug"), P("The outcome", "result|solved|fixed|worked|learned|outcome|finally")], tip: "Choose a problem from one of your own projects." },
  { id: "gen-new-tech", category: "Technical", topic: "Learning", text: "How would you learn a new technology that your team needs quickly?", points: [P("A structured way to start (docs, tutorials, small project)", "documentation|tutorial|course|small project|prototype|official"), P("Applying it hands-on", "build|practice|hands[- ]on|project|try|experiment"), P("Asking for feedback or reviewing with teammates", "ask|mentor|team|review|feedback|pair")], tip: "Mention building something small right away." },
];

/* ------------------------------------------------------------------ */
/* Seeded random + question selection                                 */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

const BANK_BY_ID = new Map(
  [
    ...HR_QUESTIONS,
    ...BEHAVIOURAL_QUESTIONS,
    ...TECHNICAL_QUESTIONS.map((q) => ({ ...q, category: "Technical" })),
    ...GENERIC_TECHNICAL,
  ].map((question) => [question.id, question])
);

function publicQuestion(question) {
  return {
    id: question.id,
    category: question.category,
    text: question.text,
    topic: question.topic || question.category,
    expectedPoints: question.points.map((point) => point.label),
    tip: question.tip || "",
  };
}

function projectQuestion(entry, index) {
  const title = String(entry.title || "").trim();
  const name =
    title && title.split(/\s+/).length <= 6 && !/^[A-Za-z]+ed\b/.test(title)
      ? `"${title}"`
      : "one of your projects";

  return {
    id: `project-${index}`,
    category: "Project",
    topic: "Your project",
    text: `Walk me through ${name}. What problem did it solve and what was your role?`,
    points: [
      P("The problem or purpose of the project", "problem|purpose|goal|aim|solve|need|why|built to"),
      P("Your own role and contribution", "i (?:built|developed|designed|created|implemented|wrote|handled|worked|was responsible)|my role|my part|responsible"),
      P("Technologies used and why", "using|used|react|java|python|sql|node|html|css|technolog|framework|language|database|because"),
      P("Result, challenge or what you learned", "result|challeng|learn|outcome|improv|faced|difficult|deploy|working"),
    ],
    tip: "Cover the problem, your role, the tools you chose and what you learned.",
  };
}

function buildQuestions({
  role = "",
  level = "fresher",
  type = "mixed",
  count = 5,
  skills = [],
  projects = [],
  seed,
}) {
  const random = mulberry32(
    seed !== undefined ? seed : Math.floor(Math.random() * 2 ** 31)
  );

  const total = Math.max(3, Math.min(10, Number(count) || 5));
  const skillSet = new Set(skills.map((name) => String(name).toLowerCase()));

  // Technical questions the candidate's skills make relevant.
  let technical = TECHNICAL_QUESTIONS.filter((question) =>
    question.skills.some((name) => skillSet.has(name.toLowerCase()))
  ).map((question) => ({ ...question, category: "Technical" }));

  // Spread across topics so the interview isn't all one subject.
  const byTopic = new Map();

  for (const question of shuffle(technical, random)) {
    if (!byTopic.has(question.topic)) {
      byTopic.set(question.topic, []);
    }

    byTopic.get(question.topic).push(question);
  }

  technical = [];

  while ([...byTopic.values()].some((list) => list.length)) {
    for (const list of byTopic.values()) {
      if (list.length) {
        technical.push(list.shift());
      }
    }
  }

  technical = [...technical, ...shuffle(GENERIC_TECHNICAL, random)];

  const projectQs = (projects || [])
    .filter((entry) => entry && (entry.title || (entry.bullets || []).length))
    .slice(0, 2)
    .map(projectQuestion);

  const behavioural = shuffle(
    BEHAVIOURAL_QUESTIONS.filter(
      (question) => level !== "fresher" || question.id !== "bh-leadership" || random() > 0.5
    ),
    random
  );

  const intro = HR_QUESTIONS[0];
  const hr = shuffle(HR_QUESTIONS.slice(1), random);

  let order;

  if (type === "hr") {
    order = [intro, ...behavioural.slice(0, 1), ...hr.slice(0, 1), ...behavioural.slice(1), ...hr.slice(1)];
  } else if (type === "technical") {
    order = [
      ...projectQs.slice(0, 1),
      ...technical.slice(0, Math.ceil(total / 2)),
      ...projectQs.slice(1),
      ...technical.slice(Math.ceil(total / 2)),
      ...behavioural.slice(0, 1),
    ];
  } else {
    order = [
      intro,
      ...technical.slice(0, 1),
      ...behavioural.slice(0, 1),
      ...projectQs.slice(0, 1),
      ...technical.slice(1, 2),
      ...hr.slice(0, 1),
      ...technical.slice(2, 3),
      ...behavioural.slice(1, 2),
      ...projectQs.slice(1),
      ...technical.slice(3),
      ...hr.slice(1),
    ];
  }

  const seen = new Set();
  const picked = [];

  for (const question of order) {
    if (question && !seen.has(question.id)) {
      seen.add(question.id);
      picked.push(question);
    }

    if (picked.length >= total) {
      break;
    }
  }

  return picked.map((question) => ({
    ...publicQuestion(question),
    // Project questions aren't in the bank, so carry their keys along
    // implicitly via the id prefix and rebuild them when scoring.
    id: question.id,
  }));
}

/* ------------------------------------------------------------------ */
/* Scoring one answer                                                 */
/* ------------------------------------------------------------------ */

const FILLERS = [
  /\bum+\b/g,
  /\buh+\b/g,
  /\berm?\b/g,
  /\bhmm+\b/g,
  /\byou know\b/g,
  /\bbasically\b/g,
  /\bactually\b/g,
  /\bkind of\b/g,
  /\bsort of\b/g,
  /\bi mean\b/g,
  /\bliterally\b/g,
];

const HEDGES = [
  /\bmaybe\b/g,
  /\bi think\b/g,
  /\bi guess\b/g,
  /\bprobably\b/g,
  /\bi hope\b/g,
  /\bnot sure\b/g,
  /\bi don't know\b/g,
  /\bi do not know\b/g,
  /\bsomehow\b/g,
];

const STAR = {
  situation:
    /\b(when|during|while|at my|in my|last year|last semester|in college|in school|for my project|in a project|once|one time|we were|there was|my team|our team|internship|at that time)\b/,
  task:
    /\b(responsible|my role|my task|my goal|needed to|had to|was asked|assigned|objective|challenge|the problem|the goal|my job)\b/,
  action:
    /\bi (?:built|developed|created|designed|implemented|decided|led|organi[sz]ed|worked|talked|discussed|researched|learned|wrote|tested|fixed|solved|divided|planned|used|started|took|asked|suggested|coordinated|presented|reached out|set up)\b/,
  result:
    /\b(result|resulted|as a result|achieved|improved|increased|reduced|saved|learned|learnt|successfully|outcome|finally|delivered|completed|received|feedback|grade|marks|won|appreciated|ended up)\b/,
};

const CONNECTIVES =
  /\b(first|second|third|then|because|therefore|so that|for example|for instance|finally|also|additionally|in addition|however|as a result|which means)\b/g;

const EXAMPLE_CUE =
  /\b(for example|for instance|such as|e\.g|like when|in my project|in one project)\b/;

function count(text, patterns) {
  let total = 0;
  const found = [];

  for (const pattern of patterns) {
    const matches = text.match(pattern);

    if (matches) {
      total += matches.length;
      found.push(matches[0]);
    }
  }

  return { total, found };
}

function wordCountOf(text) {
  const found = String(text || "").match(/\S+/g);
  return found ? found.length : 0;
}

function stemTokens(label) {
  return (String(label).toLowerCase().match(/[a-z]{4,}/g) || []).map((word) =>
    word.slice(0, 5)
  );
}

function pointCoverage(question, answerLower) {
  const bank = BANK_BY_ID.get(question.id);
  const labels = question.expectedPoints || [];

  const bankPoints = bank
    ? bank.points
    : question.id && /^project-\d+$/.test(question.id)
    ? projectQuestion({ title: "" }, 0).points
    : null;

  const results = [];

  labels.forEach((label, index) => {
    let matched;

    if (bankPoints && bankPoints[index]) {
      matched = new RegExp(bankPoints[index].keys, "i").test(answerLower);
    } else {
      const tokens = stemTokens(label);
      const prefixes = new Set(
        (answerLower.match(/[a-z]{4,}/g) || []).map((word) => word.slice(0, 5))
      );
      const hits = tokens.filter((token) => prefixes.has(token)).length;

      matched = tokens.length > 0 && hits >= Math.ceil(tokens.length / 2);
    }

    results.push({ label, matched });
  });

  return results;
}

const LENGTH_RANGE = {
  Behavioural: [70, 200],
  Project: [70, 200],
  HR: [45, 160],
  Technical: [40, 150],
};

const WEIGHTS = {
  Technical: { content: 0.45, specificity: 0.2, clarity: 0.2, structure: 0.15 },
  Behavioural: { structure: 0.3, content: 0.25, specificity: 0.25, clarity: 0.2 },
  Project: { structure: 0.25, content: 0.3, specificity: 0.25, clarity: 0.2 },
  HR: { content: 0.35, structure: 0.2, specificity: 0.15, clarity: 0.3 },
};

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function analyzeAnswer({ question, answer }) {
  const text = String(answer || "").trim();
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const category = WEIGHTS[question.category] ? question.category : "HR";
  const wordsCount = wordCountOf(text);
  const sentences = text
    ? (text.match(/[^.!?]+[.!?]*/g) || []).filter((s) => s.trim()).length
    : 0;

  const fillers = count(lower, FILLERS);
  const hedges = count(lower, HEDGES);

  const star = {
    situation: STAR.situation.test(lower),
    task: STAR.task.test(lower),
    action: STAR.action.test(lower),
    result: STAR.result.test(lower),
  };
  const starCount = Object.values(star).filter(Boolean).length;

  const coverage = pointCoverage(question, lower);
  const matchedPoints = coverage.filter((point) => point.matched);
  const missingPoints = coverage.filter((point) => !point.matched);

  const hasNumbers = /\d/.test(text);
  const skillsMentioned = findSkills(text).size;
  const iCount = (lower.match(/\bi\b/g) || []).length;
  const weCount = (lower.match(/\bwe\b|\bour\b/g) || []).length;
  const connectives = (lower.match(CONNECTIVES) || []).length;

  // ---- dimension scores ----
  const content = coverage.length
    ? clamp((matchedPoints.length / coverage.length) * 100)
    : 50;

  let structure;

  if (category === "Behavioural" || category === "Project") {
    structure = clamp((starCount / 4) * 100);
  } else {
    structure = clamp(
      Math.min(60, connectives * 20) + Math.min(40, sentences * 13)
    );
  }

  const specificity = clamp(
    (hasNumbers ? 30 : 0) +
      (EXAMPLE_CUE.test(lower) ? 25 : 0) +
      (skillsMentioned >= 2 ? 25 : skillsMentioned === 1 ? 12 : 0) +
      (iCount > 0 && iCount >= weCount ? 20 : iCount > 0 ? 10 : 0)
  );

  const [min, max] = LENGTH_RANGE[category];
  let clarity = 100;

  if (wordsCount < min) {
    clarity -= Math.round(((min - wordsCount) / min) * 55);
  } else if (wordsCount > max) {
    clarity -= Math.min(25, Math.round(((wordsCount - max) / max) * 40));
  }

  clarity -= Math.min(30, fillers.total * 6);
  clarity -= Math.min(25, hedges.total * 5);
  clarity = clamp(clarity);

  const weights = WEIGHTS[category];
  const breakdown = { content, structure, specificity, clarity };

  let overall = clamp(
    content * weights.content +
      structure * weights.structure +
      specificity * weights.specificity +
      clarity * weights.clarity
  );

  if (wordsCount < 8) {
    overall = Math.min(overall, 25);
  }

  // ---- findings ----
  const strengths = [];
  const improvements = [];

  if (content >= 70) {
    strengths.push({
      kind: "content",
      text: `You covered the key points: ${matchedPoints.map((p) => p.label.toLowerCase()).slice(0, 3).join("; ")}.`,
    });
  }

  if ((category === "Behavioural" || category === "Project") && starCount >= 3) {
    strengths.push({
      kind: "structure",
      text: "Clear structure: you described the situation, your actions and the result.",
    });
  }

  if (hasNumbers) {
    strengths.push({
      kind: "specificity",
      text: "You included specific numbers or details, which makes answers believable.",
    });
  }

  if (fillers.total === 0 && hedges.total === 0 && wordsCount >= min) {
    strengths.push({
      kind: "clarity",
      text: "Confident, clear delivery with no filler or hedging words.",
    });
  }

  if (wordsCount < 8) {
    improvements.push({
      kind: "length",
      text: "This answer is very short. Aim for at least a few sentences with an example.",
    });
  } else if (wordsCount < min) {
    improvements.push({
      kind: "length",
      text: `Your answer was about ${wordsCount} words. Aim for roughly ${min}–${max} words so you can include an example.`,
    });
  } else if (wordsCount > max) {
    improvements.push({
      kind: "length",
      text: `Your answer ran to about ${wordsCount} words. Tighten it to ${min}–${max} so the main point stands out.`,
    });
  }

  if (missingPoints.length && wordsCount >= 8) {
    improvements.push({
      kind: "content",
      text: `Try to include: ${missingPoints.slice(0, 3).map((p) => p.label.toLowerCase()).join("; ")}.`,
    });
  }

  if (category === "Behavioural" || category === "Project") {
    const parts = [];

    if (!star.situation) parts.push("the situation");
    if (!star.task) parts.push("your task or goal");
    if (!star.action) parts.push('what YOU did (use "I built…", "I decided…")');
    if (!star.result) parts.push("the result or what you learned");

    if (parts.length && wordsCount >= 8) {
      improvements.push({
        kind: "structure",
        text: `Use the STAR method. Add ${parts.slice(0, 3).join(", ")}.`,
      });
    }
  }

  if (!hasNumbers && wordsCount >= 8) {
    improvements.push({
      kind: "specificity",
      text: "Add a concrete detail such as a number, a tool name or a clear outcome.",
    });
  }

  if (weCount > iCount && wordsCount >= 8) {
    improvements.push({
      kind: "ownership",
      text: 'You said "we" more than "I". Make clear what you personally did.',
    });
  }

  if (fillers.total > 0) {
    improvements.push({
      kind: "fillers",
      text: `You used ${fillers.total} filler word${fillers.total > 1 ? "s" : ""} (${[...new Set(fillers.found)].join(", ")}). Pause briefly instead.`,
    });
  }

  if (hedges.total > 1) {
    improvements.push({
      kind: "hedging",
      text: `Phrases like "${hedges.found[0]}" make you sound unsure. State your point directly.`,
    });
  }

  // ---- model outline ----
  const bank = BANK_BY_ID.get(question.id);
  let outline;

  if (category === "Behavioural" || category === "Project") {
    outline = [
      "Situation: set the scene in one sentence (where, when, who).",
      "Task: say what you were responsible for or trying to achieve.",
      'Action: explain the steps YOU took, using "I".',
      "Result: finish with the outcome, a number if you have one, and what you learned.",
    ];
  } else if (category === "Technical") {
    outline = [
      "Start with a one-line definition or direct answer.",
      ...(question.expectedPoints || []).slice(0, 3).map((label) => `Cover: ${label}.`),
      "Finish with a short example from your own project or practice.",
    ];
  } else {
    outline = [
      ...(question.expectedPoints || []).map((label) => `Include: ${label}.`),
      "Keep it concise and finish with a clear closing sentence.",
    ];
  }

  return {
    score: overall,
    breakdown,
    stats: {
      words: wordsCount,
      sentences,
      fillers: { count: fillers.total, list: [...new Set(fillers.found)] },
      hedges: { count: hedges.total },
      star,
      hasNumbers,
    },
    points: coverage,
    strengths,
    improvements,
    outline,
    tip: question.tip || (bank && bank.tip) || "",
  };
}

/* ------------------------------------------------------------------ */
/* AI coach note (optional)                                           */
/* ------------------------------------------------------------------ */

function buildCoachPrompt({ question, answer, evaluation, role }) {
  return `
You are a supportive interview coach for a student or early-career candidate${role ? ` preparing for a ${role} role` : ""}.

QUESTION: ${question.text}
CANDIDATE'S ANSWER:
"""
${answer}
"""

AUTOMATIC FINDINGS: score ${evaluation.score}/100. ${evaluation.improvements
    .map((item) => item.text)
    .join(" ")}

TASK:
1. "coach": two encouraging, specific sentences about this answer.
2. "improved": rewrite THEIR answer to be clearer and better structured (STAR for behavioural questions) in at most 120 words, in the first person.

RULES FOR "improved": use ONLY facts, tools and events that appear in their answer. Do NOT add numbers, employers, technologies or results they did not mention. No placeholders.

Return ONLY valid JSON: { "coach": "string", "improved": "string" }
`;
}

function numbersIn(text) {
  return new Set(String(text).match(/\d+(?:\.\d+)?/g) || []);
}

function validateCoach(llm, answer) {
  if (!llm || typeof llm !== "object") {
    return null;
  }

  const result = {};

  if (typeof llm.coach === "string") {
    const coach = llm.coach.replace(/\s+/g, " ").trim();

    if (coach.length >= 15 && coach.length <= 500) {
      result.coach = coach;
    }
  }

  if (typeof llm.improved === "string") {
    const improved = llm.improved.replace(/\s+/g, " ").trim();
    const count = wordCountOf(improved);
    const allowedNumbers = numbersIn(answer);
    const allowedSkills = findSkills(answer);

    const inventedNumber = [...numbersIn(improved)].some(
      (value) => !allowedNumbers.has(value)
    );

    const inventedSkill = [...findSkills(improved)].some(
      (name) =>
        !allowedSkills.has(name) &&
        !/^(Express|Excel|Swift|React|Go|Oracle|Ruby|Flask|Testing|Debugging|Agile)$/.test(name) &&
        ["MySQL", "MongoDB", "Docker", "Kubernetes", "AWS", "Python", "Java", "JavaScript", "TypeScript", "SQL", "Node.js", "Django", "Angular", "Vue", "PHP", "Kotlin", "Android", "Firebase", "Redis", "Linux", "PostgreSQL", "Azure", "Jenkins"].includes(name)
    );

    if (
      count >= 20 &&
      count <= 180 &&
      !inventedNumber &&
      !inventedSkill &&
      !/\[[^\]]+\]/.test(improved)
    ) {
      result.improved = improved;
    }
  }

  return result.coach || result.improved ? result : null;
}

/* ------------------------------------------------------------------ */
/* Final report                                                       */
/* ------------------------------------------------------------------ */

const ACTION_ADVICE = {
  content:
    "Before each answer, think of the 2–3 key points a good answer must contain, and say them clearly.",
  structure:
    "Practise the STAR method (Situation, Task, Action, Result) for every behavioural question.",
  specificity:
    "Prepare 3 stories from your projects with real numbers, tools and outcomes you can reuse.",
  length:
    "Aim for answers of about 60–150 words (roughly 30–90 seconds when spoken).",
  fillers:
    "Record yourself and replace filler words with a short pause. Silence sounds confident.",
  hedging:
    'Replace "I think maybe" with direct statements: "I used…", "The reason was…".',
  ownership:
    'Use "I" when describing your own contribution, even in team projects.',
};

function verdictFor(score) {
  if (score >= 75) return { label: "Interview-ready", tone: "good" };
  if (score >= 55) return { label: "Getting there", tone: "ok" };
  return { label: "Needs more practice", tone: "low" };
}

function summarize(items) {
  const answered = items.filter(
    (item) => item.evaluation && wordCountOf(item.answer) > 0
  );

  if (!answered.length) {
    return {
      overall: 0,
      verdict: verdictFor(0),
      categories: { content: 0, structure: 0, specificity: 0, clarity: 0 },
      strengths: [],
      improvements: [],
      actionPlan: ["Answer at least one question to get feedback."],
      practiceAgain: [],
      stats: { answered: 0, skipped: items.length, totalWords: 0, averageWords: 0, fillerWords: 0, hedgingPhrases: 0 },
    };
  }

  const average = (picker) =>
    Math.round(
      answered.reduce((sum, item) => sum + picker(item.evaluation), 0) /
        answered.length
    );

  const overall = average((evaluation) => evaluation.score);

  const categories = {
    content: average((e) => e.breakdown.content),
    structure: average((e) => e.breakdown.structure),
    specificity: average((e) => e.breakdown.specificity),
    clarity: average((e) => e.breakdown.clarity),
  };

  const tally = (field) => {
    const counts = new Map();

    for (const item of answered) {
      for (const finding of item.evaluation[field]) {
        const entry = counts.get(finding.kind) || { count: 0, text: finding.text };
        entry.count += 1;
        counts.set(finding.kind, entry);
      }
    }

    return [...counts.entries()]
      .map(([kind, value]) => ({ kind, ...value }))
      .sort((a, b) => b.count - a.count);
  };

  const strengthTally = tally("strengths");
  const improvementTally = tally("improvements");

  const totalWords = answered.reduce(
    (sum, item) => sum + item.evaluation.stats.words,
    0
  );

  const practiceAgain = [...answered]
    .sort((a, b) => a.evaluation.score - b.evaluation.score)
    .filter((item) => item.evaluation.score < 65)
    .slice(0, 3)
    .map((item) => ({
      question: item.question.text,
      topic: item.question.topic || item.question.category,
      score: item.evaluation.score,
    }));

  const actionPlan = improvementTally
    .slice(0, 3)
    .map((entry) => ACTION_ADVICE[entry.kind])
    .filter(Boolean);

  if (!actionPlan.length) {
    actionPlan.push("Keep practising with different questions to stay sharp.");
  }

  return {
    overall,
    verdict: verdictFor(overall),
    categories,
    strengths: strengthTally.slice(0, 3).map((entry) => entry.text),
    improvements: improvementTally.slice(0, 4).map((entry) => entry.text),
    actionPlan,
    practiceAgain,
    stats: {
      answered: answered.length,
      skipped: items.length - answered.length,
      totalWords,
      averageWords: Math.round(totalWords / answered.length),
      fillerWords: answered.reduce((sum, item) => sum + item.evaluation.stats.fillers.count, 0),
      hedgingPhrases: answered.reduce((sum, item) => sum + item.evaluation.stats.hedges.count, 0),
    },
  };
}

module.exports = {
  buildQuestions,
  analyzeAnswer,
  buildCoachPrompt,
  validateCoach,
  summarize,
  BANK_BY_ID,
  TECHNICAL_QUESTIONS,
  HR_QUESTIONS,
  BEHAVIOURAL_QUESTIONS,
};
