import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  BrainCircuit,
  BookOpen,
  BedDouble,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CalendarClock,
  Car,
  ChefHat,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheckBig,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CircleDollarSign,
  Dumbbell,
  GraduationCap,
  GripVertical,
  Home,
  HeartHandshake,
  HeartPulse,
  Languages,
  Link2,
  LifeBuoy,
  Loader2,
  Lock,
  Laptop,
  LogOut,
  Mail,
  MapPin,
  Minus,
  Minimize2,
  Moon,
  MoonStar,
  Pause,
  Paintbrush,
  Phone,
  Pill,
  Plane,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  ShowerHead,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Timer,
  Utensils,
  Users,
  WashingMachine,
  NotebookPen,
  WandSparkles,
  X,
  Zap,
  Focus,
  Fingerprint,
  Gauge,
  Lightbulb,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { BakoorLogo } from "@/components/BakoorLogo";
import DayFingerprint from "@/components/DayFingerprint";
import HabitsView, { HabitCheckInDialog } from "@/components/HabitsView";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { localizeMinimumVersion, localizeTitle, t } from "@/lib/i18n";
import { inferTaskCategory, inferTaskIcon } from "@/lib/taskIcons";
import {
  buildDayPathVariants,
  buildHabitTasks,
  buildProfileTimeBlocks,
  buildTaskSuggestions,
  canPlaceBlock,
  getLocalDate,
  getTomorrowDate,
  minutesToTime,
  prayerDurations,
  recommendPlanVariant,
  rescueRemainingDay,
  normalizeRecurrenceKey,
  taskBelongsToDate,
  timeToMinutes,
} from "@/lib/dayPath";
import "@/planner.css";

const ENERGY_OPTIONS = [
  { value: "low", labelKey: "low", hintKey: "lowHint" },
  { value: "medium", labelKey: "medium", hintKey: "mediumHint" },
  { value: "high", labelKey: "high", hintKey: "highHint" },
];

const DURATION_OPTIONS = [10, 20, 30, 45, 60, 90, 120, 180];
const MINIMUM_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45];
const PIXELS_PER_MINUTE = 1.22;
const LIVE_PIXELS_PER_MINUTE = 2.1;
const PRAYER_KEYS = {
  Fajr: "prayerFajr",
  Dhuhr: "prayerDhuhr",
  Asr: "prayerAsr",
  Maghrib: "prayerMaghrib",
  Isha: "prayerIsha",
};

function variantForPlanningStyle(style) {
  return { gentle: "minimum", balanced: "balanced", ambitious: "full" }[style] || "balanced";
}

const iconMap = {
  prayer: MoonStar,
  quran: BookOpen,
  fitness: Dumbbell,
  meal: Utensils,
  shower: ShowerHead,
  book: BookOpen,
  study: GraduationCap,
  home: Home,
  cleaning: Sparkles,
  laundry: WashingMachine,
  cooking: ChefHat,
  work: BriefcaseBusiness,
  coding: Laptop,
  meeting: Users,
  email: Mail,
  call: Phone,
  shopping: ShoppingCart,
  commute: Car,
  travel: Plane,
  health: HeartPulse,
  medicine: Pill,
  sleep: BedDouble,
  family: HeartHandshake,
  finance: CircleDollarSign,
  writing: NotebookPen,
  creative: Paintbrush,
  appointment: CalendarCheck2,
  task: ClipboardList,
};

function TaskIcon({ icon, size = 18 }) {
  const Icon = iconMap[icon] || ClipboardList;
  return <Icon size={size} aria-hidden="true" />;
}

function EnergyMeter({ value, language, compact = false }) {
  const count = { low: 1, medium: 2, high: 3 }[value] || 2;
  return (
    <span className={`energy-meter energy-${value} ${compact ? "compact" : ""}`} aria-label={`${t(language, "requiredEnergy")} ${t(language, value)}`}>
      {[1, 2, 3].map((item) => <Zap key={item} size={compact ? 12 : 15} className={item <= count ? "on" : ""} />)}
    </span>
  );
}

function formatDate(language, date = getLocalDate()) {
  const [year, month, day] = String(date).split("-").map(Number);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day, 12));
}

