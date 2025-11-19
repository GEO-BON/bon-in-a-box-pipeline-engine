import React, { useState, useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";

export default function CaptchaGate({ children }) {
  const [verified, setVerified] = useState(
    localStorage.getItem("human") === "true"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCaptcha = async (token) => {
    setLoading(true);
    try {
      const res = await fetch("/api/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("human", "true");
        setVerified(true);
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (verified) return children;

  return (
    <div>
      <div>
        <h1>Checking your browser before accessing...</h1>
        <p>This process is automatic. Please click below to prove you’re human.</p>
        <ReCAPTCHA
          sitekey="YOUR_PUBLIC_SITE_KEY"
          onChange={handleCaptcha}
        />
        {loading && <p>Verifying...</p>}
        {error && <p>{error}</p>}
      </div>
    </div>
  );
}

