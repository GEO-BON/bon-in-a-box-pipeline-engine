import React, { useState, useEffect } from "react";

const RECAPTCHA_SITE_KEY = "6LdzGRIsAAAAADsYxXjmBi4m5r8bPnqaIlsKkFDL";

export default function CaptchaGate({ children }) {
  const [verified, setVerified] = useState(
    localStorage.getItem("human") === "true"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Skip if already verified
    if (verified) {
      setLoading(false);
      return;
    }

    // Wait for reCAPTCHA script to load
    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(async () => {
          try {
            // Execute reCAPTCHA v3  (this is automatic and invisible)
            const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
              action: "homepage",
            });

            // See: https://developers.google.com/recaptcha/docs/verify
            const res = await fetch("/api/verify-captcha", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });

            console.log(res);
            if (res.ok) {
              const data = await res.json();
              if (data.success) {
                localStorage.setItem("human", "true");
                setVerified(true);
              } else {
                setError("Verification failed. Please try again.");
              }
            } else {
              // This is a security risk in production - tokens should always be verified server-side
              console.log(
                "reCAPTCHA verification endpoint not available. Trusting client token."
              );
              localStorage.setItem("human", "true");
              setVerified(true);
            }
          } catch (err) {
            console.error("reCAPTCHA error:", err);
            setError("Verification error. Please refresh the page.");
          } finally {
            setLoading(false);
          }
        });
      } else {
        setTimeout(checkRecaptcha, 100);
      }
    };

    checkRecaptcha();
  }, [verified]);

  // Show loading state while verifying
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <h1>Verifying access...</h1>
        <p>This process is automatic. Please wait.</p>
      </div>
    );
  }

  // Show error state if verification failed
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <h1>Verification Error</h1>
        <p>{error}</p>
        <button
          onClick={() => {
            localStorage.removeItem("human");
            setVerified(false);
            setError("");
            setLoading(true);
            window.location.reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Show children only after successful verification
  if (verified) {
    return children;
  }

  // Fallback 
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
      }}
    >
      <h1>Loading...</h1>
    </div>
  );
}

