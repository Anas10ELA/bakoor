import { useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  CalendarCheck2,
  Check,
  CircleCheckBig,
  Dumbbell,
  Gauge,
  HeartHandshake,
  Loader2,
  Minimize2,
  MoonStar,
  Plus,
  Repeat2,
  Sparkles,
  Target,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { getLocalDate, habitBelongsToDate } from "@/lib/dayPath";
import { t } from "@/lib/i18n";

const CATEGORY_OPTIONS = [
  { value: "worship", icon: MoonStar },
  { value: "health", icon: Dumbbell },
  { value: "knowledge", icon: BookOpen },
  { value: "family", icon: HeartHandshake },
  { value: "personal", icon: Activity },
];

const UNIT_OPTIONS = ["minutes", "pages", "hizb", "repetitions", "kilometers"];
const ANCHOR_OPTIONS = ["flexible", "after_fajr", "morning", "after_dhuhr", "after_asr", "after_maghrib", "after_isha"];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const ENERGY_OPTIONS = ["low", "medium", "high"];

function dateFromOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return getLocalDate(date);
}

function formatHabitUnit(language, unit) {
  return t(language, `habitUnit_${unit}`);
}

function categoryIcon(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.icon || Activity;
}

function weeklyStats(habits, logs) {
  const dates = Array.from({ length: 7 }, (_, index) => dateFromOffset(index - 6));
  let expected = 0;
  habits.filter((habit) => habit.active !== false).forEach((habit) => {
    expected += dates.filter((date) => habitBelongsToDate(habit, date)).length;
  });
  const completed = new Set(
    logs
      .filter((log) => dates.includes(log.log_date) && Number(log.actual_amount) > 0)
      .map((log) => `${log.habit_id}:${log.log_date}`)
  ).size;
  return { completed, expected, rate: expected ? Math.round(completed / expected * 100) : 0, dates };
}

