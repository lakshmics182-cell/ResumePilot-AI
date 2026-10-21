function ConversationMode({ onSpeak, onType }) {

  return (
    <div className="mode-page">

      {/* LOGO */}

      <div className="mode-logo">
        R
      </div>

      <h1>
        How would you like to create your resume?
      </h1>

      <p className="mode-subtitle">
        Choose your preferred way to provide
        your information to ResumePilot.
      </p>


      {/* OPTIONS */}

      <div className="mode-container">

        {/* SPEAK */}

        <button
          type="button"
          className="mode-card"
          onClick={onSpeak}
        >

          <div className="mode-icon">
            🎙️
          </div>

          <h2>
            Speak
          </h2>

          <p>
            Talk with ResumePilot using your
            microphone and create your resume
            through voice.
          </p>

          <span className="mode-action">
            Use Voice →
          </span>

        </button>


        {/* TEXT */}

        <button
          type="button"
          className="mode-card"
          onClick={onType}
        >

          <div className="mode-icon">
            💬
          </div>

          <h2>
            Text
          </h2>

          <p>
            Answer ResumePilot's questions by
            typing your information step by step.
          </p>

          <span className="mode-action">
            Use Text →
          </span>

        </button>

      </div>

    </div>
  );
}

export default ConversationMode;