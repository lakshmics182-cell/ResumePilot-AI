import { API_BASE } from "../config";
import { useState } from "react";

const AUTH_BASE = `${API_BASE}/auth`;

function Login({ onLogin, notice }) {

  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = isRegister
        ? `${AUTH_BASE}/register`
        : `${AUTH_BASE}/login`;

      const body = isRegister
        ? { name, email, password }
        : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Something went wrong. Please try again."
        );
      }

      localStorage.setItem(
        "resumepilot_token",
        data.token
      );
      localStorage.setItem(
        "resumepilot_user",
        JSON.stringify(data.user)
      );

      onLogin(data.user, data.token);
    } catch (err) {
      console.error("Auth error:", err);

      setError(
        err.message ||
          "Unable to reach the server. Please check that the backend is running."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo">
          R
        </div>

        <h1>
          {isRegister
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p className="auth-subtitle">
          {isRegister
            ? "Create an account to start building your resume."
            : "Login to continue with ResumePilot."}
        </p>

        <form onSubmit={handleSubmit}>

          {isRegister && (
            <div className="form-group">

              <label>
                Full Name
              </label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
              />

            </div>
          )}

          <div className="form-group">

            <label>
              Email
            </label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

          </div>

          <div className="form-group">

            <label>
              Password
            </label>

            <div className="password-field">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                minLength={6}
                required
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                tabIndex={-1}
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          {notice && !error && (
            <div className="auth-error">
              ⚠️ {notice}
            </div>
          )}

          {error && (
            <div className="auth-error">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Please wait..."
              : isRegister
              ? "Create Account"
              : "Login"}
          </button>

        </form>

        <p className="switch-auth">

          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister
              ? " Login"
              : " Register"}
          </button>

        </p>

        <button
          className="back-button"
          onClick={() => window.location.reload()}
        >
          ← Back to Home
        </button>

      </div>

    </div>
  );
}

export default Login;
