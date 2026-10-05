import { useEffect, useMemo, useState } from "react";
import { fallbackPrayerTimes } from "@/data/demoData";

const prayerLabels = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

function cleanTime(value) {
  return String(value || "").match(/\d{1,2}:\d{2}/)?.[0] || "00:00";
}

function toMinutes(value) {
  const [hour, minute] = cleanTime(value).split(":").map(Number);
  return hour * 60 + minute;
}

function formatCountdown(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest} د`;
  return `${hours} س ${rest} د`;
}

export function usePrayerTimes({ city = "Cairo", country = "Egypt", method = 5, date } = {}) {
  const [timings, setTimings] = useState(fallbackPrayerTimes);
  const [hijriDate, setHijriDate] = useState("10 محرم 1448");
  const [source, setSource] = useState("fallback");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ city, country, method: String(method) });
    const apiDate = date ? String(date).split("-").reverse().join("-") : "";
    const endpoint = apiDate ? `timingsByCity/${apiDate}` : "timingsByCity";

    fetch(`https://api.aladhan.com/v1/${endpoint}?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Prayer times unavailable");
        return response.json();
      })
      .then((payload) => {
        const apiTimings = payload?.data?.timings;
        if (!apiTimings) return;
        setTimings({
          Fajr: cleanTime(apiTimings.Fajr),
          Sunrise: cleanTime(apiTimings.Sunrise),
          Dhuhr: cleanTime(apiTimings.Dhuhr),
          Asr: cleanTime(apiTimings.Asr),
          Maghrib: cleanTime(apiTimings.Maghrib),
          Isha: cleanTime(apiTimings.Isha),
        });
        const hijri = payload?.data?.date?.hijri;
        if (hijri) setHijriDate(`${hijri.day} ${hijri.month?.ar || hijri.month?.en} ${hijri.year}`);
        setSource("live");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setSource("fallback");
      });

    return () => controller.abort();
  }, [city, country, method, date]);

  const prayers = useMemo(
    () => ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((key) => ({
      key,
      label: prayerLabels[key],
      time: cleanTime(timings[key]),
    })),
    [timings]
  );

  const nextPrayer = useMemo(() => {
    const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const upcoming = prayers.find((prayer) => toMinutes(prayer.time) > current);
    if (upcoming) {
      return { ...upcoming, minutesAway: toMinutes(upcoming.time) - current, isTomorrow: false };
    }
    const fajr = prayers[0];
    return { ...fajr, minutesAway: 24 * 60 - current + toMinutes(fajr.time), isTomorrow: true };
  }, [now, prayers]);

  return {
    prayers,
    timings,
    hijriDate,
    source,
    nextPrayer: { ...nextPrayer, countdown: formatCountdown(nextPrayer.minutesAway) },
  };
}
