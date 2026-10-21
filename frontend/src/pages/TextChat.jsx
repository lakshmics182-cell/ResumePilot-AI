import { useState } from "react";

const questions = [
  {
    key: "name",
    question: "Hi! I'm ResumePilot 👋 What is your full name?"
  },
  {
    key: "email",
    question: "Nice to meet you! What is your email address?"
  },
  {
    key: "phone",
    question: "What is your phone number?"
  },
  {
    key: "education",
    question: "Tell me about your education. Include your course, college and graduation year."
  },
  {
    key: "skills",
    question: "What technical and professional skills do you have?"
  },
  {
    key: "projects",
    question: "Tell me about any projects you have worked on."
  },
  {
    key: "experience",
    question: "Do you have any internship or work experience? If yes, tell me about it."
  },
  {
    key: "careerGoal",
    question: "What type of job or career are you looking for?"
  }
];

function TextChat() {

  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: questions[0].question
    }
  ]);

  const [input, setInput] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [resumeData, setResumeData] = useState({});

  const sendMessage = () => {

    if (!input.trim()) {
      return;
    }

    const answer = input.trim();

    const userMessage = {
      sender: "user",
      text: answer
    };

    setMessages((previous) => [
      ...previous,
      userMessage
    ]);

    setResumeData((previous) => ({
      ...previous,
      [questions[currentQuestion].key]: answer
    }));

    setInput("");


    const nextQuestion = currentQuestion + 1;


    setTimeout(() => {

      if (nextQuestion < questions.length) {

        setMessages((previous) => [
          ...previous,
          {
            sender: "ai",
            text: questions[nextQuestion].question
          }
        ]);

        setCurrentQuestion(nextQuestion);

      } else {

        setMessages((previous) => [
          ...previous,
          {
            sender: "ai",
            text:
              "Perfect! 🎉 I have collected your information. Your resume is ready to be generated."
          }
        ]);

        setCurrentQuestion(questions.length);

      }

    }, 500);
  };


  const handleKeyDown = (e) => {

    if (e.key === "Enter") {
      sendMessage();
    }

  };


  return (
    <div className="chat-screen">

      {/* Header */}

      <header className="chat-header">

        <div className="chat-brand">

          <div className="brand-logo">
            R
          </div>

          <div>
            <h2>ResumePilot</h2>
            <span>AI Resume Assistant</span>
          </div>

        </div>

        <div className="online-status">
          <span></span>
          Online
        </div>

      </header>


      {/* Conversation */}

      <main className="messages-area">

        <div className="conversation">

          {messages.map((message, index) => (

            <div
              key={index}
              className={
                message.sender === "ai"
                  ? "message-row ai-row"
                  : "message-row user-row"
              }
            >

              {message.sender === "ai" && (
                <div className="message-avatar">
                  R
                </div>
              )}

              <div
                className={
                  message.sender === "ai"
                    ? "message ai-message"
                    : "message user-message"
                }
              >
                {message.text}
              </div>

            </div>

          ))}

        </div>

      </main>


      {/* Input */}

      <div className="chat-input-area">

        {currentQuestion < questions.length ? (

          <>

            <div className="chat-input-container">

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
              />

              <button
                type="button"
                onClick={sendMessage}
                className="send-button"
              >
                ➤
              </button>

            </div>

            <p className="chat-hint">
              Press Enter to send your answer.
            </p>

          </>

        ) : (

          <button
            className="generate-resume-button"
            onClick={() => {
              console.log("Collected Resume Data:", resumeData);
              alert("Next step: Resume Preview");
            }}
          >
            Generate My Resume →
          </button>

        )}

      </div>

    </div>
  );
}

export default TextChat;