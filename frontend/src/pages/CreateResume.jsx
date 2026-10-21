import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
  cleanForSpeech,
  detectExpression,
  detectIntent,
  normalizeEmail,
  normalizeFreeText,
  normalizeJobTitle,
  normalizeList,
  normalizeLocation,
  normalizeName,
  normalizePhone,
  normalizeYesNo,
} from "../spokenLanguage";

const multipleEntryKeys = [
  "education",
  "projects",
  "experience",
  "certifications",
  "achievements",
];

const sectionNames = {
  education: "education qualification",
  projects: "project",
  experience: "internship or work experience",
  certifications: "certification",
  achievements: "achievement",
};

const questions = [
  {
    key: "name",
    question: "What is your full name?",
    placeholder: "Enter your full name",
    suggestions: [
      "Lakshmi C S",
      "Rahul Sharma",
      "Ananya Patel",
    ],
  },

  {
    key: "email",
    question: "What is your email address?",
    placeholder: "example@gmail.com",
    suggestions: [
      "priya@gmail.com",
      "rahul@gmail.com",
      "name@example.com",
    ],
  },

  {
    key: "phone",
    question: "What is your phone number?",
    placeholder: "Enter 10-digit mobile number",
    suggestions: [
      "9876543210",
      "9123456789",
    ],
  },

  {
    key: "jobTitle",
    question: "What job title are you targeting?",
    placeholder: "Example: Software Developer",
    suggestions: [
      "Software Developer",
      "Data Analyst",
      "Web Developer",
      "Full Stack Developer",
    ],
  },

  {
    key: "location",
    question: "Where are you currently located?",
    placeholder: "Example: Bengaluru, Karnataka",
    suggestions: [
      "Bengaluru, Karnataka",
      "Mysuru, Karnataka",
      "Mumbai, Maharashtra",
      "Chennai, Tamil Nadu",
      "Hyderabad, Telangana",
      "Other",
    ],
  },

  {
    key: "about",
    question: "Tell me briefly about yourself.",
    placeholder:
      "Example: I am a BCA student interested in software development.",
    suggestions: [
      "I am a BCA student interested in software development.",
      "I am a fresher looking for an IT career.",
      "I am a BCA student interested in technology.",
    ],
  },

  {
    key: "strengths",
    question: "What are your strengths?",
    placeholder:
      "Example: Communication, teamwork, problem solving",
    suggestions: [
      "Communication and teamwork",
      "Problem solving and quick learning",
      "Leadership and communication",
      "Adaptability and teamwork",
    ],
  },

  {
    key: "careerGoal",
    question: "What is your career goal?",
    placeholder:
      "Example: To become a skilled software developer.",
    suggestions: [
      "To become a skilled software developer.",
      "To build a career in data analytics.",
      "To grow as a full-stack developer.",
      "To build a career in cloud computing.",
    ],
  },

  {
    key: "technicalSkills",
    question: "What technical skills do you have?",
    placeholder:
      "Example: Python, Java, SQL, React",
    multiSelect: true,
    suggestions: [
      "Python",
      "Java",
      "SQL",
      "JavaScript",
      "React",
      "HTML",
      "CSS",
      "C++",
      "Power BI",
      "Node.js",
    ],
  },

  {
    key: "nonTechnicalSkills",
    question: "What non-technical skills do you have?",
    placeholder:
      "Example: Communication, teamwork, problem solving",
    multiSelect: true,
    suggestions: [
      "Communication",
      "Teamwork",
      "Leadership",
      "Problem Solving",
      "Time Management",
      "Adaptability",
      "Critical Thinking",
      "Creativity",
    ],
  },

  {
    key: "education",
    question: "Would you like to add an education qualification?",
    placeholder: "Choose Yes or No",
    suggestions: [
      "Yes",
      "No",
    ],
  },

  {
    key: "projects",
    question: "Do you have any projects to add to your resume?",
    placeholder:
      "Choose Yes or No",
    suggestions: [
      "Yes",
      "No",
    ],
  },

  {
    key: "experience",
    question:
      "Do you have any internship or work experience?",
    placeholder:
      "Choose Yes, No or Fresher",
    suggestions: [
      "Yes",
      "No",
      "Fresher",
    ],
  },

  {
    key: "certifications",
    question: "Do you have any certifications?",
    placeholder:
      "Choose Yes or No",
    suggestions: [
      "Yes",
      "No",
    ],
  },

  {
    key: "achievements",
    question:
      "Do you have any achievements or awards?",
    placeholder:
      "Choose Yes or No",
    suggestions: [
      "Yes",
      "No",
    ],
  },

  {
    key: "languages",
    question: "Which languages do you know?",
    placeholder:
      "Example: English, Kannada, Hindi",
    multiSelect: true,
    suggestions: [
      "English",
      "Hindi",
      "Kannada",
      "Tamil",
      "Telugu",
      "Malayalam",
      "Marathi",
      "Bengali",
    ],
  },
];

const descriptiveKeys = [
  "about",
  "strengths",
  "careerGoal",
  "skills",
];

function formatName(value) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function validateAnswer(key, value) {
  const answer = value.trim();

  if (!answer) {
    return "Please enter an answer.";
  }

  if (key === "name") {
    if (
      !/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(answer)
    ) {
      return "Please enter a valid name using letters and spaces only.";
    }

    if (answer.length < 2) {
      return "Please enter your complete name.";
    }
  }

  if (key === "email") {
    const emailPattern =
      /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!emailPattern.test(answer)) {
      return "Please enter a valid email address, such as name@gmail.com.";
    }
  }

  if (key === "phone") {
    const phone = answer.replace(/\s+/g, "");

    if (!/^\d+$/.test(phone)) {
      return "Phone number should contain digits only.";
    }

    if (phone.length !== 10) {
      return "Please enter exactly 10 digits.";
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return "Please enter a valid Indian mobile number.";
    }
  }

  if (key === "jobTitle" && answer.length < 3) {
    return "Please enter a valid job title.";
  }

  if (key === "about" && answer.length < 10) {
    return "Please tell me a little more about yourself.";
  }

  if (key === "strengths" && answer.length < 3) {
    return "Please enter at least one strength.";
  }

  if (key === "careerGoal" && answer.length < 5) {
    return "Please enter your career goal.";
  }

  if (key === "degree" && answer.length < 2) {
    return "Please enter your degree or course.";
  }

  if (key === "college" && answer.length < 3) {
    return "Please enter your college or university name.";
  }

  if (key === "graduationYear") {
    if (!/^\d{4}$/.test(answer)) {
      return "Please enter a valid 4-digit year.";
    }

    const year = Number(answer);

    if (year < 1950 || year > 2100) {
      return "Please enter a valid graduation year.";
    }
  }

  if (key === "skills" && answer.length < 2) {
    return "Please enter at least one skill.";
  }

  if (key === "languages" && answer.length < 2) {
    return "Please enter at least one language.";
  }

  return "";
}

function formatAnswer(key, value) {
  if (key === "name") {
    return formatName(value);
  }

  if (key === "email") {
    return value.trim().toLowerCase();
  }

  if (key === "phone") {
    return value.replace(/\s+/g, "");
  }

  return value.trim();
}

async function enhanceWithAI(
  section,
  userText,
  jobTitle
) {
  try {
    const response = await fetch(
      "http://localhost:5000/api/enhance-resume",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section,
          userText,
          jobTitle,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "AI enhancement failed."
      );
    }

    if (!data.enhancedText) {
      throw new Error(
        "AI returned empty content."
      );
    }

    return data.enhancedText.trim();

  } catch (error) {
    console.error(
      "Local AI enhancement error:",
      error
    );

    // Important:
    // Do NOT make the resume blank
    // if Ollama fails.
    return userText;
  }
}

const DRAFT_STORAGE_KEY = "resumepilot_draft";

/*
 * Understand a spoken reply to "Is this information correct?"
 * Returns "yes", "no", or null when it isn't clear.
 */
function interpretConfirmation(text) {
  const spoken = String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!spoken) {
    return null;
  }

  const noPattern =
    /\b(no|nope|nah|edit|change|wrong|incorrect|redo|not correct|not right|go back)\b/;
  const yesPattern =
    /\b(yes|yeah|yep|yup|correct|right|confirm|confirmed|continue|proceed|okay|ok|sure|sounds good|looks good|go ahead|next)\b/;

  if (noPattern.test(spoken)) {
    return "no";
  }

  if (yesPattern.test(spoken)) {
    return "yes";
  }

  return null;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(
      DRAFT_STORAGE_KEY
    );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      "Failed to load saved draft:",
      error
    );
    return null;
  }
}

