import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { changePreference, getPreference } from "../i18n";

import { DEFAULT_LANGUAGE, LANGUAGES, isSupportedLanguage } from "../languages";

function Flag({ language }) {
  return <img className="language-flag" src={language.flag} alt="" aria-hidden="true" />;
}

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [initial] = useState(getPreference);
  const [storageError, setStorageError] = useState(initial.error);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  const currentLanguageCode = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
  const currentLanguageDef = LANGUAGES.find(({ code }) => code === currentLanguageCode);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const choose = (value) => {
    const result = changePreference(value);
    setStorageError(result.error);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKeyDown = (event) => {
    const items = [...event.currentTarget.querySelectorAll("[role=option]")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") items[(index + 1) % items.length].focus();
    else if (event.key === "ArrowUp") items[(index - 1 + items.length) % items.length].focus();
    else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else return;
    event.preventDefault();
  };

  return (
    <div className="language-selector" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="language-button"
        aria-label={t("language.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag language={currentLanguageDef} />
        <span className="language-triangle" aria-hidden="true">▼</span>
      </button>
      {open && (
        <ul
          className="language-list"
          role="listbox"
          aria-label={t("language.label")}
          onKeyDown={onListKeyDown}
        >
          {LANGUAGES.map((language) => (
            <li
              key={language.code}
              role="option"
              tabIndex={-1}
              ref={(node) => language.code === currentLanguageCode && node?.focus()}
              className="language-option"
              aria-selected={language.code === currentLanguageCode}
              onClick={() => choose(language.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(language.code);
                }
              }}
            >
              <Flag language={language} />
              {language.label}
            </li>
          ))}
        </ul>
      )}
      {storageError && (
        <span role="alert" className="language-storage-error">
          {t("language.storageError")}
        </span>
      )}
    </div>
  );
}
