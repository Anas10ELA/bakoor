import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Languages,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { BakoorLogo, BakoorMark } from "@/components/BakoorLogo";
import { t } from "@/lib/i18n";

const modeKeys = {
  login: ["loginTitle", "loginSubtitle", "loginSubmit"],
  register: ["registerTitle", "registerSubtitle", "registerSubmit"],
  verify: ["verifyTitle", "verifySubtitle", "verifySubmit"],
  reset: ["resetTitle", "resetSubtitle", "resetSubmit"],
};

function authErrorMessage(error, language) {
  if (error?.status === 401) return t(language, "auth401");
  if (error?.status === 403) return t(language, "auth403");
  if (error?.status === 429) return t(language, "auth429");
  if (error?.status === 422) return t(language, "auth422");
  return error?.message || t(language, "authGeneric");
}

export default function AuthScreen({ language, onLanguageChange, onAuthenticated, onDemo }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isArabic = language === "ar";
  const [titleKey, subtitleKey, submitKey] = modeKeys[mode];
  const SubmitArrow = isArabic ? ArrowLeft : ArrowRight;

  const changeMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (mode === "register") {
        await base44.auth.register({ email, password });
        setMode("verify");
        setNotice(t(language, "verificationNotice"));
      } else if (mode === "verify") {
        await base44.auth.verifyOtp({ email, otpCode: otp });
        const response = await base44.auth.loginViaEmailPassword(email, password);
        if (name.trim()) await base44.auth.updateMe({ full_name: name.trim() });
        onAuthenticated({ ...response.user, full_name: name.trim() || response.user.full_name });
      } else if (mode === "reset") {
        await base44.auth.resetPasswordRequest(email);
        setNotice(t(language, "resetNotice"));
      } else {
        const response = await base44.auth.loginViaEmailPassword(email, password);
        onAuthenticated(response.user);
      }
    } catch (requestError) {
      setError(authErrorMessage(requestError, language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page" dir={isArabic ? "rtl" : "ltr"}>
      <button
        className="auth-language-toggle"
        type="button"
        onClick={() => onLanguageChange(isArabic ? "en" : "ar")}
        aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      >
        <Languages size={17} /> {isArabic ? "EN" : "ع"}
      </button>

      <section className="auth-brand-panel">
        <BakoorLogo language={language} />
        <div className="auth-brand-content">
          <span className="eyebrow">{t(language, "authEyebrow")}</span>
          <h1>{t(language, "authHero")}</h1>
          <p>{t(language, "authDescription")}</p>
          <div className="auth-proof-list">
            <span><ShieldCheck size={18} /> {t(language, "privateData")}</span>
            <span><Sparkles size={18} /> {t(language, "smartSuggestions")}</span>
            <span><CheckCircle2 size={18} /> {t(language, "deepWork")}</span>
          </div>
        </div>
        <div className="auth-day-rhythm" aria-hidden="true">
          {["prayerFajr", "prayerDhuhr", "prayerAsr", "prayerMaghrib", "prayerIsha"].map((key, index) => (
            <div key={key} className={index === 0 ? "active" : ""}>
              <span />
              <small>{t(language, key)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-logo"><BakoorMark className="brand-mark" /></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <header>
            <span className="eyebrow">{t(language, "withYou")}</span>
            <h2>{t(language, titleKey)}</h2>
            <p>{t(language, subtitleKey)}</p>
          </header>

          {mode === "register" && (
            <label className="field-label">
              {t(language, "yourName")}
              <div className="input-shell">
                <Sparkles size={18} />
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, "namePlaceholder")} required />
              </div>
            </label>
          )}

          <label className="field-label">
            {t(language, "email")}
            <div className="input-shell" dir="ltr">
              <Mail size={18} />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
            </div>
          </label>

          {mode !== "reset" && mode !== "verify" && (
            <label className="field-label">
              {t(language, "password")}
              <div className="input-shell" dir="ltr">
                <LockKeyhole size={18} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t(language, "passwordPlaceholder")} required />
                <button className="icon-button subtle" type="button" onClick={() => setShowPassword((value) => !value)} title={t(language, showPassword ? "hidePassword" : "showPassword")}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === "verify" && (
            <label className="field-label">
              {t(language, "verificationCode")}
              <div className="input-shell otp-shell" dir="ltr">
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="000000" required />
              </div>
            </label>
          )}

          {mode === "login" && (
            <button type="button" className="text-button form-link" onClick={() => changeMode("reset")}>{t(language, "forgotPassword")}</button>
          )}

          {error && <div className="form-message error" role="alert">{error}</div>}
          {notice && <div className="form-message success" role="status">{notice}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <SubmitArrow size={18} />}
            {t(language, submitKey)}
          </button>

          {mode === "login" && (
            <button type="button" className="secondary-button" onClick={() => base44.auth.loginWithProvider("google", window.location.href)}>
              {t(language, "googleLogin")}
            </button>
          )}

          <div className="auth-switch">
            {mode === "login" ? (
              <>{t(language, "noAccount")} <button type="button" onClick={() => changeMode("register")}>{t(language, "createAccount")}</button></>
            ) : mode === "register" ? (
              <>{t(language, "haveAccount")} <button type="button" onClick={() => changeMode("login")}>{t(language, "signIn")}</button></>
            ) : (
              <button type="button" onClick={() => changeMode("login")}>{t(language, "backToLogin")}</button>
            )}
          </div>

          <div className="demo-divider"><span>{t(language, "or")}</span></div>
          <button type="button" className="demo-button" onClick={onDemo}>{t(language, "exploreDemo")}</button>
        </form>
      </section>
    </main>
  );
}
