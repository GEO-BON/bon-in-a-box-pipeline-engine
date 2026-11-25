import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { changePreference, getPreference } from "../i18n";
import { DEFAULT_LANGUAGE, LANGUAGES, isSupportedLanguage } from "../languages";
import languageIcon from "../img/fa-language.svg";

function LanguageIcon() {
  return <img className="language-icon" src={languageIcon} alt="" aria-hidden="true" />;
}

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [initial] = useState(getPreference);
  const [storageError, setStorageError] = useState(initial.error);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  const currentLanguageCode = isSupportedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
  const currentLanguageDef = LANGUAGES.find(({ code }) => code === currentLanguageCode);

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
    <>
      <button
        ref={buttonRef}
        type="button"
        className="navbar-profile-popup-option language-button"
        aria-label={t("language.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LanguageIcon />
        {currentLanguageDef.label}
        {open
          ? <ArrowUpIcon className="language-expand-icon" aria-hidden="true" />
          : <ArrowDownIcon className="language-expand-icon" aria-hidden="true" />}
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
              <span>{language.label}</span>
            </li>
          ))}
        </ul>
      )}
      {storageError && (
        <span role="alert" className="language-storage-error">
          {t("language.storageError")}
        </span>
      )}
    </>
  );
}
