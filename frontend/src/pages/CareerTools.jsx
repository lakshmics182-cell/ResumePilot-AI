const TOOLS = [
  {
    page: "cover-letter",
    icon: "✉️",
    title: "Cover Letter Generator",
    text: "Write a tailored cover letter from your resume and a job description. Edit it, copy it, or download it as a PDF.",
    action: "Write my cover letter →",
  },
  {
    page: "linkedin",
    icon: "💼",
    title: "LinkedIn Optimisation",
    text: "Get headline options, an About section, the skills to list and a profile checklist for the role you want.",
    action: "Optimise my profile →",
  },
  {
    page: "mock-interview",
    icon: "🎤",
    title: "Mock Interviews & Feedback",
    text: "Practise with questions tailored to your role and resume, then get a score and feedback on every answer.",
    action: "Start practising →",
  },
  {
    page: "portfolio",
    icon: "🌐",
    title: "Portfolio Builder",
    text: "Turn your resume into a personal portfolio website. Choose a theme, edit it live, then download or publish it.",
    action: "Build my portfolio →",
  },
];

function CareerTools({ onBack, onOpen }) {
  return (
    <div className="tool-page">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <div className="tool-header">
        <h1>Career Tools</h1>
        <p>
          Everything you need after the resume: apply, get found,
          practise and show your work.
        </p>
      </div>

      <div className="tool-card-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.page}
            type="button"
            className="tool-card"
            onClick={() => onOpen(tool.page)}
          >
            <span className="tool-card-icon">{tool.icon}</span>
            <strong>{tool.title}</strong>
            <span className="tool-card-text">{tool.text}</span>
            <span className="tool-card-action">{tool.action}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CareerTools;
