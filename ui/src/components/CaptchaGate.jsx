import { useState, useEffect } from "react";
import { CustomButtonGreen } from "./CustomMUI";

function recaptchaReady() {
  return window.grecaptcha && window.grecaptcha.ready
}

const humanVarName = "h"
const clientKeyVarName = "ck"
const expiryVarName = "exp"
const expiryDelay = 12 * 60 * 60 * 1000 // 12 hours

export default function CaptchaGate({ children }) {

  const [errorMessage, setErrorMessage] = useState("");
  const [clientKey, setClientKey] = useState(
    localStorage.getItem(clientKeyVarName)
  );

  const States = Object.freeze({
    LOADING: "loading",
    ERROR: "error",
    SHOW_CONTENT: "verifiedOrDisabled"
  });
  const [state, setState] = useState(
    localStorage.getItem(humanVarName) === "true" && Date.now() < JSON.parse(localStorage.getItem(expiryVarName)) ?
      States.SHOW_CONTENT : States.LOADING
  );

  const showRecaptchaBadge = () => {
    const badge = document.querySelector(".grecaptcha-badge");
    if (badge) badge.style.visibility = "visible";
  };

  const hideRecaptchaBadge = () => {
    const badge = document.querySelector(".grecaptcha-badge");
    if (badge) badge.style.visibility = "hidden";
  };

  useEffect(() => {
    return () => {
      hideRecaptchaBadge() // when leaving the page (the captcha protects only this page)
    }
  }, [])

  // Load captcha config from server
  useEffect(() => {
    if (state === States.SHOW_CONTENT) {
      return;
    }

    const checkCaptchaConfig = async () => {
      try {
        const res = await fetch("/api/captcha-config");
        if (res.ok) {
          const config = await res.json();
          if (config.enabled) {
            localStorage.setItem(clientKeyVarName, config.siteKey);
            setClientKey(config.siteKey)
            return;
          }
        }
      } catch (err) {
        console.error("Error checking captcha config:", err);
      }

      // Captcha disabled, or something went wrong, show contents
      setState(States.SHOW_CONTENT);
    };

    checkCaptchaConfig();
  }, []);

  // Create and inject script tag, once client key obtrained.
  useEffect(() => {
    if(!clientKey)
      return

    if(recaptchaReady()) {
      executeRecaptcha(clientKey);
      return
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${clientKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      executeRecaptcha(clientKey);
    };
    script.onerror = () => {
      setErrorMessage("Failed to load reCAPTCHA script. Please refresh the page.");
      setState(States.ERROR);
    };
    document.head.appendChild(script);
  }, [clientKey]);

  // Execute reCAPTCHA verification
  const executeRecaptcha = (siteKey) => {
    showRecaptchaBadge();
    if (state === States.SHOW_CONTENT) {
      return;
    }

    if (!recaptchaReady()) {
      setTimeout(() => executeRecaptcha(siteKey), 100);
      return;
    }

    window.grecaptcha.ready(async () => {
      try {
        // Execute recaptcha v3
        const token = await window.grecaptcha.execute(siteKey, {
          action: "run",
        });

        // Verify token with backend
        const res = await fetch("/api/verify-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            localStorage.setItem(humanVarName, "true");
            localStorage.setItem(expiryVarName, Date.now() + expiryDelay);

            setState(States.SHOW_CONTENT);
            return;

          } else {
            setErrorMessage("Verification failed. Are you a robot? Please try again.");
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          setErrorMessage(errorData.error || "Verification failed: reCAPTCHA verification endpoint not available.");
        }
      } catch (err) {
        console.error("reCAPTCHA error:", err);
        setErrorMessage("Verification error. Please refresh the page.");
      }

      setState(States.ERROR);
    });
  };

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

    case States.SHOW_CONTENT:
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
              setState(States.LOADING);
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
