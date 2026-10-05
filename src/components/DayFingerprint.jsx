import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Coffee,
  GraduationCap,
  Home,
  Loader2,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Utensils,
  Zap,
} from "lucide-react";
import { timeToMinutes } from "@/lib/dayPath";
import { t } from "@/lib/i18n";

const DEFAULT_PROFILE = {
  city: "Cairo",
  country: "Egypt",
  timezone: "Africa/Cairo",
  calculation_method: 5,
  day_start_time: "04:00",
  day_end_time: "23:00",
  commitment_type: "none",
  commitment_start_time: "08:00",
  commitment_end_time: "15:00",
  commute_minutes: 0,
  reserve_breakfast: false,
  breakfast_time: "07:00",
  breakfast_duration_minutes: 30,
  reserve_lunch: false,
  lunch_time: "14:30",
  lunch_duration_minutes: 30,
  reserve_dinner: false,
  dinner_time: "20:30",
  dinner_duration_minutes: 30,
  reserve_family_time: false,
  family_time: "19:00",
  family_duration_minutes: 60,
  peak_energy_anchor: "after_fajr",
  low_energy_anchor: "after_isha",
  planning_style: "balanced",
  target_buffer_minutes: 90,
  deep_work_session_minutes: 90,
};

const COMMITMENTS = [
  { value: "none", icon: Home },
  { value: "work", icon: BriefcaseBusiness },
  { value: "study", icon: GraduationCap },
  { value: "mixed", icon: CalendarClock },
];

const PEAK_ANCHORS = ["after_fajr", "morning", "after_dhuhr", "after_asr", "after_isha"];
const LOW_ANCHORS = ["after_dhuhr", "after_asr", "evening", "after_isha"];
const PLAN_STYLES = ["gentle", "balanced", "ambitious"];
const MINUTE_OPTIONS = [15, 20, 30, 45, 60, 90];