function formatDuration(minutes, language) {
  if (minutes < 60) return t(language, "minutes", { value: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? t(language, "hourMinutes", { hours, minutes: rest })
    : t(language, "hour", { value: hours });
}

function snapToFive(value) {
  return Math.round(value / 5) * 5;
}

function formatTimer(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest]
    .filter((_, index) => hours > 0 || index > 0)
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function findRecoveryStart(block, schedule, earliest, dayEnd) {
  const first = Math.ceil(Math.max(earliest, 0) / 5) * 5;
  for (let start = first; start + block.duration <= dayEnd; start += 5) {
    if (canPlaceBlock(block, start, schedule, 0, dayEnd)) return start;
  }
  return null;
}

function buildRecoverySuggestions(block, schedule, dayEnd) {
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const earliest = Math.max(currentMinute + 5, block.end);
  const nearest = findRecoveryStart(block, schedule, earliest, dayEnd);
  const nextPrayer = schedule.find((item) => item.kind === "prayer" && item.start > currentMinute);
  const afterPrayer = nextPrayer
    ? findRecoveryStart(block, schedule, Math.max(earliest, nextPrayer.end), dayEnd)
    : null;
  return { nearest, afterPrayer, nextPrayer };
}

function TimelineBlock({ block, editing, dayStart, dayEnd, scale, schedule, language, onMove, onMessage }) {
  const dragState = useRef(null);
  const height = Math.max(18, block.duration * scale - 4);
  const isCompact = height < 42;

  const handlePointerDown = (event) => {
    if (!editing || block.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { y: event.clientY, originalStart: block.start, latestStart: block.start };
    event.currentTarget.classList.add("dragging");
  };

  const handlePointerMove = (event) => {
    if (!dragState.current) return;
    const delta = snapToFive((event.clientY - dragState.current.y) / scale);
    const nextStart = dragState.current.originalStart + delta;
    dragState.current.latestStart = nextStart;
    onMove(block.id, nextStart);
  };

  const handlePointerUp = (event) => {
    if (!dragState.current) return;
    event.currentTarget.classList.remove("dragging");
    const nextStart = dragState.current.latestStart;
    const valid = canPlaceBlock(block, nextStart, schedule, dayStart, dayEnd);
    if (!valid) {
      onMove(block.id, dragState.current.originalStart);
      onMessage(t(language, "collision"));
    } else {
      onMove(block.id, nextStart);
      onMessage(t(language, "movedTask", { title: block.title, time: minutesToTime(nextStart) }));
    }
    dragState.current = null;
  };

  const handleKeyDown = (event) => {
    if (!editing || block.locked || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 15 : 5;
    const nextStart = block.start + (event.key === "ArrowDown" ? step : -step);
    if (canPlaceBlock(block, nextStart, schedule, dayStart, dayEnd)) {
      onMove(block.id, nextStart);
    } else {
      onMessage(t(language, "noSpace"));
    }
  };

  return (
    <article
      className={`timeline-block block-${block.color} ${block.locked ? "locked" : "movable"} ${isCompact ? "is-compact" : ""}`}
      style={{ top: `${(block.start - dayStart) * scale}px`, height: `${height}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={editing && !block.locked ? 0 : -1}
      aria-label={`${block.title} ${t(language, "from")} ${minutesToTime(block.start)} ${t(language, "to")} ${minutesToTime(block.end)}`}
    >
      <div className="timeline-block-accent"><TaskIcon icon={block.icon} size={isCompact ? 14 : 18} /></div>
      <div className="timeline-block-copy">
        <strong>{block.title}</strong>
        {!isCompact && <span>{minutesToTime(block.start)} – {minutesToTime(block.end)} · {formatDuration(block.duration, language)}</span>}
        {!isCompact && height > 68 && <small>{block.subtitle}</small>}
      </div>
      <div className="timeline-block-state">
        {block.locked ? <Lock size={14} /> : editing ? <GripVertical size={17} /> : <EnergyMeter value={block.energy} language={language} compact />}
      </div>
    </article>
  );
}

function DaySetupPanel({ language, dayStart, dayEnd, onDayStartChange, onDayEndChange, prayerData }) {
  return (
    <section className="setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">{t(language, "dayLimits")}</span>
          <h2 id="setup-title">{t(language, "fixedRhythm")}</h2>
        </div>
        <SlidersHorizontal size={20} />
      </div>

      <div className="setup-boundaries">
        <label className="planner-field">
          <span>{t(language, "dayStart")}</span>
          <input type="time" value={dayStart} max={dayEnd} onChange={(event) => onDayStartChange(event.target.value)} />
        </label>
        <span className="setup-boundary-line" />
        <label className="planner-field">
          <span>{t(language, "dayEnd")}</span>
          <input type="time" value={dayEnd} min={dayStart} onChange={(event) => onDayEndChange(event.target.value)} />
        </label>
      </div>

      <p className="setup-description">{t(language, "fixedRhythmDescription")}</p>
      <div className="prayer-preview-list">
        {prayerData.prayers.map((prayer) => (
          <div className="prayer-preview-row" key={prayer.key}>
            <span><MoonStar size={16} /> {t(language, PRAYER_KEYS[prayer.key])}</span>
            <time>{prayer.time}</time>
            <small>{prayerDurations[prayer.key]} {language === "ar" ? "د" : "min"}</small>
          </div>
        ))}
      </div>

      <div className="adhkar-preview">
        <span><BookOpen size={16} /> {t(language, "morningAdhkar")}</span>
        <span><BookOpen size={16} /> {t(language, "eveningAdhkar")}</span>
      </div>
    </section>
  );
}

function PlanningSessionBar({ language, targetDate, todayDate, tomorrowDate, reminderEnabled, reminderTime, onDateChange, onToggleReminder }) {
  const isTomorrow = targetDate === tomorrowDate;
  return (
    <section className={`planning-session-bar ${isTomorrow ? "tomorrow" : ""}`} aria-label={t(language, "planningSession") }>
      <div className="planning-date-switch" role="group" aria-label={t(language, "planningDate") }>
        <button type="button" className={targetDate === todayDate ? "active" : ""} aria-pressed={targetDate === todayDate} onClick={() => onDateChange(todayDate)}>
          <Sun size={16} /> <span><strong>{t(language, "today")}</strong><small>{formatDate(language, todayDate)}</small></span>
        </button>
        <button type="button" className={isTomorrow ? "active" : ""} aria-pressed={isTomorrow} onClick={() => onDateChange(tomorrowDate)}>
          <Sunset size={16} /> <span><strong>{t(language, "tomorrow")}</strong><small>{formatDate(language, tomorrowDate)}</small></span>
        </button>
      </div>
      <button className={`evening-reminder-toggle ${reminderEnabled ? "active" : ""}`} type="button" aria-pressed={reminderEnabled} onClick={onToggleReminder}>
        <BellRing size={17} />
        <span><strong>{t(language, "eveningReminder")}</strong><small>{t(language, "afterIshaAt", { time: reminderTime })}</small></span>
      </button>
    </section>
  );
}

function TaskSuggestions({ language, suggestions, acceptingKey, onAccept }) {
  if (!suggestions.length) return null;
  return (
    <section className="task-suggestions" aria-labelledby="task-suggestions-title">
      <header>
        <span><Repeat2 size={18} /></span>
        <div><span className="section-kicker">{t(language, "bakoorMemory")}</span><h2 id="task-suggestions-title">{t(language, "tomorrowSuggestions")}</h2></div>
      </header>
      <div className="suggestion-list">
        {suggestions.map((suggestion) => (
          <article key={suggestion.key}>
            <span className="suggestion-icon"><TaskIcon icon={inferTaskIcon(suggestion.source.title, suggestion.source.category)} /></span>
            <span className="suggestion-copy">
              <strong>{localizeTitle(suggestion.source.title, language)}</strong>
              <small>{formatDuration(suggestion.suggestedDuration, language)} · {t(language, "seenBefore", { value: suggestion.occurrenceCount })}</small>
            </span>
            <button type="button" disabled={acceptingKey === suggestion.key} onClick={() => onAccept(suggestion)} title={t(language, "addSuggestion")}>
              {acceptingKey === suggestion.key ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaskComposer({ language, targetDate, tasks, blocks, onAddTask, onAddBlock, onUpdateTask }) {
  const [type, setType] = useState("task");
  const [title, setTitle] = useState("");
  const [energy, setEnergy] = useState("medium");
  const [duration, setDuration] = useState(30);
  const [minimumEnabled, setMinimumEnabled] = useState(false);
  const [minimumVersion, setMinimumVersion] = useState("");
  const [minimumDuration, setMinimumDuration] = useState(15);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("07:45");
  const [linkedTask, setLinkedTask] = useState("");
  const [offset, setOffset] = useState(120);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeTasks = tasks.filter((task) => taskBelongsToDate(task, targetDate));
  const fixedBlocks = blocks.filter((block) => block.start_time && block.end_time && block.generated_by !== "zayd" && !block.source_task_id && (!block.scheduled_date || block.scheduled_date === targetDate));

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (type === "task") {
        await onAddTask({
          title: title.trim(),
          status: "planned",
          category: inferTaskCategory(title),
          priority: "important",
          difficulty: energy === "high" ? "hard" : energy === "low" ? "light" : "medium",
          energy_required: energy,
          duration_minutes: Number(duration),
          scheduled_date: targetDate,
          recurrence_key: normalizeRecurrenceKey(title),
          is_deep_work: energy === "high" && Number(duration) > 120,
          ...(minimumEnabled ? {
            minimum_version: minimumVersion.trim(),
            minimum_duration_minutes: Number(minimumDuration),
          } : {}),
        });
      } else {
        if (timeToMinutes(end) <= timeToMinutes(start)) throw new Error(t(language, "endAfterStart"));
        const linked = activeTasks.find((task) => task.id === linkedTask);
        await onAddBlock({
          title: title.trim(),
          block_type: "fixed",
          scheduled_date: targetDate,
          start_time: start,
          end_time: end,
          duration_minutes: timeToMinutes(end) - timeToMinutes(start),
          is_locked: true,
          generated_by: "user",
          color_key: "amber",
          linked_task_id: linked?.id || "",
          linked_task_title: linked?.title || "",
          relative_offset_minutes: linked ? Number(offset) : 0,
        });
      }
      setTitle("");
      setMinimumEnabled(false);
      setMinimumVersion("");
      setMinimumDuration(15);
    } catch (requestError) {
      setError(requestError?.message || t(language, "blockError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">{t(language, "tellBakoor")}</span>
          <h2 id="composer-title">{t(language, "whatToDo")}</h2>
        </div>
        <Sparkles size={20} />
      </div>

      <div className="composer-tabs" role="tablist" aria-label={t(language, "whatToDo")}>
        <button type="button" role="tab" aria-selected={type === "task"} className={type === "task" ? "active" : ""} onClick={() => setType("task")}>
          <WandSparkles size={16} /> {t(language, "flexibleTask")}
        </button>
        <button type="button" role="tab" aria-selected={type === "fixed"} className={type === "fixed" ? "active" : ""} onClick={() => setType("fixed")}>
          <Clock3 size={16} /> {t(language, "reserveTime")}
        </button>
      </div>

      <form className="composer-form" onSubmit={submit}>
        <label className="planner-field task-title-field">
          <span>{t(language, type === "task" ? "taskName" : "blockName")}</span>
          <div className="planner-input-shell">
            <TaskIcon icon={inferTaskIcon(title, type === "task" ? inferTaskCategory(title) : "personal", type)} />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(language, type === "task" ? "taskPlaceholder" : "blockPlaceholder")}
              required
            />
          </div>
        </label>

        {type === "task" ? (
          <>
            <fieldset className="energy-fieldset">
              <legend>{t(language, "requiredEnergy")}</legend>
              <div className="energy-options">
                {ENERGY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={energy === option.value ? "active" : ""}
                    onClick={() => setEnergy(option.value)}
                    title={t(language, option.hintKey)}
                  >
                    <EnergyMeter value={option.value} language={language} />
                    <span>{t(language, option.labelKey)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="planner-field">
              <span>{t(language, "estimatedDuration")}</span>
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                {DURATION_OPTIONS.map((value) => <option key={value} value={value}>{formatDuration(value, language)}</option>)}
              </select>
            </label>

            <div className={`minimum-plan-input ${minimumEnabled ? "active" : ""}`}>
              <label className="minimum-plan-toggle">
                <input type="checkbox" checked={minimumEnabled} onChange={(event) => setMinimumEnabled(event.target.checked)} />
                <span className="minimum-toggle-control" aria-hidden="true"><span /></span>
                <span><strong><Minimize2 size={15} /> {t(language, "minimumPlanToggle")}</strong><small>{t(language, "minimumPlanHint")}</small></span>
              </label>
              {minimumEnabled && (
                <div className="minimum-plan-fields">
                  <label className="planner-field">
                    <span>{t(language, "minimumVersionLabel")}</span>
                    <input
                      value={minimumVersion}
                      onChange={(event) => setMinimumVersion(event.target.value)}
                      placeholder={t(language, "minimumVersionPlaceholder")}
                      required
                    />
                  </label>
                  <label className="planner-field minimum-duration-field">
                    <span>{t(language, "minimumDurationLabel")}</span>
                    <select value={minimumDuration} onChange={(event) => setMinimumDuration(Number(event.target.value))}>
                      {MINIMUM_DURATION_OPTIONS.map((value) => <option key={value} value={value}>{formatDuration(value, language)}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="time-fields">
              <label className="planner-field"><span>{t(language, "from")}</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label>
              <label className="planner-field"><span>{t(language, "to")}</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
            </div>
            {!!activeTasks.length && (
              <div className="relation-row">
                <Link2 size={17} />
                <label className="planner-field">
                  <span>{t(language, "linkTask")}</span>
                  <select value={linkedTask} onChange={(event) => setLinkedTask(event.target.value)}>
                    <option value="">{t(language, "noLink")}</option>
                    {activeTasks.map((task) => <option key={task.id} value={task.id}>{localizeTitle(task.title, language)}</option>)}
                  </select>
                </label>
                {linkedTask && (
                  <label className="planner-field offset-field">
                    <span>{t(language, "startsAfter")}</span>
                    <select value={offset} onChange={(event) => setOffset(Number(event.target.value))}>
                      <option value={60}>{t(language, "oneHour")}</option>
                      <option value={90}>{t(language, "oneHalfHour")}</option>
                      <option value={120}>{t(language, "twoHours")}</option>
                      <option value={180}>{t(language, "threeHours")}</option>
                    </select>
                  </label>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="composer-error" role="alert">{error}</p>}
        <button className="planner-primary add-entry-button" type="submit" disabled={saving}>
          {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          {t(language, "addToDay")}
        </button>
      </form>

      <div className="entered-list">
        <div className="entered-list-heading">
          <strong>{t(language, "entered")}</strong>
          <span>{activeTasks.length + fixedBlocks.length} {t(language, "blocks")}</span>
        </div>
        {[...activeTasks, ...fixedBlocks].map((item) => {
          const isTask = Boolean(item.energy_required);
          return (
            <div className="entered-item" key={`${isTask ? "task" : "block"}-${item.id}`}>
              <span className="entered-icon"><TaskIcon icon={inferTaskIcon(item.title, isTask ? item.category : "personal", isTask ? "task" : item.block_type)} /></span>
              <span className="entered-copy">
                <strong>{localizeTitle(item.title, language)}</strong>
                <small>{isTask ? formatDuration(item.duration_minutes, language) : `${item.start_time} – ${item.end_time}`}</small>
                {isTask && item.minimum_version && <small className="minimum-entry-copy"><Minimize2 size={11} /> {localizeMinimumVersion(item.minimum_version, language)} · {formatDuration(item.minimum_duration_minutes || 15, language)}</small>}
              </span>
              {isTask ? <EnergyMeter value={item.energy_required} language={language} compact /> : <Lock size={14} />}
              {isTask && (
                <button className="remove-entry" type="button" onClick={() => onUpdateTask(item.id, { status: "cancelled" })} title={t(language, "removeTask")}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewPanel({ language, targetDate, tasks, blocks, onBack, onContinue }) {
  const activeTasks = tasks.filter((task) => taskBelongsToDate(task, targetDate));
  const fixedBlocks = blocks.filter((block) => block.start_time && block.end_time && block.generated_by !== "zayd" && !block.source_task_id && (!block.scheduled_date || block.scheduled_date === targetDate));
  const isArabic = language === "ar";
  const ContinueIcon = isArabic ? ArrowLeft : ArrowRight;
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  return (
    <section className="review-panel" aria-label={t(language, "reviewTitle")}>
      <div className="review-groups">
        <section className="review-group">
          <header><WandSparkles size={19} /><span><strong>{t(language, "tasksSummary")}</strong><small>{activeTasks.length}</small></span></header>
          <div className="review-list">
            {activeTasks.map((task) => (
              <div className="review-row" key={task.id}>
                <span className="entered-icon"><TaskIcon icon={inferTaskIcon(task.title, task.category)} /></span>
                <span>
                  <strong>{localizeTitle(task.title, language)}</strong>
                  <small>{formatDuration(task.duration_minutes, language)}</small>
                  {task.minimum_version && <small className="minimum-review-copy"><Minimize2 size={11} /> {t(language, "minimumVersionTag")}: {localizeMinimumVersion(task.minimum_version, language)} · {formatDuration(task.minimum_duration_minutes || 15, language)}</small>}
                </span>
                <EnergyMeter value={task.energy_required} language={language} compact />
              </div>
            ))}
          </div>
        </section>

        <section className="review-group">
          <header><Clock3 size={19} /><span><strong>{t(language, "reservationsSummary")}</strong><small>{fixedBlocks.length}</small></span></header>
          <div className="review-list">
            {fixedBlocks.length ? fixedBlocks.map((block) => (
              <div className="review-row" key={block.id}>
                <span className="entered-icon"><TaskIcon icon={inferTaskIcon(block.title, "personal", block.block_type)} /></span>
                <span><strong>{localizeTitle(block.title, language)}</strong><small>{block.start_time} – {block.end_time}</small></span>
                <Lock size={14} />
              </div>
            )) : <p className="review-empty">{t(language, "noReservations")}</p>}
          </div>
        </section>

        <section className="review-group sacred-review-group">
          <header><MoonStar size={19} /><span><strong>{t(language, "sacredSummary")}</strong><small>7</small></span></header>
          <div className="sacred-review-content">
            <span><Check size={16} /> {t(language, "fivePrayers")}</span>
            <span><Check size={16} /> {t(language, "twoAdhkar")}</span>
          </div>
        </section>
      </div>

      <footer className="wizard-actions">
        <button className="planner-secondary" type="button" onClick={onBack}><BackIcon size={18} /> {t(language, "back")}</button>
        <button className="planner-primary" type="button" onClick={onContinue}>{t(language, "buildProposal")} <ContinueIcon size={18} /></button>
      </footer>
    </section>
  );
}

function DayCapacityPanel({ language, proposal }) {
  const capacity = proposal.capacity || {};
  const loadPercent = Math.round((capacity.loadRatio || 0) * 100);
  const risk = capacity.risk || "balanced";
  const riskConfig = {
    balanced: { icon: ShieldCheck, title: "capacityBalanced", description: "capacityBalancedDescription" },
    tight: { icon: Gauge, title: "capacityTight", description: "capacityTightDescription" },
    overloaded: { icon: TriangleAlert, title: "capacityOverloaded", description: "capacityOverloadedDescription" },
  }[risk];
  const RiskIcon = riskConfig.icon;
  return (
    <section className={`capacity-panel capacity-${risk}`} aria-labelledby="capacity-title">
      <header className="capacity-header">
        <div className="capacity-status-icon"><RiskIcon size={20} /></div>
        <div>
          <span className="section-kicker">{t(language, "dayFeasibility")}</span>
          <h3 id="capacity-title">{t(language, riskConfig.title)}</h3>
          <p>{t(language, riskConfig.description)}</p>
        </div>
        <strong className="capacity-percent">{loadPercent}%</strong>
      </header>

      <div className="capacity-meter" aria-label={t(language, "dayLoadPercent", { value: loadPercent })}>
        <span style={{ width: `${Math.min(100, loadPercent)}%` }} />
      </div>

      <div className="capacity-stats">
        <span><small>{t(language, "requestedWork")}</small><strong>{formatDuration(capacity.requestedMinutes || 0, language)}</strong></span>
        <span><small>{t(language, "flexibleCapacity")}</small><strong>{formatDuration(capacity.availableMinutes || 0, language)}</strong></span>
        <span><small>{t(language, "breathingRoom")}</small><strong>{formatDuration(capacity.bufferMinutes || 0, language)}</strong></span>
      </div>

    </section>
  );
}

function DecisionPanel({ language, schedule }) {
  const decisions = schedule.filter((block) => block.kind === "task" && block.decision);
  const [openId, setOpenId] = useState(decisions[0]?.id || "");
  if (!decisions.length) return null;
  const averageFit = Math.round(decisions.reduce((sum, block) => sum + block.decision.fitScore, 0) / decisions.length);
  const energyAligned = decisions.filter((block) => block.decision.energyMatched).length;
  const learnedTasks = decisions.filter((block) => block.decision.learningSamples > 0).length;

  return (
    <section className="decision-panel" aria-labelledby="decision-panel-title">
      <header className="decision-panel-header">
        <span className="decision-brain"><BrainCircuit size={21} /></span>
        <div><span className="section-kicker">{t(language, "decisionKicker")}</span><h3 id="decision-panel-title">{t(language, "decisionTitle")}</h3><p>{t(language, "decisionDescription")}</p></div>
      </header>
      <div className="decision-stats">
        <span><small>{t(language, "decisionAverageFit")}</small><strong>{averageFit}%</strong></span>
        <span><small>{t(language, "decisionEnergyAligned")}</small><strong>{energyAligned}/{decisions.length}</strong></span>
        <span><small>{t(language, "decisionLearnedTasks")}</small><strong>{learnedTasks}</strong></span>
      </div>
      <div className="decision-list">
        {decisions.map((block) => {
          const decision = block.decision;
          const expanded = openId === block.id;
          return (
            <article className={`decision-row ${expanded ? "expanded" : ""}`} key={block.id}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpenId(expanded ? "" : block.id)}>
                <span className={`insight-icon block-${block.color}`}><TaskIcon icon={block.icon} size={15} /></span>
                <span className="decision-row-copy"><strong>{block.title}</strong><small>{minutesToTime(block.start)} · {block.placementReason}</small></span>
                <span className={`decision-score score-${decision.fitScore >= 80 ? "high" : decision.fitScore >= 65 ? "medium" : "low"}`}><strong>{decision.fitScore}%</strong><small>{t(language, `decisionConfidence_${decision.confidence}`)}</small></span>
                <ChevronDown className="decision-chevron" size={17} />
              </button>
              {expanded && (
                <div className="decision-details">
                  <section><strong>{t(language, "decisionFactors")}</strong><ul>{decision.factors.map((factor, index) => <li key={`${block.id}-factor-${index}`}><Check size={13} />{factor}</li>)}</ul></section>
                  <section className="decision-estimate"><strong>{t(language, "decisionEstimate")}</strong><span><Clock3 size={15} />{decision.learningSamples > 0 ? t(language, "decisionLearnedEstimate", { value: decision.learnedEstimate, count: decision.learningSamples }) : t(language, "decisionUserEstimate", { value: decision.userEstimate })}</span><small>{decision.learningSamples > 0 ? t(language, "decisionUserEstimate", { value: decision.userEstimate }) : t(language, "decisionLearningPending")}</small></section>
                  <section className="decision-alternative"><strong>{decision.alternativeStart !== null ? t(language, "decisionAlternative", { time: minutesToTime(decision.alternativeStart) }) : t(language, "decisionNoAlternative")}</strong>{decision.alternativeDelta !== null && <small>{t(language, "decisionAlternativeDifference", { value: decision.alternativeDelta })}</small>}</section>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DayPlanPanel({
  language,
  schedule,
  proposal,
  variants,
  recommendation,
  selectedVariant,
  isFuture,
  dayStart,
  dayEnd,
  editing,
  approved,
  dataLoading,
  onMove,
  onMessage,
  onApprove,
  onVariantChange,
  onToggleEditing,
  onReset,
  onBack,
}) {
  const startMinutes = timeToMinutes(dayStart);
  const endMinutes = timeToMinutes(dayEnd);
  const timelineHeight = Math.max(720, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);
  const hourMarkers = [];
  for (let minute = Math.ceil(startMinutes / 60) * 60; minute <= endMinutes; minute += 60) hourMarkers.push(minute);
  const plannedCount = schedule.filter((block) => block.kind === "task").length;
  const plannedMinutes = schedule.filter((block) => block.kind === "task").reduce((sum, block) => sum + block.duration, 0);
  const isArabic = language === "ar";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const variantOptions = [
    { id: "full", title: "variantFull", description: "variantFullDescription" },
    { id: "balanced", title: "variantBalanced", description: "variantBalancedDescription" },
    { id: "minimum", title: "variantMinimum", description: "variantMinimumDescription" },
  ];

  return (
    <section className={`day-plan-panel standalone-plan ${editing ? "editing" : ""} ${approved ? "approved" : ""}`} aria-labelledby="day-plan-title">
      <header className="day-plan-header">
        <div>
          <span className="section-kicker">{t(language, "planKicker")}</span>
          <h2 id="day-plan-title">{t(language, "planTitle")}</h2>
          <p>{t(language, "planDescription")}</p>
        </div>
        <div className={`proposal-state ${approved ? "is-approved" : ""}`}>
          {approved ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}
          {t(language, approved ? "approvedPath" : "proposalOnly")}
        </div>
      </header>

      <div className="plan-variant-switch" role="group" aria-label={t(language, "choosePlanVariant")}>
        {variantOptions.map((option) => {
          const variant = variants[option.id];
          const taskMinutes = variant.schedule.filter((block) => block.kind === "task").reduce((sum, block) => sum + block.duration, 0);
          return (
            <button key={option.id} type="button" className={selectedVariant === option.id ? "active" : ""} aria-pressed={selectedVariant === option.id} onClick={() => onVariantChange(option.id)}>
              <span><strong>{t(language, option.title)}</strong>{recommendation?.id === option.id && <em>{t(language, "recommended")}</em>}</span>
              <small>{t(language, option.description)}</small>
              <b>{formatDuration(taskMinutes, language)} · {variant.unscheduled.length} {t(language, "outsideTodayShort")}</b>
            </button>
          );
        })}
      </div>

      {recommendation && (
        <div className="plan-recommendation-strip">
          <BrainCircuit size={19} />
          <span><strong>{t(language, "recommendationTitle")}</strong><small>{t(language, recommendation.reasonKey)}</small></span>
        </div>
      )}

      <div className="plan-summary">
        <span><strong>{plannedCount}</strong> {t(language, "workSessions")}</span>
        <span><strong>{formatDuration(plannedMinutes, language)}</strong> {t(language, "tasksTime")}</span>
        <span><strong>5</strong> {t(language, "fixedPrayers")}</span>
        <span><strong>{proposal.unscheduled.length}</strong> {t(language, "outsideDay")}</span>
      </div>

      <DayCapacityPanel language={language} proposal={proposal} />
      <DecisionPanel language={language} schedule={schedule} />

      {editing && <div className="edit-hint"><GripVertical size={17} /> {t(language, "editHint")}</div>}

      <div className="timeline-scroll">
        <div className="day-timeline" style={{ height: `${timelineHeight}px` }}>
          <div className="timeline-axis" aria-hidden="true">
            {hourMarkers.map((minute) => (
              <div className="hour-marker" key={minute} style={{ top: `${(minute - startMinutes) * PIXELS_PER_MINUTE}px` }}>
                <time>{minutesToTime(minute)}</time><span />
              </div>
            ))}
          </div>
          <div className="timeline-track" />
          <div className="timeline-blocks">
            {schedule.map((block) => (
              <TimelineBlock
                key={block.id}
                block={block}
                editing={editing}
                dayStart={startMinutes}
                dayEnd={endMinutes}
                scale={PIXELS_PER_MINUTE}
                schedule={schedule}
                language={language}
                onMove={onMove}
                onMessage={onMessage}
              />
            ))}
          </div>
        </div>
      </div>

      {!!proposal.unscheduled.length && (
        <div className="unscheduled-note"><strong>{t(language, "dayFull")}</strong><span>{t(language, "unrealisticWarning")}</span></div>
      )}

      <footer className="plan-actions wizard-plan-actions">
        <button className="planner-secondary" type="button" onClick={onBack}><BackIcon size={18} /> {t(language, "back")}</button>
        <button className="planner-primary" type="button" onClick={onApprove} disabled={dataLoading}>
          {approved ? <Check size={18} /> : <CheckCircle2 size={18} />}
          {t(language, approved ? "pathApproved" : isFuture ? "approveTomorrowPath" : "approvePath")}
        </button>
        <button className="planner-secondary" type="button" onClick={onToggleEditing}>
          <GripVertical size={18} /> {t(language, editing ? "finishEditing" : "editProposal")}
        </button>
        <button className="planner-icon-button reset-plan" type="button" onClick={onReset} title={t(language, "resetProposal")}><RotateCcw size={18} /></button>
      </footer>
    </section>
  );
}

function RecoveryDialog({ block, language, suggestions, onClose, onSelect }) {
  const options = [
    {
      id: "nearest",
      icon: Clock3,
      title: t(language, "recoverNearest"),
      description: suggestions.nearest !== null
        ? t(language, "recoverAt", { time: minutesToTime(suggestions.nearest) })
        : t(language, "recoverNoSpace"),
      disabled: suggestions.nearest === null,
    },
    {
      id: "afterPrayer",
      icon: MoonStar,
      title: t(language, "recoverAfterPrayer"),
      description: suggestions.afterPrayer !== null
        ? t(language, "recoverAfterPrayerAt", { time: minutesToTime(suggestions.afterPrayer) })
        : t(language, "recoverNoPrayerSpace"),
      disabled: suggestions.afterPrayer === null,
    },
    {
      id: "tomorrow",
      icon: CalendarDays,
      title: t(language, "recoverTomorrow"),
      description: t(language, "recoverTomorrowDescription"),
      disabled: !block.sourceId,
    },
  ];

  return (
    <div className="recovery-backdrop" role="presentation">
      <section className="recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <header>
          <div>
            <span className="section-kicker">{t(language, "recoveryKicker")}</span>
            <h2 id="recovery-title">{t(language, "recoveryTitle")}</h2>
            <p>{t(language, "recoveryDescription", { title: block.title })}</p>
          </div>
          <button className="focus-close" type="button" onClick={onClose} title={t(language, "close")}><X size={20} /></button>
        </header>
        <div className="recovery-options">
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button key={option.id} type="button" disabled={option.disabled} onClick={() => onSelect(option.id)}>
                <span><OptionIcon size={19} /></span>
                <span><strong>{option.title}</strong><small>{option.description}</small></span>
                {language === "ar" ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
              </button>
            );
          })}
        </div>
        <footer><Lightbulb size={15} /> {t(language, "recoveryPrinciple")}</footer>
      </section>
    </div>
  );
}

function ActualTimeDialog({ block, language, onClose, onSave, onSkip }) {
  const [minutes, setMinutes] = useState(Math.max(1, Number(block.duration || 30)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const changeMinutes = (amount) => {
    setMinutes((current) => Math.max(1, Math.min(720, current + amount)));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(minutes);
  };

  return (
    <div className="recovery-backdrop" role="presentation">
      <section className="recovery-dialog actual-time-dialog" role="dialog" aria-modal="true" aria-labelledby="actual-time-title">
        <header>
          <div>
            <span className="section-kicker">{t(language, "actualTimeKicker")}</span>
            <h2 id="actual-time-title">{t(language, "actualTimeTitle")}</h2>
            <p>{t(language, "actualTimeDescription")}</p>
          </div>
          <button className="focus-close" type="button" onClick={onClose} title={t(language, "close")}><X size={20} /></button>
        </header>
        <form className="actual-time-form" onSubmit={submit}>
          <div className="actual-time-task">
            <span className={`insight-icon block-${block.color}`}><TaskIcon icon={block.icon} size={17} /></span>
            <span><strong>{block.title}</strong><small>{t(language, "actualTimePlanned", { value: formatDuration(block.duration, language) })}</small></span>
          </div>
          <div className="actual-time-field">
            <label htmlFor="actual-time-minutes">{t(language, "actualTimeMinutes")}</label>
            <div className="actual-time-stepper">
              <button type="button" onClick={() => changeMinutes(-5)} aria-label={t(language, "decreaseTime")} title={t(language, "decreaseTime")}><Minus size={18} /></button>
              <input id="actual-time-minutes" type="number" min="1" max="720" step="1" value={minutes} onChange={(event) => setMinutes(Math.max(1, Math.min(720, Number(event.target.value) || 1)))} />
              <small>{t(language, "minuteShort")}</small>
              <button type="button" onClick={() => changeMinutes(5)} aria-label={t(language, "increaseTime")} title={t(language, "increaseTime")}><Plus size={18} /></button>
            </div>
          </div>
          <div className="actual-time-actions">
            <button className="planner-primary" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}{t(language, "saveTimeAndComplete")}</button>
            <button className="planner-secondary" type="button" onClick={onSkip}>{t(language, "completeWithoutTime")}</button>
          </div>
        </form>
        <footer><BrainCircuit size={15} /> {t(language, "actualTimePrinciple")}</footer>
      </section>
    </div>
  );
}

function RescueDayDialog({ schedule, completedIds, currentEnergy, language, onClose, onApply }) {
  const [energy, setEnergy] = useState(currentEnergy);
  const [useMinimum, setUseMinimum] = useState(energy === "low");
  const remainingTasks = new Set(
    schedule
      .filter((block) => block.kind === "task" && !completedIds.has(block.id))
      .map((block) => block.sourceId || block.id)
  ).size;
  const protectedAnchors = schedule.filter((block) => block.kind !== "task" || completedIds.has(block.id)).length;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="recovery-backdrop" role="presentation">
      <section className="recovery-dialog rescue-day-dialog" role="dialog" aria-modal="true" aria-labelledby="rescue-day-title">
        <header>
          <div>
            <span className="section-kicker">{t(language, "rescueDayKicker")}</span>
            <h2 id="rescue-day-title">{t(language, "rescueDayTitle")}</h2>
            <p>{t(language, "rescueDayDescription")}</p>
          </div>
          <button className="focus-close" type="button" onClick={onClose} title={t(language, "close")}><X size={20} /></button>
        </header>

        <div className="rescue-day-body">
          <fieldset className="energy-fieldset rescue-energy-fieldset">
            <legend>{t(language, "currentEnergyNow")}</legend>
            <div className="energy-options">
              {ENERGY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={energy === option.value ? "active" : ""}
                  aria-pressed={energy === option.value}
                  onClick={() => {
                    setEnergy(option.value);
                    if (option.value === "low") setUseMinimum(true);
                  }}
                >
                  <EnergyMeter value={option.value} language={language} />
                  <span>{t(language, option.labelKey)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className={`rescue-minimum-choice ${useMinimum ? "active" : ""}`}>
            <input type="checkbox" checked={useMinimum} onChange={(event) => setUseMinimum(event.target.checked)} />
            <span className="minimum-toggle-control" aria-hidden="true"><span /></span>
            <span><strong><Minimize2 size={16} /> {t(language, "useMinimumPlan")}</strong><small>{t(language, "useMinimumPlanDescription")}</small></span>
          </label>

          <div className="rescue-preview-stats">
            <span><BriefcaseBusiness size={15} /> {t(language, "remainingTasks", { value: remainingTasks })}</span>
            <span><ShieldCheck size={15} /> {t(language, "protectedAnchors", { value: protectedAnchors })}</span>
          </div>

          <button className="planner-primary rescue-apply-button" type="button" disabled={!remainingTasks} onClick={() => onApply({ energy, useMinimum })}>
            <LifeBuoy size={18} /> {t(language, "rebuildRemainingDay")}
          </button>
        </div>

        <footer><Lightbulb size={15} /> {t(language, "rescueDayPrinciple")}</footer>
      </section>
    </div>
  );
}

function DailyReviewDialog({ language, schedule, completedIds, actualByBlock, existingReview, onClose, onSubmit }) {
  const [energy, setEnergy] = useState(existingReview?.energy_level || "medium");
  const [focusQuality, setFocusQuality] = useState(existingReview?.focus_quality || 3);
  const [deferredReason, setDeferredReason] = useState(existingReview?.deferred_reason || "none");
  const [tomorrowAdjustment, setTomorrowAdjustment] = useState(existingReview?.tomorrow_adjustment || "");
  const [planTomorrow, setPlanTomorrow] = useState(true);
  const [saving, setSaving] = useState(false);
  const taskBlocks = schedule.filter((block) => block.kind === "task");
  const sourceGroups = new Map();
  taskBlocks.forEach((block) => {
    const key = block.sourceId || block.id;
    sourceGroups.set(key, [...(sourceGroups.get(key) || []), block]);
  });
  const plannedTasks = sourceGroups.size;
  const completedTasks = Array.from(sourceGroups.values()).filter((items) => items.every((block) => completedIds.has(block.id))).length;
  const completionRate = plannedTasks ? Math.round(completedTasks / plannedTasks * 100) : 0;
  const deepWorkMinutes = taskBlocks
    .filter((block) => block.energy === "high" && completedIds.has(block.id))
    .reduce((sum, block) => sum + Number(actualByBlock[block.id] || block.duration), 0);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        energy_level: energy,
        focus_quality: focusQuality,
        deferred_reason: deferredReason,
        tomorrow_adjustment: tomorrowAdjustment.trim(),
        planned_tasks: plannedTasks,
        completed_tasks: completedTasks,
        completion_rate: completionRate,
        deep_work_minutes: deepWorkMinutes,
        gratitude: [],
      }, planTomorrow);
    } finally {
      setSaving(false);
    }
  };

  const reasonKeys = ["none", "underestimated", "unclear", "low_energy", "interruption", "overplanned", "resistance", "not_important"];

  return (
    <div className="recovery-backdrop" role="presentation">
      <section className="recovery-dialog daily-review-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-review-title">
        <header>
          <div><span className="section-kicker">{t(language, "dayReviewKicker")}</span><h2 id="daily-review-title">{t(language, "dayReviewTitle")}</h2><p>{t(language, "dayReviewDescription")}</p></div>
          <button className="focus-close" type="button" onClick={onClose} title={t(language, "close")}><X size={20} /></button>
        </header>
        <form className="daily-review-form" onSubmit={submit}>
          <div className="review-result-strip">
            <span><strong>{completionRate}%</strong><small>{t(language, "completionRate")}</small></span>
            <span><strong>{completedTasks}/{plannedTasks}</strong><small>{t(language, "completedTasks")}</small></span>
            <span><strong>{formatDuration(deepWorkMinutes, language)}</strong><small>{t(language, "deepWorkDone")}</small></span>
          </div>

          <fieldset className="energy-fieldset">
            <legend>{t(language, "dayEnergyQuestion")}</legend>
            <div className="energy-options">
              {ENERGY_OPTIONS.map((option) => (
                <button key={option.value} type="button" className={energy === option.value ? "active" : ""} aria-pressed={energy === option.value} onClick={() => setEnergy(option.value)}>
                  <EnergyMeter value={option.value} language={language} /><span>{t(language, option.labelKey)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="focus-quality-fieldset">
            <legend>{t(language, "focusQuality")}</legend>
            <div>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={value <= focusQuality} onClick={() => setFocusQuality(value)} title={`${value}/5`}><Star size={18} /></button>)}</div>
          </fieldset>

          {completedTasks < plannedTasks && (
            <label className="planner-field">
              <span>{t(language, "mainDeferredReason")}</span>
              <select value={deferredReason} onChange={(event) => setDeferredReason(event.target.value)}>
                {reasonKeys.map((key) => <option key={key} value={key}>{t(language, `deferred_${key}`)}</option>)}
              </select>
            </label>
          )}

          <label className="planner-field">
            <span>{t(language, "tomorrowAdjustment")}</span>
            <input value={tomorrowAdjustment} onChange={(event) => setTomorrowAdjustment(event.target.value)} placeholder={t(language, "tomorrowAdjustmentPlaceholder")} />
          </label>

          <label className={`rescue-minimum-choice review-tomorrow-choice ${planTomorrow ? "active" : ""}`}>
            <input type="checkbox" checked={planTomorrow} onChange={(event) => setPlanTomorrow(event.target.checked)} />
            <span className="minimum-toggle-control" aria-hidden="true"><span /></span>
            <span><strong><CalendarClock size={16} /> {t(language, "planTomorrowAfterReview")}</strong><small>{t(language, "planTomorrowAfterReviewHint")}</small></span>
          </label>

          <button className="planner-primary review-save-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <ClipboardCheck size={18} />}
            {t(language, existingReview ? "updateReview" : "saveReview")}
          </button>
        </form>
      </section>
    </div>
  );
}

function FocusSession({ block, language, onClose, onComplete }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const plannedSeconds = block.duration * 60;
  const remainingSeconds = plannedSeconds - elapsedSeconds;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const finish = () => {
    onComplete(block.id, Math.max(1, Math.round(elapsedSeconds / 60)));
    onClose();
  };

  return (
    <div className="focus-session" role="dialog" aria-modal="true" aria-labelledby="focus-session-title">
      <header className="focus-session-header">
        <span><Focus size={18} /> {t(language, "focusMode")}</span>
        <button type="button" className="focus-close" onClick={onClose} title={t(language, "exitFocus")}><X size={20} /></button>
      </header>
      <div className="focus-session-main">
        <div className={`focus-task-icon block-${block.color}`}><TaskIcon icon={block.icon} size={30} /></div>
        <span className="focus-kicker">{t(language, "oneTaskNow")}</span>
        <h2 id="focus-session-title">{block.title}</h2>
        <p>{minutesToTime(block.start)} – {minutesToTime(block.end)} · {formatDuration(block.duration, language)}</p>
        {block.isMinimum && <p className="focus-minimum-target"><Minimize2 size={15} /> {t(language, "minimumTarget")}: {block.minimumVersion}</p>}
        <div className="execution-focus-timer" aria-label={t(language, "timeRemaining")}>
          <Timer size={22} />
          <strong className={remainingSeconds < 0 ? "is-overtime" : ""}>{remainingSeconds < 0 ? "+" : ""}{formatTimer(Math.abs(remainingSeconds))}</strong>
          <span>{remainingSeconds < 0 ? t(language, "overtime") : t(language, "timeRemaining")}</span>
        </div>
        <div className="execution-focus-controls">
          <button className="execution-focus-pause" type="button" onClick={() => setRunning((value) => !value)}>
            {running ? <Pause size={19} /> : <Play size={19} />}
            {t(language, running ? "pause" : "resume")}
          </button>
          <button className="execution-focus-finish" type="button" onClick={finish}>
            <CircleCheckBig size={19} /> {t(language, "finishTask")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExecutionView({
  schedule,
  capacity,
  dayStart,
  dayEnd,
  language,
  completedIds,
  actualByBlock,
  currentEnergy,
  rescueSummary,
  reviewed,
  onToggleComplete,
  onFocus,
  onRecover,
  onRescueDay,
  onReview,
  onEditPlan,
}) {
  const [now, setNow] = useState(() => new Date());
  const activeBlockRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const startMinutes = timeToMinutes(dayStart);
  const endMinutes = timeToMinutes(dayEnd);
  const timelineHeight = Math.max(520, (endMinutes - startMinutes) * LIVE_PIXELS_PER_MINUTE);
  const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const nowIsVisible = currentMinute >= startMinutes && currentMinute <= endMinutes;
  const actionableBlocks = schedule.filter((block) => !completedIds.has(block.id));
  const happeningNow = actionableBlocks.find((block) => currentMinute >= block.start && currentMinute < block.end);
  const nextBlock = actionableBlocks.find((block) => block.start >= currentMinute) || actionableBlocks[0];
  const activeBlock = happeningNow || nextBlock;
  const focusBlock = actionableBlocks.find((block) => ["task", "fixed"].includes(block.kind) && block.start >= currentMinute)
    || actionableBlocks.find((block) => ["task", "fixed"].includes(block.kind));
  const completedCount = schedule.filter((block) => completedIds.has(block.id)).length;
  const progress = schedule.length ? Math.round((completedCount / schedule.length) * 100) : 0;
  const dayRisk = capacity?.risk || "balanced";
  const healthConfig = {
    balanced: { icon: ShieldCheck, title: "executionBalanced", description: "executionBalancedDescription" },
    tight: { icon: Gauge, title: "executionTight", description: "executionTightDescription" },
    overloaded: { icon: TriangleAlert, title: "executionOverloaded", description: "executionOverloadedDescription" },
  }[dayRisk];
  const HealthIcon = healthConfig.icon;
  const measuredBlocks = schedule.filter((block) => Number(actualByBlock[block.id]) > 0);
  const estimateAccuracy = measuredBlocks.length
    ? Math.round(measuredBlocks.reduce((sum, block) => {
      const actual = actualByBlock[block.id];
      return sum + Math.max(0, 100 - Math.abs(actual - block.duration) / block.duration * 100);
    }, 0) / measuredBlocks.length)
    : null;
  const hourMarkers = [];
  for (let minute = Math.ceil(startMinutes / 60) * 60; minute <= endMinutes; minute += 60) hourMarkers.push(minute);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = timelineScrollRef.current;
    const block = activeBlockRef.current;
    if (!container || !block) return;
    const nextTop = Math.max(0, block.offsetTop - container.clientHeight / 2 + block.offsetHeight / 2);
    container.scrollTo({ top: nextTop, behavior: "smooth" });
  }, [activeBlock?.id, schedule]);

  return (
    <main className="planner-main execution-main">
      <section className="execution-header">
        <div>
          <span className="section-kicker">{t(language, "liveDayKicker")}</span>
          <h1>{t(language, "liveDayTitle")}</h1>
          <p>{t(language, "liveDayDescription")}</p>
        </div>
        <div className="execution-header-actions">
          <button className="planner-secondary rescue-day-button" type="button" onClick={onRescueDay}>
            <LifeBuoy size={18} /> {t(language, "rescueDay")}
          </button>
          <button className={`planner-secondary day-review-button ${reviewed ? "reviewed" : ""}`} type="button" onClick={onReview}>
            {reviewed ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />} {t(language, reviewed ? "reviewCompleted" : "reviewMyDay")}
          </button>
          {focusBlock ? (
            <button className="planner-primary focus-now-button" type="button" onClick={() => onFocus(focusBlock)}>
              <Focus size={18} /> {t(language, "focusNow")}
            </button>
          ) : (
            <span className="all-done"><CircleCheckBig size={18} /> {t(language, "allDone")}</span>
          )}
          <button className="planner-secondary" type="button" onClick={onEditPlan}><GripVertical size={17} /> {t(language, "editDayPath")}</button>
        </div>
      </section>

      <section className="execution-progress" aria-label={t(language, "dayProgress")}>
        <div>
          <strong>{t(language, "progressLabel", { done: completedCount, total: schedule.length })}</strong>
          <span>{progress}%</span>
        </div>
        <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
      </section>

      <section className={`execution-health execution-health-${dayRisk}`}>
        <HealthIcon size={19} />
        <span><strong>{t(language, healthConfig.title)}</strong><small>{t(language, healthConfig.description, { value: formatDuration(capacity?.bufferMinutes || 0, language) })}</small></span>
        <span className="current-energy-chip"><EnergyMeter value={currentEnergy} language={language} compact /> {t(language, currentEnergy)}</span>
      </section>

      {rescueSummary && (
        <section className="rescue-summary" aria-label={t(language, "rescueSummaryTitle")}>
          <LifeBuoy size={19} />
          <span>
            <strong>{t(language, "rescueSummaryTitle")}</strong>
            <small>{t(language, "rescueSummaryDescription", { saved: formatDuration(rescueSummary.savedMinutes, language) })}</small>
          </span>
          {rescueSummary.unscheduled.length > 0 && <em>{t(language, "rescueUnscheduled", { value: rescueSummary.unscheduled.length })}</em>}
        </section>
      )}

      {estimateAccuracy !== null && (
        <section className="estimate-learning" aria-label={t(language, "estimateLearning")}>
          <Gauge size={19} />
          <span><strong>{t(language, "estimateLearning")}</strong><small>{t(language, "estimateAccuracyDescription", { value: estimateAccuracy, count: measuredBlocks.length })}</small></span>
          <strong>{estimateAccuracy}%</strong>
        </section>
      )}

      <section className="live-timeline-shell" aria-label={t(language, "liveDayTitle")}>
        <div className="live-timeline-scroll" ref={timelineScrollRef}>
          <div className="live-timeline" style={{ height: `${timelineHeight}px` }}>
            <div className="live-axis" aria-hidden="true">
              {hourMarkers.map((minute) => (
                <div className="live-hour" key={minute} style={{ top: `${(minute - startMinutes) * LIVE_PIXELS_PER_MINUTE}px` }}>
                  <time>{minutesToTime(minute)}</time><span />
                </div>
              ))}
            </div>
            <div className="live-track" aria-hidden="true" />
            <div className="live-blocks">
              {schedule.map((block) => {
                const isCompleted = completedIds.has(block.id);
                const isActive = block.id === activeBlock?.id;
                const canFocus = ["task", "fixed"].includes(block.kind);
                const height = Math.max(46, block.duration * LIVE_PIXELS_PER_MINUTE - 5);
                return (
                  <article
                    key={block.id}
                    ref={isActive ? activeBlockRef : undefined}
                    data-start={block.start}
                    data-end={block.end}
                    className={`live-block block-${block.color} ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""} ${block.isMinimum ? "minimum" : ""}`}
                    style={{ top: `${(block.start - startMinutes) * LIVE_PIXELS_PER_MINUTE}px`, minHeight: `${height}px` }}
                  >
                    <div className="live-icon-rail"><TaskIcon icon={block.icon} size={18} /></div>
                    <div className="live-block-card">
                      <div className="live-block-copy">
                        {isActive && <span className="live-state-label">{t(language, happeningNow?.id === block.id ? "currentTask" : "nextTask")}</span>}
                        {block.recovered && <span className="live-recovered-label">{t(language, "rescheduled")}</span>}
                        {block.isMinimum && <span className="live-minimum-label"><Minimize2 size={11} /> {t(language, "minimumVersionTag")}</span>}
                        <strong>{block.title}</strong>
                        <span>{minutesToTime(block.start)} – {minutesToTime(block.end)} · {formatDuration(block.duration, language)}</span>
                        {block.isMinimum && <small className="live-minimum-target">{block.minimumVersion}</small>}
                        {actualByBlock[block.id] && (
                          <small className="actual-duration">{t(language, "actualVsPlanned", { actual: formatDuration(actualByBlock[block.id], language), planned: formatDuration(block.duration, language) })}</small>
                        )}
                      </div>
                      <div className="live-block-actions">
                        {canFocus && !isCompleted && (
                          <button type="button" className="live-focus-button" onClick={() => onFocus(block)} title={t(language, "focusNow")}><Focus size={17} /></button>
                        )}
                        {block.kind === "task" && !block.sourceHabitId && !isCompleted && (
                          <button type="button" className="live-recover-button" onClick={() => onRecover(block)} title={t(language, "couldNotDo")}><RotateCcw size={16} /></button>
                        )}
                        <button
                          type="button"
                          className="live-check"
                          aria-pressed={isCompleted}
                          onClick={() => onToggleComplete(block)}
                          title={t(language, isCompleted ? "markIncomplete" : "markComplete")}
                        >
                          {isCompleted ? <Check size={18} /> : null}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {nowIsVisible && (
              <div className="live-now-line" style={{ top: `${(currentMinute - startMinutes) * LIVE_PIXELS_PER_MINUTE}px` }}>
                <time>{t(language, "currentTime", { time: now.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" }) })}</time>
                <span />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stepper({ language, step }) {
  const steps = ["prepareStep", "reviewStep", "planStep"];
  return (
    <nav className="planner-stepper" aria-label={`${t(language, "step")} ${step} ${t(language, "of")} 3`}>
      {steps.map((key, index) => {
        const number = index + 1;
        const state = number < step ? "complete" : number === step ? "active" : "pending";
        return (
          <div className={`stepper-item ${state}`} key={key} aria-current={number === step ? "step" : undefined}>
            <span>{state === "complete" ? <Check size={14} /> : number}</span>
            <strong>{t(language, key)}</strong>
          </div>
        );
      })}
    </nav>
  );
}

export default function Dashboard({
  user,
  isDemo,
  tasks,
  blocks,
  habits = [],
  habitLogs = [],
  reviews = [],
  preferences = [],
  dataLoading,
  dataError,
  theme,
  language,
  onLanguageChange,
  onThemeChange,
  onExit,
  onAddTask,
  onUpdateTask,
  onAddBlock,
  onAddHabit,
  onUpdateHabit,
  onAddHabitLog,
  onUpdateHabitLog,
  onAddReview,
  onUpdateReview,
  onAddPreference,
  onUpdatePreference,
  onReload,
}) {
  const todayDate = getLocalDate();
  const tomorrowDate = getTomorrowDate();
  const initialPreference = preferences[0];
  const [step, setStep] = useState(1);
  const [workspaceView, setWorkspaceView] = useState(initialPreference?.onboarding_complete === false ? "fingerprint" : "planner");
  const [planningDate, setPlanningDate] = useState(todayDate);
  const [selectedVariant, setSelectedVariant] = useState(() => variantForPlanningStyle(initialPreference?.planning_style));
  const [dayStart, setDayStart] = useState(initialPreference?.day_start_time || "04:00");
  const [dayEnd, setDayEnd] = useState(initialPreference?.day_end_time || "23:00");
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [actualByBlock, setActualByBlock] = useState({});
  const [focusedBlock, setFocusedBlock] = useState(null);
  const [recoveringBlock, setRecoveringBlock] = useState(null);
  const [rescueDayOpen, setRescueDayOpen] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState("medium");
  const [rescueSummary, setRescueSummary] = useState(null);
  const [acceptingSuggestion, setAcceptingSuggestion] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [habitCheckIn, setHabitCheckIn] = useState(null);
  const [actualTimeCheckIn, setActualTimeCheckIn] = useState(null);
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState([]);
  const fingerprintPrompted = useRef(false);
  const preference = preferences[0];
  const prayerData = usePrayerTimes({ city: preference?.city || "Cairo", country: preference?.country || "Egypt", method: preference?.calculation_method || 5, date: planningDate });
  const isArabic = language === "ar";
  const ContinueIcon = isArabic ? ArrowLeft : ArrowRight;
  const isFuturePlan = planningDate > todayDate;
  const reminderEnabled = preference?.evening_planning_enabled !== false;
  const reminderOffset = Number(preference?.evening_planning_offset_minutes ?? 30);
  const reminderTime = minutesToTime((timeToMinutes(prayerData.timings.Isha) + reminderOffset) % 1440);

  const habitTasks = useMemo(
    () => buildHabitTasks(habits, habitLogs, planningDate, language),
    [habits, habitLogs, planningDate, language]
  );
  const planningTasks = useMemo(() => [...tasks, ...habitTasks], [tasks, habitTasks]);
  const profileBlocks = useMemo(
    () => buildProfileTimeBlocks(preference, prayerData.timings, planningDate, language),
    [preference, prayerData.timings, planningDate, language]
  );
  const planningBlocks = useMemo(() => [...blocks, ...profileBlocks], [blocks, profileBlocks]);
  const activeTasks = planningTasks.filter((task) => taskBelongsToDate(task, planningDate));
  const fixedBlocks = planningBlocks.filter((block) => block.start_time && block.end_time && block.generated_by !== "zayd" && !block.source_task_id && (!block.scheduled_date || block.scheduled_date === planningDate));
  const hasEntries = activeTasks.length + fixedBlocks.length > 0;
  const validDayBounds = timeToMinutes(dayEnd) > timeToMinutes(dayStart);
  const reviewForDate = reviews.find((review) => review.review_date === planningDate);
  const tomorrowHasTasks = tasks.some((task) => taskBelongsToDate(task, tomorrowDate));
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
  const showEveningPrompt = reminderEnabled && currentMinute >= timeToMinutes(reminderTime) && !tomorrowHasTasks && planningDate === todayDate && !executing;
  const taskSuggestions = useMemo(
    () => planningDate === tomorrowDate ? buildTaskSuggestions(tasks, planningDate) : [],
    [planningDate, tasks, tomorrowDate]
  );
  const planRecommendation = useMemo(
    () => recommendPlanVariant({ profile: preference || {}, reviews, date: planningDate }),
    [preference, reviews, planningDate]
  );
  const proposalVariants = useMemo(() => buildDayPathVariants({
    tasks: planningTasks,
    blocks: planningBlocks,
    timings: prayerData.timings,
    dayStart,
    dayEnd,
    date: planningDate,
    language,
    profile: preference || {},
  }), [planningTasks, planningBlocks, prayerData.timings, dayStart, dayEnd, language, planningDate, preference]);
  const proposal = proposalVariants[selectedVariant] || proposalVariants.balanced;

  const executionCapacity = useMemo(() => {
    const scheduledMinutes = schedule
      .filter((block) => block.kind === "task")
      .reduce((sum, block) => sum + block.duration, 0);
    const availableMinutes = proposal.capacity?.availableMinutes || 0;
    const bufferMinutes = Math.max(0, availableMinutes - scheduledMinutes);
    const loadRatio = availableMinutes > 0 ? scheduledMinutes / availableMinutes : scheduledMinutes > 0 ? 1 : 0;
    const risk = rescueSummary?.unscheduled.length || loadRatio > 0.92
      ? "overloaded"
      : loadRatio > 0.72 || bufferMinutes < 90
        ? "tight"
        : "balanced";
    return { ...proposal.capacity, scheduledMinutes, bufferMinutes, loadRatio, risk };
  }, [proposal.capacity, rescueSummary, schedule]);

  useEffect(() => {
    if (dataLoading || fingerprintPrompted.current) return;
    fingerprintPrompted.current = true;
    if (!preference && !isDemo) {
      setWorkspaceView("fingerprint");
      return;
    }
    if (preference?.onboarding_complete === false) setWorkspaceView("fingerprint");
  }, [dataLoading, isDemo, preference]);

  useEffect(() => {
    if (!preference) return;
    setDayStart(preference.day_start_time || "04:00");
    setDayEnd(preference.day_end_time || "23:00");
  }, [preference?.id]);

  useEffect(() => {
    setSelectedVariant(planRecommendation.id);
    setApproved(false);
  }, [planningDate, planRecommendation.id]);

  useEffect(() => {
    setSchedule((current) => {
      if (executing) return current;
      return proposal.schedule;
    });
    setApproved(false);
    setEditing(false);
  }, [proposal]);

  useEffect(() => {
    if (!showEveningPrompt || !("Notification" in window) || window.Notification.permission !== "granted") return;
    const notificationKey = `bakoor-evening-notification-${tomorrowDate}`;
    if (window.sessionStorage.getItem(notificationKey)) return;
    new window.Notification(t(language, "eveningNotificationTitle"), { body: t(language, "eveningNotificationBody") });
    window.sessionStorage.setItem(notificationKey, "true");
  }, [language, showEveningPrompt, tomorrowDate]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const moveBlock = (id, nextStart) => {
    setSchedule((current) => current.map((block) => block.id === id
      ? { ...block, start: nextStart, end: nextStart + block.duration }
      : block
    ).sort((a, b) => a.start - b.start));
  };

  const resetProposal = () => {
    setSchedule(proposal.schedule);
    setEditing(false);
    setApproved(false);
    setMessage(t(language, "resetDone"));
  };

  const savePreference = async (changes) => {
    if (preference?.id) return onUpdatePreference(preference.id, changes);
    return onAddPreference({
      display_name: user?.full_name || user?.name || user?.email || t(language, "bakoorUser"),
      language,
      city: "Cairo",
      country: "Egypt",
      timezone: "Africa/Cairo",
      calculation_method: 5,
      theme,
      onboarding_complete: false,
      evening_planning_enabled: true,
      evening_planning_offset_minutes: 30,
      ...changes,
    });
  };

  const saveFingerprint = async (payload) => {
    fingerprintPrompted.current = true;
    await savePreference(payload);
    setDayStart(payload.day_start_time || "04:00");
    setDayEnd(payload.day_end_time || "23:00");
    setSelectedVariant(recommendPlanVariant({ profile: payload, reviews, date: todayDate }).id);
    setPlanningDate(todayDate);
    setStep(1);
    setExecuting(false);
    setWorkspaceView("planner");
    setMessage(t(language, "fingerprintSaved"));
  };

  const approvePlan = async () => {
    setApproved(true);
    setEditing(false);
    try {
      await savePreference({ last_planned_date: planningDate, last_plan_variant: selectedVariant });
    } catch {
      setMessage(t(language, "preferenceSaveError"));
    }
    if (isFuturePlan) {
      setExecuting(false);
      setMessage(t(language, "tomorrowApproved"));
      return;
    }
    setExecuting(true);
    setMessage(t(language, "approvedDone"));
  };

  const switchPlanningDate = (date) => {
    setPlanningDate(date);
    setSelectedVariant("balanced");
    setStep(1);
    setExecuting(false);
    setApproved(false);
    setEditing(false);
    setCompletedIds(new Set());
    setActualByBlock({});
    setRescueSummary(null);
  };

  const toggleEveningReminder = async () => {
    const nextValue = !reminderEnabled;
    if (nextValue && "Notification" in window && window.Notification.permission === "default") {
      await window.Notification.requestPermission();
    }
    try {
      await savePreference({ evening_planning_enabled: nextValue });
      setMessage(t(language, nextValue ? "reminderEnabled" : "reminderDisabled"));
    } catch {
      setMessage(t(language, "preferenceSaveError"));
    }
  };

  const acceptSuggestion = async (suggestion) => {
    setAcceptingSuggestion(suggestion.key);
    const source = suggestion.source;
    try {
      await onAddTask({
        title: source.title,
        description: source.description || "",
        status: "planned",
        category: source.category || "personal",
        priority: source.priority || "important",
        difficulty: source.difficulty || "medium",
        energy_required: source.energy_required || "medium",
        scheduled_date: planningDate,
        duration_minutes: suggestion.suggestedDuration,
        minimum_version: source.minimum_version || "",
        minimum_duration_minutes: source.minimum_duration_minutes || undefined,
        is_deep_work: Boolean(source.is_deep_work),
        suggested_from_task_id: source.id,
        recurrence_key: suggestion.key,
      });
      setMessage(t(language, "suggestionAdded", { title: localizeTitle(source.title, language) }));
    } catch {
      setMessage(t(language, "suggestionAddError"));
    } finally {
      setAcceptingSuggestion("");
    }
  };

  const submitDailyReview = async (payload, planTomorrow) => {
    const reviewPayload = { ...payload, review_date: planningDate };
    if (reviewForDate?.id) await onUpdateReview(reviewForDate.id, reviewPayload);
    else await onAddReview(reviewPayload);
    setReviewOpen(false);
    setMessage(t(language, "reviewSaved"));
    if (planTomorrow) switchPlanningDate(tomorrowDate);
  };

  const setBlockCompleted = (id, completed) => {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (completed) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleComplete = (blockOrId) => {
    const id = typeof blockOrId === "string" ? blockOrId : blockOrId.id;
    const block = typeof blockOrId === "string" ? schedule.find((item) => item.id === id) : blockOrId;
    if (!block) return;
    if (completedIds.has(id)) {
      setBlockCompleted(id, false);
      return;
    }
    if (block.sourceHabitId) {
      const habit = habits.find((item) => item.id === block.sourceHabitId);
      if (habit) {
        setHabitCheckIn({ habit, blockId: id, defaultDuration: block.duration, logDate: planningDate });
        return;
      }
    }
    if (block.kind === "task" && block.sourceId && !actualByBlock[id]) {
      setActualTimeCheckIn(block);
      return;
    }
    setBlockCompleted(id, true);
  };

  const completeTaskWithActual = async (block, actualMinutes) => {
    setActualByBlock((current) => ({ ...current, [block.id]: actualMinutes }));
    setBlockCompleted(block.id, true);
    if (!block.sourceId) return;
    const task = tasks.find((item) => item.id === block.sourceId);
    if (!task) return;
    try {
      await onUpdateTask(task.id, { actual_minutes: Number(task.actual_minutes || 0) + actualMinutes });
      const ratio = actualMinutes / Math.max(1, block.duration);
      const resultKey = ratio > 1.2 ? "estimateUnder" : ratio < 0.8 ? "estimateOver" : "estimateAccurate";
      setMessage(t(language, resultKey));
    } catch {
      setMessage(t(language, "actualSaveError"));
    }
  };

  const completeFocusSession = async (blockId, actualMinutes) => {
    const block = schedule.find((item) => item.id === blockId);
    if (block?.sourceHabitId) {
      setActualByBlock((current) => ({ ...current, [blockId]: actualMinutes }));
      const habit = habits.find((item) => item.id === block.sourceHabitId);
      if (habit) setHabitCheckIn({ habit, blockId, defaultDuration: actualMinutes, logDate: planningDate });
      return;
    }
    if (block) await completeTaskWithActual(block, actualMinutes);
  };

  const recoverySuggestions = recoveringBlock
    ? buildRecoverySuggestions(recoveringBlock, schedule, timeToMinutes(dayEnd))
    : null;

  const recoverTask = async (choice) => {
    if (!recoveringBlock || !recoverySuggestions) return;
    if (choice === "tomorrow") {
      try {
        await onUpdateTask(recoveringBlock.sourceId, {
          status: "deferred",
          scheduled_date: getTomorrowDate(),
          start_time: "",
          end_time: "",
        });
        setSchedule((current) => current.filter((block) => block.sourceId !== recoveringBlock.sourceId));
        setMessage(t(language, "movedTomorrow", { title: recoveringBlock.title }));
      } catch {
        setMessage(t(language, "recoveryError"));
      } finally {
        setRecoveringBlock(null);
      }
      return;
    }

    const nextStart = choice === "afterPrayer" ? recoverySuggestions.afterPrayer : recoverySuggestions.nearest;
    if (nextStart === null) return;
    setSchedule((current) => current.map((block) => block.id === recoveringBlock.id
      ? {
        ...block,
        start: nextStart,
        end: nextStart + block.duration,
        recovered: true,
        placementReason: t(language, "reasonRecovered"),
      }
      : block
    ).sort((a, b) => a.start - b.start));
    setMessage(t(language, "recoveredAt", { title: recoveringBlock.title, time: minutesToTime(nextStart) }));
    setRecoveringBlock(null);
  };

  const rescueDay = ({ energy, useMinimum }) => {
    const now = new Date();
    const result = rescueRemainingDay({
      schedule,
      tasks: planningTasks,
      completedIds,
      currentMinute: now.getHours() * 60 + now.getMinutes(),
      dayStart: timeToMinutes(dayStart),
      dayEnd: timeToMinutes(dayEnd),
      currentEnergy: energy,
      useMinimum,
      language,
    });
    setSchedule(result.schedule);
    setCurrentEnergy(energy);
    setRescueSummary(result);
    setRescueDayOpen(false);
    setMessage(t(language, "rescueApplied", { count: result.changedCount, minimum: result.minimumCount }));
  };

  const submitHabitResult = async (payload) => {
    const existing = habitLogs.find((log) => log.habit_id === payload.habit_id && log.log_date === payload.log_date);
    if (existing?.id) await onUpdateHabitLog(existing.id, payload);
    else await onAddHabitLog(payload);
    const habit = habits.find((item) => item.id === payload.habit_id);
    if (habit?.id) {
      await onUpdateHabit(habit.id, {
        completed_today: payload.log_date === todayDate,
        completion_count: Number(habit.completion_count || 0) + (existing ? 0 : 1),
      });
    }
    if (habitCheckIn?.blockId) {
      setCompletedIds((current) => new Set([...current, habitCheckIn.blockId]));
      setActualByBlock((current) => ({ ...current, [habitCheckIn.blockId]: Number(payload.actual_duration_minutes || habitCheckIn.defaultDuration || 0) }));
    }
    setMessage(t(language, "habitResultSaved"));
  };

  const stepCopy = {
    1: ["prepareKicker", "prepareTitle", "prepareDescription"],
    2: ["reviewKicker", "reviewTitle", "reviewDescription"],
    3: ["planKicker", "planTitle", "planDescription"],
  }[step];

  return (
    <div className="planner-app" dir={isArabic ? "rtl" : "ltr"}>
      <header className="planner-topbar">
        <BakoorLogo language={language} />
        <div className="planner-date">
          {workspaceView === "planner" ? <CalendarDays size={18} /> : workspaceView === "habits" ? <Repeat2 size={18} /> : <Fingerprint size={18} />}
          <span><strong>{t(language, workspaceView === "planner" ? (planningDate === todayDate ? "todayPath" : "tomorrowPath") : workspaceView === "habits" ? "navHabits" : "fingerprintShort")}</strong><small>{workspaceView === "planner" ? formatDate(language, planningDate) : workspaceView === "habits" ? t(language, "weeklyContinuity") : t(language, "fingerprintKicker")}</small></span>
        </div>
        <div className="planner-top-actions">
          <span className="location-pill"><MapPin size={14} /> {preference?.city || t(language, "cairo")}</span>
          <button className="language-button" type="button" onClick={() => onLanguageChange(isArabic ? "en" : "ar")} title={isArabic ? "Switch to English" : "التبديل إلى العربية"}>
            <Languages size={16} /> {isArabic ? "EN" : "ع"}
          </button>
          <button className="planner-icon-button" type="button" onClick={() => onThemeChange(theme === "night" ? "day" : "night")} title={t(language, "switchTheme")}>
            {theme === "night" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="planner-icon-button" type="button" onClick={onExit} title={t(language, "logout")}><LogOut size={18} /></button>
        </div>
      </header>

      {isDemo && <div className="planner-demo-banner">{t(language, "demoBanner")}</div>}
      <nav className="workspace-nav" aria-label={t(language, "planningSession")}>
        <button type="button" className={workspaceView === "planner" ? "active" : ""} aria-current={workspaceView === "planner" ? "page" : undefined} onClick={() => setWorkspaceView("planner")}><CalendarDays size={17} />{t(language, "navDayPath")}</button>
        <button type="button" className={workspaceView === "habits" ? "active" : ""} aria-current={workspaceView === "habits" ? "page" : undefined} onClick={() => setWorkspaceView("habits")}><Repeat2 size={17} />{t(language, "navHabits")}</button>
        <button type="button" className={workspaceView === "fingerprint" ? "active" : ""} aria-current={workspaceView === "fingerprint" ? "page" : undefined} onClick={() => setWorkspaceView("fingerprint")}><Fingerprint size={17} />{t(language, "navFingerprint")}</button>
      </nav>
      {workspaceView === "planner" && showEveningPrompt && (
        <div className="evening-planning-prompt">
          <span><Sunset size={17} /><strong>{t(language, "eveningPromptTitle")}</strong><small>{t(language, "eveningPromptDescription")}</small></span>
          <button type="button" onClick={() => switchPlanningDate(tomorrowDate)}>{t(language, "prepareTomorrowNow")} {isArabic ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</button>
        </div>
      )}
      {workspaceView === "fingerprint" ? (
        <DayFingerprint
          key={preference?.id || "new-fingerprint"}
          preference={preference}
          language={language}
          prayerTimes={prayerData.timings}
          onSave={saveFingerprint}
          onOpenPlanner={() => { setWorkspaceView("planner"); setPlanningDate(todayDate); setExecuting(false); setStep(1); }}
        />
      ) : workspaceView === "habits" ? (
        <HabitsView
          habits={habits}
          logs={habitLogs}
          language={language}
          onAddHabit={onAddHabit}
          onUpdateHabit={onUpdateHabit}
          onCheckIn={(habit) => setHabitCheckIn({ habit, logDate: todayDate, defaultDuration: habit.duration_minutes })}
          onOpenPlanner={() => { setWorkspaceView("planner"); setPlanningDate(todayDate); setExecuting(false); setStep(1); }}
        />
      ) : !executing ? (
        <>
          <Stepper language={language} step={step} />
          <main className="planner-main wizard-main">
            <PlanningSessionBar
              language={language}
              targetDate={planningDate}
              todayDate={todayDate}
              tomorrowDate={tomorrowDate}
              reminderEnabled={reminderEnabled}
              reminderTime={reminderTime}
              onDateChange={switchPlanningDate}
              onToggleReminder={toggleEveningReminder}
            />
            <section className="wizard-intro">
              <span className="section-kicker">{t(language, stepCopy[0])}</span>
              <h1>{t(language, stepCopy[1])}</h1>
              <p>{t(language, stepCopy[2])}</p>
            </section>

            {dataError && <div className="planner-alert" role="alert">{dataError} <button type="button" onClick={onReload}>{t(language, "reload")}</button></div>}

            {step === 1 && (
              <>
                <TaskSuggestions language={language} suggestions={taskSuggestions} acceptingKey={acceptingSuggestion} onAccept={acceptSuggestion} />
                <div className="prepare-layout">
                  <DaySetupPanel
                    language={language}
                    dayStart={dayStart}
                    dayEnd={dayEnd}
                    onDayStartChange={setDayStart}
                    onDayEndChange={setDayEnd}
                    prayerData={prayerData}
                  />
                  <TaskComposer language={language} targetDate={planningDate} tasks={tasks} blocks={blocks} onAddTask={onAddTask} onAddBlock={onAddBlock} onUpdateTask={onUpdateTask} />
                </div>
                <footer className="wizard-actions prepare-actions">
                  <span>{activeTasks.length + fixedBlocks.length} {t(language, "blocks")}</span>
                  <button className="planner-primary" type="button" disabled={!hasEntries || !validDayBounds} onClick={() => setStep(2)}>
                    {t(language, "continueReview")} <ContinueIcon size={18} />
                  </button>
                </footer>
              </>
            )}

            {step === 2 && <ReviewPanel language={language} targetDate={planningDate} tasks={planningTasks} blocks={planningBlocks} onBack={() => setStep(1)} onContinue={() => { resetProposal(); setStep(3); }} />}

            {step === 3 && (
              <DayPlanPanel
                language={language}
                schedule={schedule}
                proposal={proposal}
                variants={proposalVariants}
                recommendation={planRecommendation}
                selectedVariant={selectedVariant}
                isFuture={isFuturePlan}
                dayStart={dayStart}
                dayEnd={dayEnd}
                editing={editing}
                approved={approved}
                dataLoading={dataLoading}
                onMove={moveBlock}
                onMessage={setMessage}
                onApprove={approvePlan}
                onVariantChange={(variant) => { setSelectedVariant(variant); setApproved(false); setEditing(false); }}
                onToggleEditing={() => { setEditing((value) => !value); setApproved(false); }}
                onReset={resetProposal}
                onBack={() => setStep(2)}
              />
            )}
          </main>
        </>
      ) : (
        <ExecutionView
          schedule={schedule}
          capacity={executionCapacity}
          dayStart={dayStart}
          dayEnd={dayEnd}
          language={language}
          completedIds={completedIds}
          actualByBlock={actualByBlock}
          currentEnergy={currentEnergy}
          rescueSummary={rescueSummary}
          reviewed={Boolean(reviewForDate)}
          onToggleComplete={toggleComplete}
          onFocus={setFocusedBlock}
          onRecover={setRecoveringBlock}
          onRescueDay={() => setRescueDayOpen(true)}
          onReview={() => setReviewOpen(true)}
          onEditPlan={() => { setExecuting(false); setStep(3); }}
        />
      )}

      {message && <div className="planner-toast" role="status"><Check size={16} /> {message}</div>}
      {focusedBlock && (
        <FocusSession
          key={focusedBlock.id}
          block={focusedBlock}
          language={language}
          onClose={() => setFocusedBlock(null)}
          onComplete={completeFocusSession}
        />
      )}
      {actualTimeCheckIn && (
        <ActualTimeDialog
          block={actualTimeCheckIn}
          language={language}
          onClose={() => setActualTimeCheckIn(null)}
          onSave={async (actualMinutes) => {
            const block = actualTimeCheckIn;
            setActualTimeCheckIn(null);
            await completeTaskWithActual(block, actualMinutes);
          }}
          onSkip={() => {
            setBlockCompleted(actualTimeCheckIn.id, true);
            setActualTimeCheckIn(null);
          }}
        />
      )}
      {recoveringBlock && recoverySuggestions && (
        <RecoveryDialog
          block={recoveringBlock}
          language={language}
          suggestions={recoverySuggestions}
          onClose={() => setRecoveringBlock(null)}
          onSelect={recoverTask}
        />
      )}
      {rescueDayOpen && (
        <RescueDayDialog
          schedule={schedule}
          completedIds={completedIds}
          currentEnergy={currentEnergy}
          language={language}
          onClose={() => setRescueDayOpen(false)}
          onApply={rescueDay}
        />
      )}
      {reviewOpen && (
        <DailyReviewDialog
          language={language}
          schedule={schedule}
          completedIds={completedIds}
          actualByBlock={actualByBlock}
          existingReview={reviewForDate}
          onClose={() => setReviewOpen(false)}
          onSubmit={submitDailyReview}
        />
      )}
      {habitCheckIn && (
        <HabitCheckInDialog
          habit={habitCheckIn.habit}
          logDate={habitCheckIn.logDate}
          defaultDuration={habitCheckIn.defaultDuration}
          existingLog={habitLogs.find((log) => log.habit_id === habitCheckIn.habit.id && log.log_date === habitCheckIn.logDate)}
          language={language}
          onClose={() => setHabitCheckIn(null)}
          onSubmit={submitHabitResult}
        />
      )}
    </div>
  );
}
