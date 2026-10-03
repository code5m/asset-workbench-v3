import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALES,
  ui,
  type Locale,
  type LStr,
} from './translations';

const STORAGE_KEY = 'aw3-locale';

interface I18nContextValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  /** Resolve a UI chrome string by key, falling back to the default locale. */
  t: (key: string) => string;
  /** Resolve a localized data string for the active locale. */
  loc: (value: LStr) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'en' || saved === 'zh-CN' ? (saved as Locale) : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Locale) => setLangState(next);

  const t = (key: string): string => ui[lang][key] ?? ui[DEFAULT_LOCALE][key] ?? key;

  const loc = (value: LStr): string => value[lang] ?? value[DEFAULT_LOCALE];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loc }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

export function LocaleSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('language')}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={`lang-option ${lang === locale ? 'selected' : ''}`}
          aria-pressed={lang === locale}
          onClick={() => setLang(locale)}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