function minutesBetween(start, end) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function ChoiceGroup({ label, value, options, language, labelPrefix, onChange, icons = {} }) {
  return (
    <fieldset className="fingerprint-choice-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const Icon = typeof option === "string" ? icons[optionValue] : option.icon;
          return (
            <button
              type="button"
              key={optionValue}
              className={value === optionValue ? "active" : ""}
              aria-pressed={value === optionValue}
              onClick={() => onChange(optionValue)}
            >
              {Icon && <Icon size={17} />}
              <span>{t(language, `${labelPrefix}_${optionValue}`)}</span>
              {value === optionValue && <Check size={14} />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ReservationRow({ icon: Icon, title, enabled, time, duration, language, onToggle, onTime, onDuration }) {
  return (
    <div className={`fingerprint-reservation ${enabled ? "active" : ""}`}>
      <label className="fingerprint-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
        <span aria-hidden="true" />
        <Icon size={17} />
        <strong>{title}</strong>
      </label>
      <label className="planner-field">
        <span>{t(language, "fingerprintTime")}</span>
        <input type="time" value={time} disabled={!enabled} onChange={(event) => onTime(event.target.value)} />
      </label>
      <label className="planner-field">
        <span>{t(language, "fingerprintDuration")}</span>
        <select value={duration} disabled={!enabled} onChange={(event) => onDuration(Number(event.target.value))}>
          {MINUTE_OPTIONS.map((minutes) => <option value={minutes} key={minutes}>{t(language, "minutes", { value: minutes })}</option>)}
        </select>
      </label>
    </div>
  );
}

export default function DayFingerprint({ preference, language, prayerTimes = {}, onSave, onOpenPlanner }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({ ...DEFAULT_PROFILE, ...(preference || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isArabic = language === "ar";
  const NextIcon = isArabic ? ArrowLeft : ArrowRight;
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const dayMinutes = minutesBetween(form.day_start_time, form.day_end_time);
  const fixedMinutes = useMemo(() => {
    const commitment = form.commitment_type === "none" ? 0 : minutesBetween(form.commitment_start_time, form.commitment_end_time);
    const commute = form.commitment_type === "none" ? 0 : Number(form.commute_minutes || 0) * 2;
    const meals = ["breakfast", "lunch", "dinner"].reduce(
      (sum, meal) => sum + (form[`reserve_${meal}`] ? Number(form[`${meal}_duration_minutes`] || 0) : 0),
      0
    );
    return commitment + commute + meals + (form.reserve_family_time ? Number(form.family_duration_minutes || 0) : 0);
  }, [form]);
  const flexibleMinutes = Math.max(0, dayMinutes - fixedMinutes - Number(form.target_buffer_minutes || 0));

  const validateStep = () => {
    if (step === 1 && (!form.city.trim() || !form.country.trim() || dayMinutes < 180)) return "fingerprintRhythmError";
    if (step === 2 && form.commitment_type !== "none" && minutesBetween(form.commitment_start_time, form.commitment_end_time) < 30) return "fingerprintCommitmentError";
    return "";
  };

  const goNext = () => {
    const issue = validateStep();
    if (issue) {
      setError(t(language, issue));
      return;
    }
    setError("");
    setStep((current) => Math.min(4, current + 1));
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const profileValues = Object.fromEntries(
        Object.keys(DEFAULT_PROFILE).map((key) => [key, form[key]])
      );
      await onSave({
        ...profileValues,
        sleep_start_time: form.day_end_time,
        language,
        onboarding_complete: true,
        profile_version: 1,
      });
    } catch {
      setError(t(language, "fingerprintSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="planner-main fingerprint-main">
      <section className="fingerprint-intro">
        <div>
          <span className="section-kicker">{t(language, "fingerprintKicker")}</span>
          <h1>{t(language, "fingerprintTitle")}</h1>
          <p>{t(language, "fingerprintDescription")}</p>
        </div>
        {preference?.onboarding_complete && (
          <button className="planner-secondary" type="button" onClick={onOpenPlanner}>
            <CalendarClock size={18} />{t(language, "openDayPath")}
          </button>
        )}
      </section>

      <div className="fingerprint-layout">
        <section className="fingerprint-builder" aria-labelledby="fingerprint-step-title">
          <header className="fingerprint-progress">
            {[1, 2, 3, 4].map((number) => (
              <button type="button" key={number} className={number === step ? "active" : number < step ? "complete" : ""} onClick={() => number < step && setStep(number)}>
                <span>{number < step ? <Check size={13} /> : number}</span>
                <strong>{t(language, `fingerprintStep_${number}`)}</strong>
              </button>
            ))}
          </header>

          <div className="fingerprint-form">
            {step === 1 && (
              <section className="fingerprint-step">
                <header><span><MapPin size={18} /></span><div><h2 id="fingerprint-step-title">{t(language, "fingerprintRhythmTitle")}</h2><p>{t(language, "fingerprintRhythmDescription")}</p></div></header>
                <div className="fingerprint-field-grid">
                  <label className="planner-field"><span>{t(language, "fingerprintCity")}</span><input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
                  <label className="planner-field"><span>{t(language, "fingerprintCountry")}</span><input value={form.country} onChange={(event) => update("country", event.target.value)} /></label>
                  <label className="planner-field"><span>{t(language, "fingerprintDayStart")}</span><input type="time" value={form.day_start_time} onChange={(event) => update("day_start_time", event.target.value)} /></label>
                  <label className="planner-field"><span>{t(language, "fingerprintDayEnd")}</span><input type="time" value={form.day_end_time} onChange={(event) => update("day_end_time", event.target.value)} /></label>
                </div>
                <div className="fingerprint-prayer-note"><ShieldCheck size={18} /><span><strong>{t(language, "fingerprintPrayerAnchor")}</strong><small>{t(language, "fingerprintFajrPreview", { time: prayerTimes.Fajr || "--:--" })}</small></span></div>
              </section>
            )}

            {step === 2 && (
              <section className="fingerprint-step">
                <header><span><CalendarClock size={18} /></span><div><h2 id="fingerprint-step-title">{t(language, "fingerprintCommitmentsTitle")}</h2><p>{t(language, "fingerprintCommitmentsDescription")}</p></div></header>
                <ChoiceGroup label={t(language, "fingerprintMainCommitment")} value={form.commitment_type} options={COMMITMENTS} language={language} labelPrefix="commitment" onChange={(value) => update("commitment_type", value)} />
                {form.commitment_type !== "none" && (
                  <div className="fingerprint-commitment-times">
                    <label className="planner-field"><span>{t(language, "from")}</span><input type="time" value={form.commitment_start_time} onChange={(event) => update("commitment_start_time", event.target.value)} /></label>
                    <label className="planner-field"><span>{t(language, "to")}</span><input type="time" value={form.commitment_end_time} onChange={(event) => update("commitment_end_time", event.target.value)} /></label>
                    <label className="planner-field"><span>{t(language, "fingerprintCommute")}</span><select value={form.commute_minutes} onChange={(event) => update("commute_minutes", Number(event.target.value))}>{[0, 15, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes ? t(language, "minutes", { value: minutes }) : t(language, "fingerprintNoCommute")}</option>)}</select></label>
                  </div>
                )}
                <div className="fingerprint-reservations">
                  <ReservationRow icon={Coffee} title={t(language, "fingerprintBreakfast")} enabled={form.reserve_breakfast} time={form.breakfast_time} duration={form.breakfast_duration_minutes} language={language} onToggle={(value) => update("reserve_breakfast", value)} onTime={(value) => update("breakfast_time", value)} onDuration={(value) => update("breakfast_duration_minutes", value)} />
                  <ReservationRow icon={Utensils} title={t(language, "fingerprintLunch")} enabled={form.reserve_lunch} time={form.lunch_time} duration={form.lunch_duration_minutes} language={language} onToggle={(value) => update("reserve_lunch", value)} onTime={(value) => update("lunch_time", value)} onDuration={(value) => update("lunch_duration_minutes", value)} />
                  <ReservationRow icon={Utensils} title={t(language, "fingerprintDinner")} enabled={form.reserve_dinner} time={form.dinner_time} duration={form.dinner_duration_minutes} language={language} onToggle={(value) => update("reserve_dinner", value)} onTime={(value) => update("dinner_time", value)} onDuration={(value) => update("dinner_duration_minutes", value)} />
                  <ReservationRow icon={Home} title={t(language, "fingerprintFamily")} enabled={form.reserve_family_time} time={form.family_time} duration={form.family_duration_minutes} language={language} onToggle={(value) => update("reserve_family_time", value)} onTime={(value) => update("family_time", value)} onDuration={(value) => update("family_duration_minutes", value)} />
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="fingerprint-step">
                <header><span><Zap size={18} /></span><div><h2 id="fingerprint-step-title">{t(language, "fingerprintEnergyTitle")}</h2><p>{t(language, "fingerprintEnergyDescription")}</p></div></header>
                <ChoiceGroup label={t(language, "fingerprintPeakQuestion")} value={form.peak_energy_anchor} options={PEAK_ANCHORS} language={language} labelPrefix="energyAnchor" onChange={(value) => update("peak_energy_anchor", value)} />
                <ChoiceGroup label={t(language, "fingerprintLowQuestion")} value={form.low_energy_anchor} options={LOW_ANCHORS} language={language} labelPrefix="energyAnchor" onChange={(value) => update("low_energy_anchor", value)} />
                <fieldset className="fingerprint-choice-group compact">
                  <legend>{t(language, "fingerprintDeepSession")}</legend>
                  <div>{[45, 60, 90, 120].map((minutes) => <button type="button" key={minutes} className={Number(form.deep_work_session_minutes) === minutes ? "active" : ""} aria-pressed={Number(form.deep_work_session_minutes) === minutes} onClick={() => update("deep_work_session_minutes", minutes)}><Target size={16} /><span>{t(language, "minutes", { value: minutes })}</span>{Number(form.deep_work_session_minutes) === minutes && <Check size={14} />}</button>)}</div>
                </fieldset>
              </section>
            )}

            {step === 4 && (
              <section className="fingerprint-step">
                <header><span><Sparkles size={18} /></span><div><h2 id="fingerprint-step-title">{t(language, "fingerprintStyleTitle")}</h2><p>{t(language, "fingerprintStyleDescription")}</p></div></header>
                <ChoiceGroup label={t(language, "fingerprintStyleQuestion")} value={form.planning_style} options={PLAN_STYLES} language={language} labelPrefix="planningStyle" onChange={(value) => update("planning_style", value)} />
                <fieldset className="fingerprint-choice-group compact">
                  <legend>{t(language, "fingerprintBufferQuestion")}</legend>
                  <div>{[30, 60, 90, 120].map((minutes) => <button type="button" key={minutes} className={Number(form.target_buffer_minutes) === minutes ? "active" : ""} aria-pressed={Number(form.target_buffer_minutes) === minutes} onClick={() => update("target_buffer_minutes", minutes)}><TimerReset size={16} /><span>{t(language, "minutes", { value: minutes })}</span>{Number(form.target_buffer_minutes) === minutes && <Check size={14} />}</button>)}</div>
                </fieldset>
                <div className="fingerprint-ready"><ShieldCheck size={22} /><span><strong>{t(language, "fingerprintReadyTitle")}</strong><small>{t(language, "fingerprintReadyDescription")}</small></span></div>
              </section>
            )}

            {error && <p className="habit-form-error fingerprint-error" role="alert">{error}</p>}
            <footer className="fingerprint-actions">
              {step > 1 ? <button className="planner-secondary" type="button" onClick={() => { setError(""); setStep((current) => current - 1); }}><BackIcon size={17} />{t(language, "back")}</button> : <span />}
              {step < 4 ? <button className="planner-primary" type="button" onClick={goNext}>{t(language, "fingerprintContinue")}<NextIcon size={17} /></button> : <button className="planner-primary" type="button" disabled={saving} onClick={submit}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{t(language, preference?.onboarding_complete ? "fingerprintUpdate" : "fingerprintSave")}</button>}
            </footer>
          </div>
        </section>

        <aside className="fingerprint-preview" aria-label={t(language, "fingerprintPreview") }>
          <header><span><Navigation size={18} /></span><div><small>{t(language, "fingerprintPreview")}</small><strong>{t(language, "fingerprintPreviewTitle")}</strong></div></header>
          <div className="fingerprint-day-span">
            <time>{form.day_start_time}</time><span><i style={{ width: `${Math.min(100, Math.max(8, dayMinutes / 14.4))}%` }} /></span><time>{form.day_end_time}</time>
          </div>
          <dl>
            <div><dt>{t(language, "fingerprintPeakLabel")}</dt><dd><Zap size={14} />{t(language, `energyAnchor_${form.peak_energy_anchor}`)}</dd></div>
            <div><dt>{t(language, "fingerprintCommitmentLabel")}</dt><dd><CalendarClock size={14} />{t(language, `commitment_${form.commitment_type}`)}</dd></div>
            <div><dt>{t(language, "fingerprintStyleLabel")}</dt><dd><Sparkles size={14} />{t(language, `planningStyle_${form.planning_style}`)}</dd></div>
          </dl>
          <div className="fingerprint-capacity">
            <span><small>{t(language, "fingerprintFixedTime")}</small><strong>{Math.round(fixedMinutes / 30) / 2} {t(language, "fingerprintHoursShort")}</strong></span>
            <span><small>{t(language, "fingerprintFlexibleTime")}</small><strong>{Math.round(flexibleMinutes / 30) / 2} {t(language, "fingerprintHoursShort")}</strong></span>
          </div>
          <p><ShieldCheck size={15} />{t(language, "fingerprintPreviewNote")}</p>
        </aside>
      </div>
    </main>
  );
}