function HabitComposer({ language, onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState("minutes");
  const [duration, setDuration] = useState(30);
  const [minimumAmount, setMinimumAmount] = useState(5);
  const [minimumDuration, setMinimumDuration] = useState(5);
  const [energy, setEnergy] = useState("low");
  const [anchor, setAnchor] = useState("flexible");
  const [days, setDays] = useState(WEEKDAYS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleDay = (day) => {
    setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort());
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim() || Number(amount) <= 0 || !days.length) {
      setError(t(language, "habitFormError"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({
        title: title.trim(),
        category,
        amount: Number(amount),
        unit,
        duration_minutes: Number(duration),
        energy_required: energy,
        minimum_amount: Math.min(Number(amount), Math.max(1, Number(minimumAmount))),
        minimum_unit: unit,
        minimum_duration_minutes: Math.min(Number(duration), Math.max(5, Number(minimumDuration))),
        preferred_anchor: anchor,
        repeat_days: days,
        frequency_per_week: days.length,
        completed_today: false,
        completion_count: 0,
        active: true,
      });
      onClose();
    } catch {
      setError(t(language, "habitSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="habit-composer" aria-labelledby="habit-composer-title">
      <header>
        <div><span className="section-kicker">{t(language, "measurableHabit")}</span><h2 id="habit-composer-title">{t(language, "buildHabitTitle")}</h2></div>
        <button type="button" className="planner-icon-button" onClick={onClose} title={t(language, "close")}><X size={18} /></button>
      </header>
      <form onSubmit={submit}>
        <label className="planner-field habit-title-field">
          <span>{t(language, "habitName")}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t(language, "habitNamePlaceholder")} autoFocus />
        </label>

        <fieldset className="habit-category-fieldset">
          <legend>{t(language, "habitCategory")}</legend>
          <div>
            {CATEGORY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return <button key={option.value} type="button" className={category === option.value ? "active" : ""} aria-pressed={category === option.value} onClick={() => setCategory(option.value)}><Icon size={16} />{t(language, `habitCategory_${option.value}`)}</button>;
            })}
          </div>
        </fieldset>

        <div className="habit-measure-grid">
          <label className="planner-field">
            <span>{t(language, "habitTarget")}</span>
            <input type="number" min="1" max="1000" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="planner-field">
            <span>{t(language, "habitUnit")}</span>
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>{UNIT_OPTIONS.map((value) => <option value={value} key={value}>{formatHabitUnit(language, value)}</option>)}</select>
          </label>
          <label className="planner-field">
            <span>{t(language, "habitTimeNeeded")}</span>
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>{[5, 10, 15, 20, 30, 45, 60, 90, 120].map((value) => <option value={value} key={value}>{t(language, "minutes", { value })}</option>)}</select>
          </label>
        </div>

        <fieldset className="habit-energy-fieldset">
          <legend>{t(language, "habitEnergy")}</legend>
          <div>
            {ENERGY_OPTIONS.map((value) => (
              <button key={value} type="button" className={energy === value ? "active" : ""} aria-pressed={energy === value} onClick={() => setEnergy(value)}>
                <span>{[1, 2, 3].map((item) => <Zap size={14} key={item} className={item <= ENERGY_OPTIONS.indexOf(value) + 1 ? "on" : ""} />)}</span>{t(language, value)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="habit-rhythm-grid">
          <label className="planner-field">
            <span>{t(language, "habitAnchor")}</span>
            <select value={anchor} onChange={(event) => setAnchor(event.target.value)}>{ANCHOR_OPTIONS.map((value) => <option value={value} key={value}>{t(language, `habitAnchor_${value}`)}</option>)}</select>
          </label>
          <div className="habit-days-field">
            <span>{t(language, "repeatOn")}</span>
            <div>{WEEKDAYS.map((day) => <button key={day} type="button" className={days.includes(day) ? "active" : ""} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}>{t(language, `weekday_${day}`)}</button>)}</div>
          </div>
        </div>

        <div className="habit-minimum-band">
          <span className="habit-minimum-icon"><Minimize2 size={17} /></span>
          <div><strong>{t(language, "habitMinimumTitle")}</strong><small>{t(language, "habitMinimumDescription")}</small></div>
          <label className="planner-field"><span>{t(language, "habitMinimumAmount")}</span><input type="number" min="1" max={Math.max(1, Number(amount))} value={minimumAmount} onChange={(event) => setMinimumAmount(event.target.value)} /></label>
          <label className="planner-field"><span>{t(language, "habitMinimumTime")}</span><select value={minimumDuration} onChange={(event) => setMinimumDuration(event.target.value)}>{[5, 10, 15, 20, 30].map((value) => <option value={value} key={value}>{t(language, "minutes", { value })}</option>)}</select></label>
        </div>

        <div className="habit-preview">
          <Sparkles size={17} />
          <span><small>{t(language, "habitWillAppearAs")}</small><strong>{title.trim() || t(language, "habitPreviewFallback")} · {amount} {formatHabitUnit(language, unit)}</strong></span>
        </div>
        {error && <p className="habit-form-error" role="alert">{error}</p>}
        <button className="planner-primary habit-save-button" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}{t(language, "addHabit")}</button>
      </form>
    </section>
  );
}

export function HabitCheckInDialog({ habit, logDate = getLocalDate(), existingLog, defaultDuration, language, onClose, onSubmit }) {
  const [amount, setAmount] = useState(existingLog?.actual_amount ?? habit.amount ?? 1);
  const [duration, setDuration] = useState(existingLog?.actual_duration_minutes ?? defaultDuration ?? habit.duration_minutes ?? 20);
  const [note, setNote] = useState(existingLog?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const target = Number(habit.amount || 1);
  const minimum = Number(habit.minimum_amount || 1);
  const actual = Number(amount || 0);
  const status = actual >= target ? "full" : actual >= minimum ? "minimum" : "partial";

  const submit = async (event) => {
    event.preventDefault();
    if (actual <= 0) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        habit_id: habit.id,
        log_date: logDate,
        actual_amount: actual,
        actual_unit: habit.unit,
        actual_duration_minutes: Math.max(0, Number(duration || 0)),
        completed_target: actual >= target,
        used_minimum: actual < target && actual >= minimum,
        note: note.trim(),
      });
      onClose();
    } catch {
      setError(t(language, "habitResultSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="recovery-backdrop" role="presentation">
      <section className="recovery-dialog habit-checkin-dialog" role="dialog" aria-modal="true" aria-labelledby="habit-checkin-title">
        <header>
          <div><span className="section-kicker">{t(language, "habitActualResult")}</span><h2 id="habit-checkin-title">{habit.title}</h2><p>{t(language, "habitCheckInDescription")}</p></div>
          <button className="focus-close" type="button" onClick={onClose} title={t(language, "close")}><X size={20} /></button>
        </header>
        <form className="habit-checkin-form" onSubmit={submit}>
          <div className={`habit-result-status ${status}`}>
            {status === "full" ? <CircleCheckBig size={20} /> : status === "minimum" ? <Minimize2 size={20} /> : <Gauge size={20} />}
            <span><strong>{t(language, `habitResult_${status}`)}</strong><small>{t(language, "habitResultTarget", { value: target, unit: formatHabitUnit(language, habit.unit) })}</small></span>
          </div>
          <div className="habit-checkin-grid">
            <label className="planner-field"><span>{t(language, "habitActualAmount")}</span><div className="habit-amount-input"><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /><em>{formatHabitUnit(language, habit.unit)}</em></div></label>
            <label className="planner-field"><span>{t(language, "habitActualTime")}</span><div className="habit-amount-input"><input type="number" min="0" max="1440" value={duration} onChange={(event) => setDuration(event.target.value)} /><em>{t(language, "minuteShort")}</em></div></label>
          </div>
          <label className="planner-field"><span>{t(language, "habitNoteOptional")}</span><input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder={t(language, "habitNotePlaceholder")} /></label>
          {error && <p className="habit-form-error" role="alert">{error}</p>}
          <button className="planner-primary habit-checkin-save" type="submit" disabled={saving || actual <= 0}>{saving ? <Loader2 className="spin" size={18} /> : <Check size={18} />}{t(language, existingLog ? "updateHabitResult" : "saveHabitResult")}</button>
        </form>
      </section>
    </div>
  );
}

export default function HabitsView({ habits = [], logs = [], language, onAddHabit, onUpdateHabit, onCheckIn, onOpenPlanner }) {
  const [composerOpen, setComposerOpen] = useState(habits.length === 0);
  const today = getLocalDate();
  const stats = useMemo(() => weeklyStats(habits, logs), [habits, logs]);
  const todayLogs = new Map(logs.filter((log) => log.log_date === today).map((log) => [log.habit_id, log]));
  const dueToday = habits.filter((habit) => habitBelongsToDate(habit, today));
  const completedToday = dueToday.filter((habit) => todayLogs.has(habit.id)).length;

  return (
    <main className="planner-main habits-main">
      <section className="habits-intro">
        <div><span className="section-kicker">{t(language, "habitsKicker")}</span><h1>{t(language, "habitsTitle")}</h1><p>{t(language, "habitsDescription")}</p></div>
        <div className="habits-intro-actions">
          <button type="button" className="planner-secondary" onClick={onOpenPlanner}><CalendarCheck2 size={18} />{t(language, "openDayPath")}</button>
          <button type="button" className="planner-primary" onClick={() => setComposerOpen(true)}><Plus size={18} />{t(language, "newHabit")}</button>
        </div>
      </section>

      <section className="habit-stats" aria-label={t(language, "habitWeekSummary")}>
        <span><Target size={18} /><strong>{dueToday.length}</strong><small>{t(language, "dueToday")}</small></span>
        <span><CircleCheckBig size={18} /><strong>{completedToday}</strong><small>{t(language, "doneToday")}</small></span>
        <span><Repeat2 size={18} /><strong>{stats.rate}%</strong><small>{t(language, "weeklyContinuity")}</small></span>
        <span><Gauge size={18} /><strong>{stats.completed}/{stats.expected}</strong><small>{t(language, "weeklyResults")}</small></span>
      </section>

      {composerOpen && <HabitComposer language={language} onAdd={onAddHabit} onClose={() => setComposerOpen(false)} />}

      <section className="habit-list-section" aria-labelledby="habit-list-title">
        <header><div><span className="section-kicker">{t(language, "yourRhythm")}</span><h2 id="habit-list-title">{t(language, "habitsAndAwrad")}</h2></div><span>{habits.filter((habit) => habit.active !== false).length} {t(language, "activeHabits")}</span></header>
        {habits.length === 0 ? (
          <div className="habits-empty"><Repeat2 size={28} /><strong>{t(language, "noHabitsTitle")}</strong><p>{t(language, "noHabitsDescription")}</p><button className="planner-primary" type="button" onClick={() => setComposerOpen(true)}><Plus size={18} />{t(language, "buildFirstHabit")}</button></div>
        ) : (
          <div className="habit-list">
            {habits.map((habit) => {
              const Icon = categoryIcon(habit.category);
              const log = todayLogs.get(habit.id);
              const due = habitBelongsToDate(habit, today);
              const expected = stats.dates.filter((date) => habitBelongsToDate(habit, date)).length;
              const completed = new Set(logs.filter((item) => item.habit_id === habit.id && stats.dates.includes(item.log_date) && Number(item.actual_amount) > 0).map((item) => item.log_date)).size;
              const rate = expected ? Math.round(completed / expected * 100) : 0;
              return (
                <article className={`habit-card habit-${habit.category || "personal"} ${habit.active === false ? "inactive" : ""} ${log ? "logged" : ""}`} key={habit.id}>
                  <span className="habit-card-icon"><Icon size={20} /></span>
                  <div className="habit-card-copy">
                    <div className="habit-card-title"><strong>{habit.title}</strong>{due && <small className="habit-due-tag">{t(language, "scheduledToday")}</small>}</div>
                    <span>{habit.amount} {formatHabitUnit(language, habit.unit)} · {t(language, "minutes", { value: habit.duration_minutes || 20 })}</span>
                    <small><Minimize2 size={12} />{t(language, "habitMinimumInline", { value: habit.minimum_amount, unit: formatHabitUnit(language, habit.minimum_unit || habit.unit) })} · {t(language, `habitAnchor_${habit.preferred_anchor || "flexible"}`)}</small>
                    <span className="habit-week-meter"><span style={{ width: `${rate}%` }} /><em>{t(language, "habitWeekRate", { value: rate })}</em></span>
                  </div>
                  <div className="habit-card-result">
                    {log ? <span className="habit-log-value"><CircleCheckBig size={16} /><strong>{log.actual_amount} {formatHabitUnit(language, log.actual_unit || habit.unit)}</strong><small>{t(language, "recordedToday")}</small></span> : due ? <button className="planner-primary" type="button" onClick={() => onCheckIn(habit)}><Check size={17} />{t(language, "recordResult")}</button> : <span className="habit-rest-day">{t(language, "notScheduledToday")}</span>}
                    <button className={`habit-active-toggle ${habit.active !== false ? "active" : ""}`} type="button" aria-pressed={habit.active !== false} onClick={() => onUpdateHabit(habit.id, { active: habit.active === false })} title={t(language, habit.active === false ? "activateHabit" : "pauseHabit")}><span /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
