import { useState, useEffect } from "react";
import { CustomButtonGreen } from "./CustomMUI";

export default function CaptchaGate({ children }) {
  const humanVarName = "h"

  const [errorMessage, setErrorMessage] = useState("");
  const [captchaConfig, setCaptchaConfig] = useState(null); // null = loading, {enabled: false} = disabled, {enabled: true, siteKey: "..."} = enabled

  const States = Object.freeze({
    LOADING: "loading",
    ERROR: "error",
    VERIFIED: "verified"
  });
  const [state, setState] = useState(
    localStorage.getItem(humanVarName) === "true" ? States.VERIFIED : States.LOADING
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
    if (state === States.VERIFIED) {
      setCaptchaConfig({ enabled: false });
      return;
    }

    const checkCaptchaConfig = async () => {
      try {
        const res = await fetch("/api/captcha-config");
        if (res.ok) {
          const config = await res.json();
          setCaptchaConfig(config);

          if (!config.enabled) {
            setState(States.VERIFIED);
            hideRecaptchaBadge();
            return;
          }

          showRecaptchaBadge();
          loadRecaptchaScript(config.siteKey);
        } else {
          setCaptchaConfig({ enabled: false });
          setState(States.VERIFIED);

          hideRecaptchaBadge();
        }
      } catch (err) {
        console.error("Error checking captcha config:", err);
        setCaptchaConfig({ enabled: false });
        setState(States.VERIFIED);
        hideRecaptchaBadge();
      }
    };

    checkCaptchaConfig();

    return () => {
      hideRecaptchaBadge();
    };
  }, []);

  const loadRecaptchaScript = (siteKey) => {
    if (window.grecaptcha) {
      executeRecaptcha(siteKey);
      return;
    }

    // Create and inject script tag
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      executeRecaptcha(siteKey);
    };
    script.onerror = () => {
      setErrorMessage("Failed to load reCAPTCHA script. Please refresh the page.");
      setState(States.ERROR);
    };
    document.head.appendChild(script);
  };

  // Execute reCAPTCHA verification
  const executeRecaptcha = (siteKey) => {
    if (!window.grecaptcha || !window.grecaptcha.ready) {
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
            setState(States.VERIFIED);
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

  // If captcha is disabled, render children immediately
  if (captchaConfig && !captchaConfig.enabled) {
    return children;
  }

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
