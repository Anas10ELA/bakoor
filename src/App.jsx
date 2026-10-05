import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import { BakoorMark } from "@/components/BakoorLogo";
import { initialDemoState } from "@/data/demoData";
import { t } from "@/lib/i18n";

const DEMO_STORAGE_KEY = "bakoor-demo-state-v5";
const DEMO_SESSION_KEY = "bakoor-demo-session";
const THEME_STORAGE_KEY = "bakoor-theme";
const LANGUAGE_STORAGE_KEY = "bakoor-language";

function getStoredDemoState() {
  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return initialDemoState;
    const parsed = JSON.parse(stored);
    return {
      ...initialDemoState,
      ...parsed,
      tasks: parsed.tasks || initialDemoState.tasks,
      blocks: parsed.blocks || initialDemoState.blocks,
      habits: parsed.habits || [],
      habitLogs: parsed.habitLogs || [],
      goals: parsed.goals || [],
      reviews: parsed.reviews || [],
      preferences: parsed.preferences || initialDemoState.preferences,
    };
  } catch {
    return initialDemoState;
  }
}

function resolveTheme(preference) {
  if (preference === "day") return "day";
  if (preference === "night") return "night";
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  }
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? "night" : "day";
}

function localRecord(data) {
  return {
    ...data,
    id: data.id || (window.crypto?.randomUUID?.() ?? `local-${Date.now()}`),
    created_date: data.created_date || new Date().toISOString(),
  };
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [dataState, setDataState] = useState(initialDemoState);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [theme, setTheme] = useState(() => window.localStorage.getItem(THEME_STORAGE_KEY) || "auto");
  const [language, setLanguage] = useState(() => window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "ar");

  useEffect(() => {
    const queryDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    const storedDemo = window.sessionStorage.getItem(DEMO_SESSION_KEY) === "true";

    if (queryDemo || storedDemo) {
      setIsDemo(true);
      setDataState(getStoredDemoState());
      setBooting(false);
      return;
    }

    const hasAccessToken = Boolean(
      window.localStorage.getItem("base44_access_token") || window.localStorage.getItem("token")
    );

    if (!hasAccessToken) {
      setBooting(false);
      return;
    }

    base44.auth
      .me()
      .then(setUser)
      .catch(() => {
        window.localStorage.removeItem("base44_access_token");
        window.localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setBooting(false));

    return () => base44.cleanup();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = resolveTheme(theme);
    document.documentElement.style.colorScheme = resolveTheme(theme) === "night" ? "dark" : "light";

    if (theme !== "auto" && theme !== "system") return undefined;
    const timer = window.setInterval(() => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    if (!isDemo) return;
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(dataState));
  }, [dataState, isDemo]);

  const loadRemoteData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError("");
    try {
      const [tasks, blocks, habits, habitLogs, goals, reviews, preferences] = await Promise.all([
        base44.entities.Task.list("start_time", 200, 0),
        base44.entities.TimeBlock.list("start_time", 200, 0),
        base44.entities.Habit.list("-created_date", 100, 0),
        base44.entities.HabitLog.list("-log_date", 500, 0),
        base44.entities.Goal.list("-created_date", 50, 0),
        base44.entities.DailyReview.list("-review_date", 60, 0),
        base44.entities.UserPreference.list("-created_date", 5, 0),
      ]);
      setDataState({ tasks, blocks, habits, habitLogs, goals, reviews, preferences });
    } catch (error) {
      setDataError(error?.message || (language === "ar" ? "تعذر تحميل بيانات اليوم." : "Your day data could not be loaded."));
    } finally {
      setDataLoading(false);
    }
  }, [user, language]);

  useEffect(() => {
    loadRemoteData();
  }, [loadRemoteData]);

  const collectionConfig = useMemo(
    () => ({
      task: { key: "tasks", entity: "Task" },
      block: { key: "blocks", entity: "TimeBlock" },
      habit: { key: "habits", entity: "Habit" },
      habitLog: { key: "habitLogs", entity: "HabitLog" },
      goal: { key: "goals", entity: "Goal" },
      review: { key: "reviews", entity: "DailyReview" },
      preference: { key: "preferences", entity: "UserPreference" },
    }),
    []
  );

  const addRecord = async (type, payload) => {
    const config = collectionConfig[type];
    if (!config) return null;
    const created = isDemo
      ? localRecord(payload)
      : await base44.entities[config.entity].create(payload);
    setDataState((current) => ({ ...current, [config.key]: [...(current[config.key] || []), created] }));
    return created;
  };

  const updateRecord = async (type, id, changes) => {
    const config = collectionConfig[type];
    if (!config) return null;
    const updated = isDemo
      ? { ...(dataState[config.key] || []).find((item) => item.id === id), ...changes }
      : await base44.entities[config.entity].update(id, changes);
    setDataState((current) => ({
      ...current,
      [config.key]: (current[config.key] || []).map((item) => (item.id === id ? { ...item, ...updated } : item)),
    }));
    return updated;
  };

  const enterDemo = () => {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, "true");
    setDataState(getStoredDemoState());
    setIsDemo(true);
  };

  const exitApp = () => {
    if (isDemo) {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemo(false);
      setDataState(initialDemoState);
      return;
    }
    base44.auth.logout(window.location.origin);
  };

  if (booting) {
    return (
      <div className="app-boot" dir={language === "ar" ? "rtl" : "ltr"}>
        <BakoorMark className="boot-mark" />
        <Loader2 className="spin" size={22} />
        <span>{t(language, "loading")}</span>
      </div>
    );
  }

  if (!user && !isDemo) {
    return <AuthScreen language={language} onLanguageChange={setLanguage} onAuthenticated={setUser} onDemo={enterDemo} />;
  }

  return (
    <Dashboard
      user={user}
      isDemo={isDemo}
      tasks={dataState.tasks}
      blocks={dataState.blocks}
      habits={dataState.habits}
      habitLogs={dataState.habitLogs || []}
      goals={dataState.goals}
      reviews={dataState.reviews || []}
      preferences={dataState.preferences || []}
      dataLoading={dataLoading}
      dataError={dataError}
      theme={theme}
      language={language}
      onLanguageChange={setLanguage}
      onThemeChange={setTheme}
      onExit={exitApp}
      onAddTask={(payload) => addRecord("task", payload)}
      onUpdateTask={(id, changes) => updateRecord("task", id, changes)}
      onAddBlock={(payload) => addRecord("block", payload)}
      onAddHabit={(payload) => addRecord("habit", payload)}
      onUpdateHabit={(id, changes) => updateRecord("habit", id, changes)}
      onAddHabitLog={(payload) => addRecord("habitLog", payload)}
      onUpdateHabitLog={(id, changes) => updateRecord("habitLog", id, changes)}
      onAddReview={(payload) => addRecord("review", payload)}
      onUpdateReview={(id, changes) => updateRecord("review", id, changes)}
      onAddPreference={(payload) => addRecord("preference", payload)}
      onUpdatePreference={(id, changes) => updateRecord("preference", id, changes)}
      onReload={loadRemoteData}
    />
  );
}