function CreateResume({
  preferVoice = false,
  resumeId = null,
  onBackToDashboard,
} = {}) {
  const savedDraft = loadDraft();

  const [currentQuestion, setCurrentQuestion] =
    useState(
      savedDraft?.currentQuestion ?? 0
    );

  const [input, setInput] = useState("");

  const [error, setError] = useState("");

  const [isEnhancing, setIsEnhancing] =
    useState(false);

  const [resumeData, setResumeData] = useState(
    savedDraft?.resumeData || {
  name: "",
  email: "",
  phone: "",
  jobTitle: "",
  location: "",

  about: "",
  strengths: "",
  careerGoal: "",
  professionalSummary: "",

  education: [],

  technicalSkills: "",
  nonTechnicalSkills: "",

  projects: [],
  experience: [],
  certifications: [],
  achievements: [],

  languages: [],
}
  );

  const [messages, setMessages] =
    useState(
      savedDraft?.messages || [
      {
        sender: "ai",
        text:
          "Hello! 👋 I'll help you create your professional ATS-friendly resume step by step.",
      },
      {
        sender: "ai",
        text: questions[0].question,
      },
    ]
    );

  const [pendingAnswer, setPendingAnswer] =
    useState(null);

  const [phase, setPhase] =
    useState("question");

  const [activeMultipleKey, setActiveMultipleKey] =
    useState(null);

  const [selectedSkills, setSelectedSkills] =
    useState([]);

  const [selectedTemplate, setSelectedTemplate] =
    useState(
      savedDraft?.selectedTemplate || "classic"
    );

  const [isExportingPDF, setIsExportingPDF] =
    useState(false);

  const [isEditingResume, setIsEditingResume] =
    useState(false);

  const updateSimpleField = (key, value) => {
    setResumeData((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateEntryText = (
    key,
    index,
    newText
  ) => {
    setResumeData((previous) => {
      const updated = [
        ...(previous[key] || []),
      ];

      updated[index] = {
        original: newText,
        enhanced: newText,
      };

      return {
        ...previous,
        [key]: updated,
      };
    });
  };

  const removeEntry = (key, index) => {
    setResumeData((previous) => ({
      ...previous,
      [key]: (previous[key] || []).filter(
        (_, i) => i !== index
      ),
    }));
  };

  const moveEntry = (
    key,
    index,
    direction
  ) => {
    setResumeData((previous) => {
      const list = [
        ...(previous[key] || []),
      ];

      const targetIndex =
        index + direction;

      if (
        targetIndex < 0 ||
        targetIndex >= list.length
      ) {
        return previous;
      }

      [
        list[index],
        list[targetIndex],
      ] = [
        list[targetIndex],
        list[index],
      ];

      return {
        ...previous,
        [key]: list,
      };
    });
  };

  const addBlankEntry = (key) => {
    setResumeData((previous) => ({
      ...previous,
      [key]: [
        ...(previous[key] || []),
        {
          original:
            "New entry — click to edit",
          enhanced:
            "New entry — click to edit",
        },
      ],
    }));
  };

  const messagesEndRef = useRef(null);
  const resumePaperRef = useRef(null);
  const recognitionRef = useRef(null);
  const confirmControlsRef = useRef({
    phase: "question",
    confirm: null,
    edit: null,
    handleUtterance: null,
  });

  const confirmPrompt = preferVoice
    ? "Please confirm your answer. Say yes to continue, or no to edit."
    : "Please confirm your answer below.";

  // Autosave progress so a refresh or closed tab
  // doesn't lose the interview.
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          currentQuestion,
          resumeData,
          messages,
          selectedTemplate,
          savedAt: Date.now(),
        })
      );
    } catch (error) {
      console.error(
        "Failed to autosave draft:",
        error
      );
    }
  }, [
    currentQuestion,
    resumeData,
    messages,
    selectedTemplate,
  ]);

  const startNewResume = () => {
    const confirmed = window.confirm(
      "Start a new resume? This will clear your current progress."
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(
      DRAFT_STORAGE_KEY
    );

    window.location.reload();
  };

  const [savedResumeId, setSavedResumeId] =
    useState(resumeId);

  const [
    isLoadingSavedResume,
    setIsLoadingSavedResume,
  ] = useState(Boolean(resumeId));

  const [isSavingToDashboard, setIsSavingToDashboard] =
    useState(false);

  const [saveStatus, setSaveStatus] =
    useState("");

  // Load an existing saved resume from the backend
  // when opened via "Continue Editing" on the dashboard.
  useEffect(() => {
    if (!resumeId) {
      return;
    }

    let cancelled = false;

    const loadSavedResume = async () => {
      try {
        const token = localStorage.getItem(
          "resumepilot_token"
        );

        const response = await fetch(
          `http://localhost:5000/api/resumes/${resumeId}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          }
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Could not load this resume."
          );
        }

        setResumeData(data.resumeData);
        setSelectedTemplate(
          data.template || "classic"
        );
        setCurrentQuestion(
          questions.length
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load saved resume:",
            error
          );
          setError(
            "Could not load this resume from your account."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSavedResume(false);
        }
      }
    };

    loadSavedResume();

    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  const handleSaveToDashboard = async () => {
    const token = localStorage.getItem(
      "resumepilot_token"
    );

    if (!token) {
      setSaveStatus(
        "Please log in to save resumes to your account."
      );
      return;
    }

    setIsSavingToDashboard(true);
    setSaveStatus("");

    try {
      const isUpdate = Boolean(savedResumeId);

      const url = isUpdate
        ? `http://localhost:5000/api/resumes/${savedResumeId}`
        : "http://localhost:5000/api/resumes";

      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: resumeData.name || "Untitled Resume",
          template: selectedTemplate,
          resumeData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not save this resume."
        );
      }

      if (!isUpdate && data.id) {
        setSavedResumeId(data.id);
      }

      setSaveStatus(
        "✓ Saved to your account."
      );

      setTimeout(
        () => setSaveStatus(""),
        3000
      );
    } catch (error) {
      console.error(
        "Save to dashboard failed:",
        error
      );
      setSaveStatus(
        error.message ||
          "Could not save this resume."
      );
    } finally {
      setIsSavingToDashboard(false);
    }
  };

  const [isListening, setIsListening] =
    useState(false);

  const [voiceError, setVoiceError] =
    useState("");

  const speechSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition ||
      window.webkitSpeechRecognition);

  const speechSynthesisSupported =
    typeof window !== "undefined" &&
    window.speechSynthesis;

  // When opened via "Speak", the assistant talks back by
  // default. Opened via "Type", it stays silent unless the
  // user turns it on with the toggle button.
  const [
    voiceAssistantEnabled,
    setVoiceAssistantEnabled,
  ] = useState(
    preferVoice && Boolean(speechSynthesisSupported)
  );

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const speechQueueCountRef = useRef(0);

  // When opened via "Speak", start the "already spoken"
  // counter at 0 so the opening greeting + first question
  // (already in the initial messages array) get spoken too.
  // Otherwise, start at the current count so enabling the
  // voice assistant later doesn't replay the whole history.
  const previousMessageCountRef = useRef(
    preferVoice && messages.length <= 2
      ? 0
      : messages.length
  );

  const toggleVoiceAssistant = () => {
    const next = !voiceAssistantEnabled;

    setVoiceAssistantEnabled(next);

    if (!next && speechSynthesisSupported) {
      window.speechSynthesis.cancel();
      speechQueueCountRef.current = 0;
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      setVoiceError(
        "Voice input isn't supported in this browser. Try Chrome or Edge, or type your answer instead."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    // Don't let the mic pick up the assistant's own voice.
    if (speechSynthesisSupported) {
      window.speechSynthesis.cancel();
      speechQueueCountRef.current = 0;
      setIsSpeaking(false);
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    const recognition =
      new SpeechRecognitionClass();

    // Indian English recognises Indian accents and names far
    // better than the US default.
    recognition.lang = "en-IN";

    // In Speak mode keep listening through natural pauses
    // ("umm...") and finish after a short silence.
    recognition.continuous = preferVoice;
    recognition.interimResults = true;

    let finalTranscript = "";
    let latestCombined = "";
    let silenceTimer = null;
    let utteranceDispatched = false;

    const resetSilenceTimer = () => {
      if (!preferVoice) {
        return;
      }

      clearTimeout(silenceTimer);

      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 1800);
    };

    recognition.onstart = () => {
      setVoiceError("");
      setIsListening(true);
    };

    let confirmationHandled = false;

    recognition.onresult = (event) => {
      let interimTranscript = "";

      resetSilenceTimer();

      // While an answer is awaiting confirmation, treat
      // speech as a yes / no command instead of an answer.
      const controls = confirmControlsRef.current;

      if (controls.phase === "confirming") {
        if (confirmationHandled) {
          return;
        }

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {
          if (!event.results[i].isFinal) {
            continue;
          }

          const decision = interpretConfirmation(
            event.results[i][0].transcript
          );

          if (decision) {
            confirmationHandled = true;
            recognition.stop();

            if (decision === "yes") {
              controls.confirm?.();
            } else {
              controls.edit?.();
            }

            return;
          }
        }

        return;
      }

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcriptPiece =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript +=
            transcriptPiece + " ";
        } else {
          interimTranscript +=
            transcriptPiece;
        }
      }

      latestCombined = (
        finalTranscript + interimTranscript
      ).trim();

      setInput(latestCombined);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        setVoiceError(
          "Didn't catch that — please try again."
        );
      } else if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setVoiceError(
          "Microphone access was blocked. Please allow microphone permissions and try again."
        );
      } else {
        setVoiceError(
          "Voice input hit a problem. Please try again or type your answer."
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      clearTimeout(silenceTimer);
      setIsListening(false);

      // Speak mode: once the person stops talking, understand
      // what they said and carry on with the interview.
      if (
        preferVoice &&
        !confirmationHandled &&
        !utteranceDispatched &&
        latestCombined
      ) {
        utteranceDispatched = true;

        confirmControlsRef.current.handleUtterance?.(
          latestCombined
        );
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakMessage = (text) => {
    const spoken = cleanForSpeech(text);

    // Skip the "enhancing..." status line; it's not worth
    // reading out loud.
    if (
      !voiceAssistantEnabled ||
      !speechSynthesisSupported ||
      !spoken ||
      String(text).trim().startsWith("✨")
    ) {
      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(spoken);

    utterance.lang = "en-IN";

    speechQueueCountRef.current += 1;
    setIsSpeaking(true);

    const finishOne = () => {
      speechQueueCountRef.current = Math.max(
        0,
        speechQueueCountRef.current - 1
      );

      if (speechQueueCountRef.current === 0) {
        setIsSpeaking(false);

        // Hands-free loop: once the assistant is done
        // talking, start listening for the answer.
        if (
          voiceAssistantEnabled &&
          speechSupported &&
          !isListening &&
          currentQuestion < questions.length
        ) {
          toggleListening();
        }
      }
    };

    utterance.onend = finishOne;
    utterance.onerror = finishOne;

    window.speechSynthesis.speak(utterance);
  };

  // Speak any new AI message as it arrives.
  useEffect(() => {
    if (
      messages.length >
      previousMessageCountRef.current
    ) {
      messages
        .slice(previousMessageCountRef.current)
        .forEach((message) => {
          if (
            message.sender === "ai" ||
            message.sender === "error"
          ) {
            speakMessage(message.text);
          }
        });
    }

    previousMessageCountRef.current =
      messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    return () => {
      speechSynthesisSupported &&
        window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!preferVoice || !speechSupported) {
      return;
    }

    // If the browser can speak responses, the assistant
    // speaks the opening greeting/question first and then
    // starts listening automatically once it's done (see
    // speakMessage's hands-free loop) — don't also start
    // the mic here, or it'll pick up the assistant's own
    // voice. Only fall back to starting the mic immediately
    // if speech synthesis isn't available at all.
    if (speechSynthesisSupported) {
      return;
    }

    // Deferred so the page has settled before requesting
    // microphone permission.
    const timer = setTimeout(() => {
      toggleListening();
    }, 0);

    return () => clearTimeout(timer);
    // Only run once, when the page is first opened via "Speak".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadPDF = async () => {
    if (isExportingPDF) {
      return;
    }

    setIsExportingPDF(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();
      const pageHeight =
        pdf.internal.pageSize.getHeight();
      const margin = 50;
      const contentWidth =
        pageWidth - margin * 2;

      let y = margin;

      const ensureSpace = (needed) => {
        if (
          y + needed >
          pageHeight - margin
        ) {
          pdf.addPage();
          y = margin;
        }
      };

      const addLines = (
        text,
        {
          size = 10,
          style = "normal",
          gap = 13,
          color = [40, 36, 50],
          align = "left",
          x = margin,
          maxWidth = contentWidth,
        } = {}
      ) => {
        if (!text) {
          return;
        }

        pdf.setFont("helvetica", style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);

        const lines = pdf.splitTextToSize(
          String(text),
          maxWidth
        );

        lines.forEach((line) => {
          ensureSpace(gap);
          pdf.text(line, x, y, { align });
          y += gap;
        });
      };

      const addSectionHeading = (heading) => {
        y += 8;
        ensureSpace(26);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(70, 55, 160);
        pdf.text(heading, margin, y);
        y += 5;

        pdf.setDrawColor(210, 205, 225);
        pdf.line(
          margin,
          y,
          pageWidth - margin,
          y
        );
        y += 14;
      };

      const addEntrySection = (
        heading,
        entries,
        type
      ) => {
        if (!entries || entries.length === 0) {
          return;
        }

        addSectionHeading(heading);

        entries.forEach((item) => {
          const { title, bullets } =
            getEntryTitleAndBullets(
              item,
              type
            );

          addLines(title, {
            size: 10.5,
            style: "bold",
            gap: 13,
            color: [30, 28, 40],
          });

          bullets.forEach((bullet) => {
            addLines(`•  ${bullet}`, {
              size: 9.5,
              gap: 12,
              color: [70, 66, 80],
            });
          });

          y += 6;
        });
      };

      // Header
      addLines(
        resumeData.name || "Your Name",
        {
          size: 20,
          style: "bold",
          gap: 24,
          align: "center",
          x: pageWidth / 2,
          color: [20, 18, 30],
        }
      );

      const contactLine = [
        resumeData.email,
        resumeData.phone,
        resumeData.location,
      ]
        .filter(Boolean)
        .join("   |   ");

      if (contactLine) {
        addLines(contactLine, {
          size: 9.5,
          align: "center",
          x: pageWidth / 2,
          color: [110, 105, 125],
        });
      }

      y += 8;
      ensureSpace(4);
      pdf.setDrawColor(40, 36, 50);
      pdf.line(
        margin,
        y,
        pageWidth - margin,
        y
      );
      y += 18;

      // Professional summary
      const summary =
        resumeData.professionalSummary ||
        [
          resumeData.about,
          resumeData.strengths
            ? `Strong in ${resumeData.strengths}.`
            : "",
          resumeData.careerGoal
            ? `Career goal: ${resumeData.careerGoal}`
            : "",
        ]
          .filter(Boolean)
          .join(" ");

      if (summary) {
        addSectionHeading(
          "PROFESSIONAL SUMMARY"
        );
        addLines(summary, {
          size: 9.5,
          gap: 13,
          color: [70, 66, 80],
        });
        y += 6;
      }

      addEntrySection(
        "KEY TECHNICAL PROJECTS",
        resumeData.projects,
        "projects"
      );

      addEntrySection(
        "EDUCATION",
        resumeData.education,
        "education"
      );

      if (
        resumeData.technicalSkills ||
        resumeData.nonTechnicalSkills
      ) {
        addSectionHeading(
          "TECHNICAL AND NON-TECHNICAL SKILLS"
        );

        if (resumeData.technicalSkills) {
          addLines(
            `Technical Skills: ${resumeData.technicalSkills}`,
            { size: 9.5, gap: 12, color: [70, 66, 80] }
          );
        }

        if (resumeData.nonTechnicalSkills) {
          addLines(
            `Non-Technical Skills: ${resumeData.nonTechnicalSkills}`,
            { size: 9.5, gap: 12, color: [70, 66, 80] }
          );
        }

        y += 6;
      }

      addEntrySection(
        "EXPERIENCE",
        resumeData.experience,
        "experience"
      );

      addEntrySection(
        "CERTIFICATIONS",
        resumeData.certifications,
        "certifications"
      );

      addEntrySection(
        "ACHIEVEMENTS",
        resumeData.achievements,
        "achievements"
      );

      if (resumeData.languages) {
        addSectionHeading("LANGUAGES KNOWN");
        addLines(resumeData.languages, {
          size: 9.5,
          gap: 12,
          color: [70, 66, 80],
        });
      }

      const fileName = `${(
        resumeData.name || "Resume"
      )
        .trim()
        .replace(/\s+/g, "_")}_Resume.pdf`;

      pdf.save(fileName);
    } catch (error) {
      console.error(
        "PDF export failed:",
        error
      );

      alert(
        "Something went wrong while creating the PDF. Please try again."
      );
    } finally {
      setIsExportingPDF(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const currentQuestionData =
    currentQuestion < questions.length
      ? questions[currentQuestion]
      : null;

  const addMessage = (sender, text) => {
    setMessages((previous) => [
      ...previous,
      {
        sender,
        text,
      },
    ]);
  };

  /*
   * Move to the next question.
   */
  const moveToNextQuestion = () => {
    const nextQuestion =
      currentQuestion + 1;

    setPendingAnswer(null);
    setActiveMultipleKey(null);
    setPhase("question");
    setInput("");
    setError("");
    setSelectedSkills([]);

    if (
      nextQuestion < questions.length
    ) {
      setCurrentQuestion(nextQuestion);

      setTimeout(() => {
        addMessage(
          "ai",
          questions[nextQuestion].question
        );
      }, 200);
    } else {
      setCurrentQuestion(
        questions.length
      );

      setTimeout(() => {
        addMessage(
          "ai",
          "Excellent! 🎉 I've collected all your information. Your ATS-friendly resume is ready in the live preview."
        );
      }, 200);
    }
  };

  /*
   * Previous Question
   */
  const goToPreviousQuestion = () => {
    if (currentQuestion <= 0) {
      return;
    }

    const previousQuestion =
      currentQuestion - 1;

    setCurrentQuestion(
      previousQuestion
    );

    setPendingAnswer(null);
    setActiveMultipleKey(null);
    setPhase("question");
    setError("");

    const previousData =
      questions[previousQuestion];

    const existingValue =
      resumeData[previousData.key];

    if (
      Array.isArray(existingValue)
    ) {
      setInput("");
      setSelectedSkills([]);
    } else if (previousData.multiSelect) {
      const existingSkills = existingValue
        ? existingValue
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      setInput(existingValue || "");
      setSelectedSkills(existingSkills);
    } else {
      setInput(existingValue || "");
      setSelectedSkills([]);
    }

    addMessage(
      "ai",
      `Let's go back. ${previousData.question}`
    );
  };

  /*
   * Start multiple-entry section
   */
  /*
   * Handle details for multiple-entry sections.
   *
   * The local AI is called even when the user gives
   * a short one-line answer.
   */
  const handleMultipleDetails = async (
  typedAnswer
) => {
  if (!activeMultipleKey) {
    return;
  }

  const key =
    activeMultipleKey;

  if (!typedAnswer) {
    setError(
      `Please enter your ${sectionNames[key]} details.`
    );

    return;
  }

  setError("");
  setInput("");
  setIsEnhancing(true);

  addMessage(
    "user",
    typedAnswer
  );

  addMessage(
    "ai",
    "✨ ResumePilot AI is professionally enhancing your information..."
  );

  try {
    const enhanced =
      await enhanceWithAI(
        key,
        typedAnswer,
        resumeData.jobTitle
      );

    /*
     * DO NOT SAVE YET.
     */
    setPendingAnswer({
      key,
      value: typedAnswer,
      enhanced,
      originalPhase: "multiple-details",
    });

    setPhase("confirming");

    addMessage(
      "ai",
      "I've prepared professional ATS-friendly content. Please review and confirm it below."
    );
  } catch (error) {
    console.error(
      "AI enhancement error:",
      error
    );

    setError(
      error.message ||
        "AI could not process this information."
    );

    addMessage(
      "error",
      "⚠️ AI could not enhance this information. Please try again."
    );

    setInput(typedAnswer);
  } finally {
    setIsEnhancing(false);
  }
};

  /*
   * Confirm project / experience /
   * certification / achievement.
   */
  const confirmMultipleAnswer = () => {
  if (!pendingAnswer) {
    return;
  }

  const {
    key,
    value,
    enhanced,
  } = pendingAnswer;

  /*
   * Handle Yes / No / Fresher confirmation
   * separately from project details.
   */
  if (
    pendingAnswer.originalPhase ===
      "multiple-choice" ||
    pendingAnswer.originalPhase ===
      "fresher"
  ) {
    const answer =
      value.toLowerCase();

    if (
      answer === "no"
    ) {
      setResumeData(
        (previous) => ({
          ...previous,
          [key]: [],
        })
      );

      setPendingAnswer(null);

      addMessage(
        "ai",
        "✓ Confirmed. Moving to the next section."
      );

      moveToNextQuestion();

      return;
    }

    if (
      answer === "fresher"
    ) {
      setResumeData(
        (previous) => ({
          ...previous,
          experience: [],
        })
      );

      setPendingAnswer(null);

      addMessage(
        "ai",
        "✓ Confirmed. I'll treat you as a fresher."
      );

      moveToNextQuestion();

      return;
    }

    if (
      answer === "yes"
    ) {
      setPendingAnswer(null);

      setActiveMultipleKey(key);
      setPhase("multiple-details");
      setInput("");

      addMessage(
        "ai",
        `✓ Confirmed. Tell me about your first ${sectionNames[key]}.`
      );

      return;
    }
  }

  /*
   * Handle Yes / No confirmation for
   * "Do you have another project / experience /
   * certification / achievement?"
   * This must NOT clear existing entries, and
   * "Yes" must lead back into multiple-details
   * so the user can add another entry.
   */
  if (
    pendingAnswer.originalPhase ===
    "asking-more"
  ) {
    const answer =
      value.toLowerCase();

    if (
      answer === "no"
    ) {
      setPendingAnswer(null);
      setActiveMultipleKey(null);

      addMessage(
        "ai",
        "✓ Got it. Moving to the next section."
      );

      moveToNextQuestion();

      return;
    }

    if (
      answer === "yes"
    ) {
      setPendingAnswer(null);
      setPhase("multiple-details");
      setInput("");

      addMessage(
        "ai",
        `✓ Great! Tell me about your next ${sectionNames[activeMultipleKey]}.`
      );

      return;
    }
  }

  /*
   * Normal project / experience /
   * certification / achievement.
   */
  setResumeData(
    (previous) => ({
      ...previous,
      [key]: [
        ...(previous[key] || []),
        {
          original: value,
          enhanced:
            enhanced || value,
        },
      ],
    })
  );

  setPendingAnswer(null);

  setPhase("asking-more");

  addMessage(
    "ai",
    "✓ Perfect! I've added it to your resume."
  );

  setTimeout(() => {
    addMessage(
      "ai",
      `Do you have another ${sectionNames[key]}?`
    );
  }, 200);
};

  /*
   * Confirm normal answer.
   */
  const confirmNormalAnswer = () => {
  if (!pendingAnswer) {
    return;
  }

  const {
    key,
    value,
    enhanced,
  } = pendingAnswer;

  setResumeData(
    (previous) => ({
      ...previous,
      [key]:
        enhanced || value,
    })
  );

  setPendingAnswer(null);

  addMessage(
    "ai",
    "✓ Perfect! I've added it to your resume."
  );

  moveToNextQuestion();
};

  /*
   * Edit confirmation answer.
   */
  const editAnswer = () => {
  if (!pendingAnswer) {
    return;
  }

  const oldAnswer =
    pendingAnswer.value;

  const oldPhase =
    pendingAnswer.originalPhase;

  setInput(oldAnswer);

  setError("");
  setPendingAnswer(null);

  if (
    oldPhase === "multiple-details"
  ) {
    setPhase("multiple-details");
  } else if (
    oldPhase === "asking-more"
  ) {
    setPhase("asking-more");
  } else {
    setPhase("question");
  }

  addMessage(
    "ai",
    "Sure. Please edit your answer and submit it again."
  );
};

  /*
   * Skip Question
   */
  const skipQuestion = () => {
    if (!currentQuestionData) {
      return;
    }

    setInput("");
    setError("");
    setPendingAnswer(null);

    addMessage(
      "user",
      "Skipped"
    );

    addMessage(
      "ai",
      "No problem. We'll continue with the next section."
    );

    moveToNextQuestion();
  };

  /*
   * Normal fields that the AI should enhance.
   *
   * We do NOT send name, email, phone,
   * college or graduation year to the AI.
   */
  const shouldEnhanceNormalField =
    (key) =>
      descriptiveKeys.includes(key);

  /*
   * Submit answer.
   */
  const submitAnswer = async (suggestionValue = null) => {
  if (isEnhancing) {
    return;
  }

  const typedAnswer = (
    suggestionValue !== null
      ? suggestionValue
      : input
  ).trim();

  if (!typedAnswer) {
    setError(
      "Please enter an answer or choose a suggestion."
    );
    return;
  }

  setError("");
  setInput("");

  /* =====================================================
     ASKING FOR ANOTHER PROJECT / EXPERIENCE / ETC.
     ===================================================== */

  if (phase === "asking-more") {
    const lowerAnswer =
      typedAnswer.toLowerCase();

    if (
      lowerAnswer !== "yes" &&
      lowerAnswer !== "no"
    ) {
      setError("Please choose Yes or No.");
      return;
    }

    /*
     * Confirmation is also required for this answer.
     */
    setPendingAnswer({
      key: "asking-more",
      value:
        lowerAnswer === "yes"
          ? "Yes"
          : "No",
      enhanced: "",
      originalPhase: "asking-more",
      multipleKey: activeMultipleKey,
    });

    setPhase("confirming");

    addMessage(
      "user",
      lowerAnswer === "yes"
        ? "Yes"
        : "No"
    );

    addMessage(
      "ai",
      confirmPrompt
    );

    return;
  }

  /* =====================================================
     MULTIPLE-ENTRY DETAILS
     ===================================================== */

  if (phase === "multiple-details") {
    await handleMultipleDetails(
      typedAnswer
    );

    return;
  }

  /* =====================================================
     ALREADY WAITING FOR CONFIRMATION
     ===================================================== */

  if (phase === "confirming") {
    return;
  }

  /* =====================================================
     ALL QUESTIONS COMPLETED
     ===================================================== */

  if (!currentQuestionData) {
    return;
  }

  const key =
    currentQuestionData.key;

  /* =====================================================
     YES / NO QUESTIONS
     ===================================================== */

  if (
    multipleEntryKeys.includes(key)
  ) {
    const lowerAnswer =
      typedAnswer.toLowerCase();

    if (
      key === "experience" &&
      lowerAnswer === "fresher"
    ) {
      /*
       * Fresher also requires confirmation.
       */
      setPendingAnswer({
        key,
        value: "Fresher",
        enhanced: "",
        originalPhase: "fresher",
      });

      setPhase("confirming");

      addMessage(
        "user",
        "Fresher"
      );

      addMessage(
        "ai",
        "Please confirm that you want to continue as a fresher."
      );

      return;
    }

    if (
      lowerAnswer === "yes" ||
      lowerAnswer === "no" ||
      lowerAnswer === "none"
    ) {
      const displayAnswer =
        lowerAnswer === "yes"
          ? "Yes"
          : "No";

      setPendingAnswer({
        key,
        value: displayAnswer,
        enhanced: "",
        originalPhase: "multiple-choice",
      });

      setPhase("confirming");

      addMessage(
        "user",
        displayAnswer
      );

      addMessage(
        "ai",
        confirmPrompt
      );

      return;
    }

    setError(
      "Please choose Yes or No."
    );

    return;
  }

  /* =====================================================
     VALIDATE NORMAL ANSWER
     ===================================================== */

  const validationError =
    validateAnswer(
      key,
      typedAnswer
    );

  if (validationError) {
    /*
     * Invalid answers are NOT saved.
     */
    setInput("");

    setError(
      validationError
    );

    addMessage(
      "error",
      `⚠️ ${validationError}`
    );

    return;
  }

  const formattedAnswer =
    formatAnswer(
      key,
      typedAnswer
    );

  /* =====================================================
     AI ENHANCEMENT
     ===================================================== */

  if (
    shouldEnhanceNormalField(key)
  ) {
    setIsEnhancing(true);

    addMessage(
      "user",
      formattedAnswer
    );

    addMessage(
      "ai",
      "✨ ResumePilot AI is professionally enhancing your information..."
    );

    try {
      const enhanced =
        await enhanceWithAI(
          key,
          formattedAnswer,
          resumeData.jobTitle
        );

      /*
       * DO NOT SAVE YET.
       *
       * Wait for confirmation.
       */
      setPendingAnswer({
        key,
        value: formattedAnswer,
        enhanced,
        originalPhase: "normal",
      });

      setPhase("confirming");

      addMessage(
        "ai",
        "I've prepared professional ATS-friendly content. Please review and confirm it below."
      );
    } catch (error) {
      console.error(
        "AI enhancement error:",
        error
      );

      setError(
        error.message ||
          "AI could not process this information."
      );

      addMessage(
        "error",
        "⚠️ AI could not enhance this answer. Please try again."
      );

      setInput(formattedAnswer);
    } finally {
      setIsEnhancing(false);
    }

    return;
  }

  /* =====================================================
     NORMAL ANSWER
     ===================================================== */

  /*
   * IMPORTANT:
   * We DO NOT save the answer yet.
   * We first ask for confirmation.
   */
  setPendingAnswer({
    key,
    value: formattedAnswer,
    enhanced: "",
    originalPhase: "normal",
  });

  setPhase("confirming");

  addMessage(
    "user",
    formattedAnswer
  );

  addMessage(
    "ai",
    confirmPrompt
  );
};

  /*
   * Enter = submit.
   * Shift + Enter = new line.
   */
  const handleKeyDown = (
    event
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      submitAnswer();
    }
  };

  /*
   * Suggestion fills textbox.
   * It does NOT automatically submit.
   */
  const selectSuggestion = async (suggestion) => {
  if (isEnhancing) {
    return;
  }

  setInput("");
  setError("");

  // Automatically submit the selected suggestion
  await submitAnswer(suggestion);
};

  /*
   * Suggestions for each phase.
   */
  const getSuggestions = () => {
    if (
      phase === "asking-more"
    ) {
      return [
        "Yes",
        "No",
      ];
    }

    if (
      phase === "multiple-details"
    ) {
      if (
        activeMultipleKey ===
        "education"
      ) {
        return [
          "B.Tech in Computer Science, XYZ University, 2024",
          "12th grade (PUC), ABC PU College, 2022",
          "BCA, XYZ College, 2024",
        ];
      }

      if (
        activeMultipleKey ===
        "projects"
      ) {
        return [
          "Built a website using React",
          "Developed a student management system using Java",
          "Created a data analysis project using Python",
        ];
      }

      if (
        activeMultipleKey ===
        "experience"
      ) {
        return [
          "Completed an internship in data analytics",
          "Completed a software development internship",
          "Worked as a web development intern",
        ];
      }

      if (
        activeMultipleKey ===
        "certifications"
      ) {
        return [
          "AWS Cloud Practitioner",
          "Python Programming Certification",
          "Data Analytics Certification",
        ];
      }

      if (
        activeMultipleKey ===
        "achievements"
      ) {
        return [
          "Participated in a coding competition",
          "Completed a college hackathon",
          "Received an academic achievement award",
        ];
      }

      return [];
    }

    if (
      phase === "confirming"
    ) {
      return [];
    }

    return (
      currentQuestionData?.suggestions ||
      []
    );
  };

  const suggestions =
    getSuggestions();

  /*
   * Convert resume data to display text.
   */
  const getDisplayValue = (
    key
  ) => {
    const value =
      resumeData[key];

    if (
      Array.isArray(value)
    ) {
      return value
        .map((item) => {
          if (
            typeof item ===
            "object"
          ) {
            return (
              item.enhanced ||
              item.original ||
              ""
            );
          }

          return item;
        })
        .filter(Boolean)
        .join(", ");
    }

    return value || "";
  };

  /*
   * Project title generation.
   */
  const getProjectTitle = (
    text
  ) => {
    if (!text) {
      return "Technical Project";
    }

    const clean =
      text.trim();

    if (
      /nutrimind/i.test(clean)
    ) {
      return "NutriMind AI";
    }

    if (
      /nutrition/i.test(clean)
    ) {
      return "Nutrition Tracking Application";
    }

    if (
      /website/i.test(clean)
    ) {
      return "Web Application Project";
    }

    if (
      /react/i.test(clean)
    ) {
      return "React Application";
    }

    if (
      /python/i.test(clean)
    ) {
      return "Python Project";
    }

    if (
      /java/i.test(clean)
    ) {
      return "Java Application";
    }

    return clean
      .replace(
        /^made\s+/i,
        ""
      )
      .replace(
        /^developed\s+/i,
        ""
      )
      .replace(
        /^created\s+/i,
        ""
      );
  };

  /*
   * Shared by renderEntries() and the PDF generator so both
   * always agree on what a project/experience/etc entry
   * actually displays.
   */
  const getEntryTitleAndBullets = (
    item,
    type
  ) => {
    const isObject = typeof item === "object";
    const original = isObject ? item.original : item;
    const enhanced = isObject ? item.enhanced : item;

    const bullets = String(enhanced || original)
      .split(/\n+/)
      .map((line) => line.replace(/^[•●▪▸\-*]\s*/, "").trim())
      .filter(Boolean);

    const title =
      type === "projects"
        ? getProjectTitle(original)
        : original;

    return { title, bullets };
  };

  /*
   * Render project / experience /
   * certification / achievement entries.
   */
  const renderEntries = (entries, type) => {
    if (!entries || entries.length === 0) {
      return null;
    }

    return entries.map((item, index) => {
      const { title, bullets } =
        getEntryTitleAndBullets(item, type);

      return (
        <div className="reference-entry" key={index}>

          {isEditingResume && (
            <div className="entry-edit-controls">

              <button
                type="button"
                onClick={() =>
                  moveEntry(type, index, -1)
                }
                disabled={index === 0}
                title="Move up"
              >
                ↑
              </button>

              <button
                type="button"
                onClick={() =>
                  moveEntry(type, index, 1)
                }
                disabled={
                  index === entries.length - 1
                }
                title="Move down"
              >
                ↓
              </button>

              <button
                type="button"
                className="remove-entry-button"
                onClick={() =>
                  removeEntry(type, index)
                }
                title="Remove this entry"
              >
                ✕
              </button>

            </div>
          )}

          <div className="reference-entry-title">
            {title}
          </div>

          {isEditingResume ? (
            <textarea
              className="resume-bullet-list editable-text"
              value={bullets.join("\n")}
              onChange={(event) =>
                updateEntryText(
                  type,
                  index,
                  event.target.value
                )
              }
              rows={Math.max(bullets.length, 2)}
            />
          ) : (
            <ul className="resume-bullet-list">
              {bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          )}

        </div>
      );
    });
  };

  const renderAddEntryButton = (key) => {
    if (!isEditingResume) {
      return null;
    }

    return (
      <button
        type="button"
        className="add-entry-button"
        onClick={() => addBlankEntry(key)}
      >
        + Add {sectionNames[key]}
      </button>
    );
  };

  /*
   * Template names.
   */
  const confirmCurrentAnswer = () => {
    if (!pendingAnswer) {
      return;
    }

    if (
      pendingAnswer.originalPhase ===
        "multiple-details" ||
      pendingAnswer.originalPhase ===
        "multiple-choice" ||
      pendingAnswer.originalPhase === "fresher" ||
      pendingAnswer.originalPhase === "asking-more"
    ) {
      confirmMultipleAnswer();
    } else {
      confirmNormalAnswer();
    }
  };

  /*
   * What the assistant would say to (re-)ask the current thing.
   */
  const currentPromptText = () => {
    if (phase === "multiple-details") {
      return `Tell me about your ${sectionNames[activeMultipleKey]}.`;
    }

    if (phase === "asking-more") {
      return `Do you have another ${sectionNames[activeMultipleKey]}?`;
    }

    return currentQuestionData
      ? currentQuestionData.question
      : "";
  };

  const isYesNoStep =
    phase === "asking-more" ||
    (phase === "question" &&
      currentQuestionData &&
      multipleEntryKeys.includes(
        currentQuestionData.key
      ));

  /*
   * Turn what the person *said* into what this step needs.
   */
  const interpretSpokenAnswer = (text) => {
    if (phase === "asking-more") {
      return normalizeYesNo(text);
    }

    if (phase === "multiple-details") {
      return normalizeFreeText(text);
    }

    if (!currentQuestionData) {
      return null;
    }

    const key = currentQuestionData.key;

    if (multipleEntryKeys.includes(key)) {
      return normalizeYesNo(text, {
        allowFresher: key === "experience",
      });
    }

    switch (key) {
      case "name":
        return normalizeName(text);
      case "email":
        return normalizeEmail(text);
      case "phone":
        return normalizePhone(text);
      case "location":
        return normalizeLocation(text);
      case "jobTitle":
        return normalizeJobTitle(text);
      case "technicalSkills":
      case "nonTechnicalSkills":
      case "languages":
        return normalizeList(text);
      default:
        return normalizeFreeText(text);
    }
  };

  /*
   * Speak mode: called when the person finishes talking.
   * Understands commands, feelings and the answer itself.
   */
  const handleVoiceUtterance = (raw) => {
    const text = String(raw || "").trim();

    if (
      !text ||
      phase === "confirming" ||
      isEnhancing ||
      (phase === "question" && !currentQuestionData)
    ) {
      return;
    }

    const intent = detectIntent(text);

    if (intent === "skip") {
      skipQuestion();
      return;
    }

    if (intent === "previous") {
      if (currentQuestion <= 0) {
        addMessage(
          "ai",
          "We're already at the very first question."
        );
      } else {
        goToPreviousQuestion();
      }

      return;
    }

    if (intent === "repeat") {
      addMessage("ai", currentPromptText());
      return;
    }

    if (intent === "help") {
      const example = suggestions[0];

      addMessage(
        "ai",
        example
          ? `Sure. For example, you could say: ${example}.`
          : "Sure. Just tell me in your own words and I'll tidy it up for your resume."
      );

      return;
    }

    const feeling = detectExpression(text);

    if (feeling) {
      addMessage("ai", feeling.reply);

      if (feeling.onlyFeeling) {
        return;
      }
    }

    const understood = interpretSpokenAnswer(text);

    if (!understood) {
      addMessage(
        "ai",
        isYesNoStep
          ? "Sorry, I didn't catch that. Please say yes or no."
          : "Sorry, I didn't quite catch that. Could you say it again?"
      );

      return;
    }

    submitAnswer(understood);
  };

  // Keep the latest handlers available to the speech
  // recognizer, whose callbacks outlive a single render.
  useEffect(() => {
    confirmControlsRef.current = {
      phase,
      confirm: confirmCurrentAnswer,
      edit: editAnswer,
      handleUtterance: handleVoiceUtterance,
    };
  });

  const templates = [
    {
      id: "classic",
      name: "Classic",
      description: "ATS Safe",
    },
    {
      id: "modern",
      name: "Modern",
      description: "ATS Safe",
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "ATS Safe",
    },
    {
      id: "professional",
      name: "Professional",
      description: "ATS Safe",
    },
    {
      id: "executive",
      name: "Executive",
      description: "ATS Safe",
    },
    {
      id: "clean",
      name: "Clean",
      description: "ATS Safe",
    },
  ];

  if (isLoadingSavedResume) {
    return (
      <div className="create-resume-loading">
        <div className="loading-spinner" />
        <p>Loading your resume...</p>
      </div>
    );
  }

  return (
    <div className="create-resume-page">

      {/* ================= HEADER ================= */}

      <header className="create-header">

        <div className="create-brand">

          <div className="create-brand-logo">
            R
          </div>

          <div>
            <strong>
              ResumePilot
            </strong>

            <span>
              AI Resume Builder
            </span>
          </div>

        </div>

        <div className="ats-badge">
          ATS Friendly
        </div>

      </header>

      {/* ================= MAIN CONTENT ================= */}

      <div className="create-content">

        {/* ================= LEFT CHAT ================= */}

        <div
          className={`chat-panel${
            preferVoice ? " voice-panel" : ""
          }`}
        >

          {/* VOICE PROGRESS (Speak mode only) */}

          {preferVoice && (
            <div className="voice-progress-row">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      (Math.min(
                        currentQuestion + 1,
                        questions.length
                      ) /
                        questions.length) *
                      100
                    }%`,
                  }}
                />
              </div>
              <span>
                {Math.min(
                  currentQuestion + 1,
                  questions.length
                )}{" "}
                / {questions.length}
              </span>
            </div>
          )}

          {/* CHAT HEADER */}

          {!preferVoice && (
          <>
          <div className="chat-panel-header">

            <div className="ai-avatar">
              ✦
            </div>

            <div>
              <strong>
                ResumePilot AI
              </strong>

              <span>
                Your resume assistant
              </span>
            </div>

          </div>

          {/* PROGRESS */}

          <div className="question-progress">

            <div className="progress-top">

              <span>
                Resume Progress
              </span>

              <span>
                {Math.min(
                  currentQuestion + 1,
                  questions.length
                )}{" "}
                / {questions.length}
              </span>

            </div>

            <div className="progress-track">

              <div
                className="progress-fill"
                style={{
                  width: `${
                    Math.min(
                      currentQuestion + 1,
                      questions.length
                    ) /
                      questions.length *
                      100
                  }%`,
                }}
              />

            </div>

          </div>

          <div className="autosave-hint">
            💾 Progress autosaves automatically
          </div>
          </>
          )}

          {/* ================= MESSAGES ================= */}

          <div className="messages-container">

            {messages.map(
              (message, index) => (

                <div
                  key={index}
                  className={`message-row ${message.sender}`}
                >

                  {message.sender ===
                    "ai" && (
                    <div className="message-avatar">
                      ✦
                    </div>
                  )}

                  <div
                    className={`message-bubble ${message.sender}`}
                  >
                    {message.text}
                  </div>

                  {preferVoice &&
                    message.sender === "user" && (
                      <div className="message-avatar user-avatar">
                        👤
                      </div>
                    )}

                </div>

              )
            )}

            {isEnhancing && (
              <div className="message-row ai">

                <div className="message-avatar">
                  ✦
                </div>

                <div className="message-bubble ai">
                  ResumePilot AI is thinking...
                </div>

              </div>
            )}

            <div
              ref={messagesEndRef}
            />

          </div>

          {/* ================= VOICE ORB (Speak mode only) ================= */}

          {preferVoice &&
            currentQuestion < questions.length && (
              <div className="voice-orb-area">

                <button
                  type="button"
                  className={`voice-orb${
                    isListening ? " listening" : ""
                  }${isSpeaking ? " speaking" : ""}`}
                  onClick={toggleListening}
                  disabled={isEnhancing}
                  aria-label={
                    isListening
                      ? "Stop listening"
                      : "Tap to speak"
                  }
                >
                  <span className="voice-orb-ring" />
                  <span className="voice-orb-ring second" />
                  <span className="voice-orb-core">
                    {isListening ? "⏹" : "🎙️"}
                  </span>
                </button>

                <div className="voice-orb-label">
                  {!speechSupported
                    ? "Voice isn't supported in this browser — type your answer below"
                    : isListening
                    ? "Listening… tap to stop"
                    : isSpeaking
                    ? "Assistant is speaking…"
                    : phase === "confirming"
                    ? "Tap and say “yes” to continue or “no” to edit"
                    : "Tap to speak"}
                </div>

                <div
                  className={`voice-wave${
                    isListening || isSpeaking
                      ? " active"
                      : ""
                  }`}
                >
                  {Array.from({ length: 11 }).map(
                    (_, index) => (
                      <span
                        key={index}
                        style={{
                          animationDelay: `${
                            index * 0.09
                          }s`,
                        }}
                      />
                    )
                  )}
                </div>

              </div>
            )}

          {/* ================= SUGGESTIONS ================= */}

          {suggestions.length >
            0 && (
            <div className="suggestions-area">

              <span className="suggestions-title">
                ✣ QUICK SUGGESTIONS
              </span>

              <div className="suggestions-list">

                {suggestions.map(
                  (
                    suggestion,
                    index
                  ) => {

                    const isMultiSelect =
                      phase === "question" &&
                      currentQuestionData?.multiSelect;

                    const isSelected =
                      isMultiSelect &&
                      selectedSkills.includes(
                        suggestion
                      );

                    return (
                      <button
                        key={index}
                        type="button"
                        className={`suggestion-chip${
                          isSelected
                            ? " selected"
                            : ""
                        }`}
                        onClick={() => {
                          if (!isMultiSelect) {
                            selectSuggestion(
                              suggestion
                            );
                            return;
                          }

                          setError("");

                          setSelectedSkills(
                            (previous) => {
                              const next =
                                previous.includes(
                                  suggestion
                                )
                                  ? previous.filter(
                                      (item) =>
                                        item !==
                                        suggestion
                                    )
                                  : [
                                      ...previous,
                                      suggestion,
                                    ];

                              setInput(
                                next.join(", ")
                              );

                              return next;
                            }
                          );
                        }}
                        disabled={
                          isEnhancing
                        }
                      >
                        {isMultiSelect &&
                          (isSelected
                            ? "✓ "
                            : "")}
                        {suggestion}
                      </button>
                    );

                  }
                )}

              </div>

            </div>
          )}

          {/* ================= ERROR ================= */}

          {error && (
            <div className="input-error">
              ⚠️ {error}
            </div>
          )}

          {/* =================================================
              CONFIRMATION
              This is shown BEFORE saving AI-enhanced content.
          ================================================= */}

          {phase === "confirming" &&
  pendingAnswer && (

  <div className="confirmation-area">

    <div className="confirmation-text">
      Is this information correct?
    </div>

    <div className="confirmation-answer">

      <div>
        <strong>
          Your answer
        </strong>

        <p>
          {pendingAnswer.value}
        </p>
      </div>

      {pendingAnswer.enhanced && (
        <div>
          <strong>
            AI-enhanced resume content
          </strong>

          <p>
            {pendingAnswer.enhanced}
          </p>
        </div>
      )}

    </div>

    <div className="confirmation-buttons">

      <button
        type="button"
        className="confirm-button"
        onClick={confirmCurrentAnswer}
      >
        ✓ Yes, Continue
      </button>

      <button
        type="button"
        className="edit-button"
        onClick={editAnswer}
      >
        ✎ No, Edit
      </button>

    </div>

  </div>
)}

          {/* =================================================
              IMPORTANT:
              ONLY ONE NAVIGATION BLOCK
              It is ABOVE the textbox.
          ================================================= */}

          {phase !==
            "confirming" &&
            currentQuestion <
              questions.length && (

            <>
              {/* ================= NAVIGATION ================= */}

              <div className="chat-navigation">

                <button
                  type="button"
                  className="previous-question-button"
                  onClick={
                    goToPreviousQuestion
                  }
                  disabled={
                    currentQuestion <=
                      0 ||
                    isEnhancing
                  }
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  className="skip-question-button"
                  onClick={
                    skipQuestion
                  }
                  disabled={
                    !currentQuestionData ||
                    isEnhancing
                  }
                >
                  Skip Question
                </button>

                <button
                  type="button"
                  className="next-question-button"
                  onClick={
                    submitAnswer
                  }
                  disabled={
                    !input.trim() ||
                    !currentQuestionData ||
                    isEnhancing
                  }
                >
                  Next →
                </button>

              </div>

              {speechSynthesisSupported && (
                <div className="voice-assistant-row">

                  <button
                    type="button"
                    className={`voice-assistant-toggle${
                      voiceAssistantEnabled
                        ? " active"
                        : ""
                    }`}
                    onClick={
                      toggleVoiceAssistant
                    }
                  >
                    {voiceAssistantEnabled
                      ? "🔊 Voice Assistant: On"
                      : "🔇 Voice Assistant: Off"}
                  </button>

                  {isSpeaking && (
                    <span className="speaking-indicator">
                      🔈 Speaking...
                    </span>
                  )}

                </div>
              )}

              {/* ================= TEXTBOX ================= */}

              <div className="chat-input-area">

                {!preferVoice && (
                  <button
                    type="button"
                    className={`mic-button${
                      isListening
                        ? " listening"
                        : ""
                    }`}
                    onClick={toggleListening}
                    disabled={isEnhancing}
                    title={
                      speechSupported
                        ? isListening
                          ? "Stop listening"
                          : "Speak your answer"
                        : "Voice input not supported in this browser"
                    }
                  >
                    {isListening ? "⏹" : "🎙️"}
                  </button>
                )}

                <textarea
                  value={input}
                  onChange={(
                    event
                  ) => {
                    setInput(
                      event.target
                        .value
                    );

                    if (error) {
                      setError("");
                    }
                  }}
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder={
                    phase ===
                    "asking-more"
                      ? "Type Yes or No"
                      : phase ===
                        "multiple-details"
                      ? `Describe your ${sectionNames[activeMultipleKey]}...`
                      : currentQuestionData?.placeholder
                  }
                  rows={3}
                  disabled={
                    isEnhancing
                  }
                />

                <button
                  type="button"
                  className="send-button"
                  onClick={
                    submitAnswer
                  }
                  disabled={
                    !input.trim() ||
                    isEnhancing
                  }
                >
                  {isEnhancing
                    ? "..."
                    : "➤"}
                </button>

              </div>

              {voiceError && (
                <div className="voice-error">
                  🎙️ {voiceError}
                </div>
              )}

            </>
          )}

        </div>

        {/* ================= RIGHT RESUME PREVIEW ================= */}

        <div className="resume-preview-panel">

          {/* TEMPLATE SELECTOR */}

          <div className="template-selector">

            {onBackToDashboard && (
              <button
                type="button"
                className="back-to-dashboard-button"
                onClick={onBackToDashboard}
              >
                ← Back to Dashboard
              </button>
            )}

            <div className="template-title">
              ATS-safe professional templates
            </div>

            <button
              type="button"
              className="save-to-dashboard-button"
              onClick={handleSaveToDashboard}
              disabled={isSavingToDashboard}
            >
              {isSavingToDashboard
                ? "Saving..."
                : savedResumeId
                ? "💾 Save Changes"
                : "💾 Save to My Resumes"}
            </button>

            {saveStatus && (
              <div className="save-status">
                {saveStatus}
              </div>
            )}

            <button
              type="button"
              className="download-pdf-button"
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
            >
              {isExportingPDF
                ? "Preparing PDF..."
                : "⬇ Download PDF"}
            </button>

            <button
              type="button"
              className={`edit-resume-button${
                isEditingResume ? " active" : ""
              }`}
              onClick={() =>
                setIsEditingResume(
                  !isEditingResume
                )
              }
            >
              {isEditingResume
                ? "✓ Done Editing"
                : "✎ Edit Resume"}
            </button>

            <button
              type="button"
              className="start-new-button"
              onClick={startNewResume}
            >
              ↺ Start New Resume
            </button>

            <div className="template-options">

              {templates.map(
                (template) => (

                  <button
                    key={
                      template.id
                    }
                    type="button"
                    className={`template-button ${
                      selectedTemplate ===
                      template.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedTemplate(
                        template.id
                      )
                    }
                  >

                    <div
                      className={`template-mini ${template.id}-mini`}
                    >
                      <span />
                      <span />
                      <span />
                    </div>

                    <strong>
                      {template.name}
                    </strong>

                    <small>
                      {template.description}
                    </small>

                  </button>

                )
              )}

            </div>

          </div>

          {/* ================= RESUME PAPER ================= */}

          <div
            ref={resumePaperRef}
            className={`resume-paper template-${selectedTemplate}`}
          >

            {/* HEADER */}

            <div className="reference-header">

              <h1>
                {isEditingResume ? (
                  <input
                    type="text"
                    className="editable-text editable-name"
                    value={
                      resumeData.name || ""
                    }
                    onChange={(event) =>
                      updateSimpleField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Your Name"
                  />
                ) : (
                  resumeData.name ||
                  "Your Name"
                )}
              </h1>

              {resumeData.jobTitle && (
                <div className="reference-job-title">
                  {resumeData.jobTitle.toUpperCase()}
                </div>
              )}

              <div className="reference-contact">

                {resumeData.email && (
                  <span>
                    {resumeData.email}
                  </span>
                )}

                {resumeData.phone && (
                  <span>
                    {resumeData.phone}
                  </span>
                )}

                {resumeData.location && (
                  <span>
                    {resumeData.location}
                  </span>
                )}

              </div>

            </div>

            {/* ================= SUMMARY ================= */}

            {(
  resumeData.about ||
  resumeData.strengths ||
  resumeData.careerGoal
) && (
  <section className="reference-section">

    <h2>
      PROFESSIONAL SUMMARY
    </h2>

    {isEditingResume ? (
      <textarea
        className="professional-summary-text editable-text"
        value={
          resumeData.professionalSummary ||
          [
            resumeData.about,
            resumeData.strengths
              ? `Strong in ${resumeData.strengths}.`
              : "",
            resumeData.careerGoal
              ? `Career goal: ${resumeData.careerGoal}`
              : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
        onChange={(event) =>
          updateSimpleField(
            "professionalSummary",
            event.target.value
          )
        }
        rows={5}
      />
    ) : (
      <p className="professional-summary-text">
        {resumeData.professionalSummary ||
          [
            resumeData.about,
            resumeData.strengths
              ? `Strong in ${resumeData.strengths}.`
              : "",
            resumeData.careerGoal
              ? `Career goal: ${resumeData.careerGoal}`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
      </p>
    )}

  </section>
)}

            {/* ================= PROJECTS ================= */}

            {(isEditingResume ||
              (resumeData.projects &&
                resumeData.projects.length >
                  0)) && (

              <section className="reference-section">

                <h2>
                  KEY TECHNICAL PROJECTS
                </h2>

                {renderEntries(
                  resumeData.projects,
                  "projects"
                )}

                {renderAddEntryButton(
                  "projects"
                )}

              </section>
            )}

            {/* ================= EDUCATION ================= */}

            {(isEditingResume ||
  (resumeData.education &&
    resumeData.education.length > 0)) && (
    <section className="reference-section">

      <h2>EDUCATION</h2>

      {renderEntries(
        resumeData.education,
        "education"
      )}

      {renderAddEntryButton("education")}

    </section>
)}

            {/* ================= SKILLS ================= */}

            {resumeData.technicalSkills && (
  <section className="reference-section">

    <h2>
      TECHNICAL AND NON-TECHNICAL SKILLS
    </h2>

    {isEditingResume ? (
      <>
        <label className="edit-field-label">
          Technical Skills
        </label>
        <textarea
          className="editable-text"
          value={
            resumeData.technicalSkills || ""
          }
          onChange={(event) =>
            updateSimpleField(
              "technicalSkills",
              event.target.value
            )
          }
          rows={2}
        />

        <label className="edit-field-label">
          Non-Technical Skills
        </label>
        <textarea
          className="editable-text"
          value={
            resumeData.nonTechnicalSkills ||
            ""
          }
          onChange={(event) =>
            updateSimpleField(
              "nonTechnicalSkills",
              event.target.value
            )
          }
          rows={2}
        />
      </>
    ) : (
      <ul className="resume-bullet-list">

        <li>
          <strong>
            Technical Skills:
          </strong>{" "}
          {resumeData.technicalSkills}
        </li>

        {resumeData.nonTechnicalSkills && (
          <li>
            <strong>
              Non-Technical Skills:
            </strong>{" "}
            {resumeData.nonTechnicalSkills}
          </li>
        )}

      </ul>
    )}

  </section>
)}
            {/* ================= EXPERIENCE ================= */}

            {(isEditingResume ||
              (resumeData.experience &&
                resumeData.experience.length >
                  0)) && (

              <section className="reference-section">

                <h2>
                  EXPERIENCE
                </h2>

                {renderEntries(
                  resumeData.experience,
                  "experience"
                )}

                {renderAddEntryButton(
                  "experience"
                )}

              </section>
            )}

            {/* ================= CERTIFICATIONS ================= */}

            {(isEditingResume ||
              (resumeData.certifications &&
                resumeData.certifications
                  .length > 0)) && (

              <section className="reference-section">

                <h2>
                  CERTIFICATIONS
                </h2>

                {renderEntries(
                  resumeData.certifications,
                  "certifications"
                )}

                {renderAddEntryButton(
                  "certifications"
                )}

              </section>
            )}

            {/* ================= ACHIEVEMENTS ================= */}

            {(isEditingResume ||
              (resumeData.achievements &&
                resumeData.achievements
                  .length > 0)) && (

              <section className="reference-section">

                <h2>
                  ACHIEVEMENTS
                </h2>

                {renderEntries(
                  resumeData.achievements,
                  "achievements"
                )}

                {renderAddEntryButton(
                  "achievements"
                )}


              </section>
            )}

            {/* ================= LANGUAGES ================= */}

            {(isEditingResume ||
              getDisplayValue(
                "languages"
              )) && (

              <section className="reference-section">

                {isEditingResume ? (
                  <>
                    <label className="edit-field-label">
                      Languages Known
                    </label>
                    <textarea
                      className="editable-text"
                      value={
                        resumeData.languages ||
                        ""
                      }
                      onChange={(event) =>
                        updateSimpleField(
                          "languages",
                          event.target.value
                        )
                      }
                      rows={1}
                    />
                  </>
                ) : (
                  <p className="languages-line">

                    <strong>
                      Languages Known:
                    </strong>{" "}

                    {getDisplayValue(
                      "languages"
                    )}

                  </p>
                )}

              </section>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default CreateResume;