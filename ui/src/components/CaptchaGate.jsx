import { useState, useEffect } from "react";
import { CustomButtonGreen } from "./CustomMUI";

const RECAPTCHA_SITE_KEY = "6LdzGRIsAAAAADsYxXjmBi4m5r8bPnqaIlsKkFDL";

export default function CaptchaGate({ children }) {

  const [errorMessage, setErrorMessage] = useState("");

  const States = Object.freeze({
    LOADING: "loading",
    ERROR: "error",
    VERIFIED: "verified"
  });
  const [state, setState] = useState(
    localStorage.getItem("human") === "true" ? States.VERIFIED : States.LOADING
  );

  useEffect(() => {
    // Skip if already verified
    if (state === States.VERIFIED) {
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
                setState(States.VERIFIED);
                return;

              } else {
                setErrorMessage("Verification failed. Are you a robot? Please try again.");
              }
            } else {
              setErrorMessage("Verification failed: reCAPTCHA verification endpoint not available.");
            }
          } catch (err) {
            console.error("reCAPTCHA error:", err);
            setErrorMessage("Verification error. Please refresh the page.");
          }

          setState(States.ERROR)
        });
      } else {
        setTimeout(checkRecaptcha, 100);
      }
    };

    checkRecaptcha();
  }, [state, setState, setErrorMessage]);


  switch (state) {
    case States.LOADING:
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            color: "whitesmoke"
          }}
        >
          <h1>Verifying access...</h1>
          <p>This process is automatic. Please wait.</p>
        </div>
      );

    case States.VERIFIED:
      return children; // Show children only after successful verification

    case States.ERROR:
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            color: "whitesmoke"
          }}
        >
          <h1>Verification Error</h1>
          <p>{errorMessage}</p>
          <CustomButtonGreen
            onClick={() => {
              setState(States.LOADING)
              setErrorMessage("");
              window.location.reload();
            }}
          >
            Retry
          </CustomButtonGreen>
        </div>
      );
  }
}

