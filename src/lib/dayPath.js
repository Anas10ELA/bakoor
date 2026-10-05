import { localizeMinimumVersion, localizeTitle, t } from "@/lib/i18n";
import { inferTaskIcon } from "@/lib/taskIcons";

const energyRank = { low: 1, medium: 2, high: 3 };

export const prayerDurations = {
  Fajr: 45,
  Dhuhr: 40,
  Asr: 40,
  Maghrib: 35,
  Isha: 40,
};

const prayerLabelKeys = {
  Fajr: "prayerFajr",
  Dhuhr: "prayerDhuhr",
  Asr: "prayerAsr",
  Maghrib: "prayerMaghrib",
  Isha: "prayerIsha",
};

export function timeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(value) {
  const safe = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function getLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTomorrowDate(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDate(tomorrow);
}

export function taskBelongsToDate(task, date, today = getLocalDate()) {
  if (["completed", "cancelled"].includes(task.status)) return false;
  if (!task.scheduled_date) return true;
  if (task.scheduled_date === date) return true;
  return date === today && task.scheduled_date < today && task.status !== "deferred";
}

export function normalizeRecurrenceKey(title) {
  return String(title || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function weekdayForDate(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return new Date(year, month - 1, day, 12).getDay();
}

export function habitBelongsToDate(habit, date) {
  if (habit.active === false) return false;
  const repeatDays = Array.isArray(habit.repeat_days) && habit.repeat_days.length
    ? habit.repeat_days.map(Number)
    : [0, 1, 2, 3, 4, 5, 6];
  return repeatDays.includes(weekdayForDate(date));
}

export function buildHabitTasks(habits = [], habitLogs = [], date = getLocalDate(), language = "ar") {
  const loggedHabitIds = new Set(
    habitLogs.filter((log) => log.log_date === date).map((log) => log.habit_id)
  );
  return habits
    .filter((habit) => habitBelongsToDate(habit, date) && !loggedHabitIds.has(habit.id))
    .map((habit) => {
      const amount = Number(habit.amount || 1);
      const minimumAmount = Math.min(amount, Number(habit.minimum_amount || 1));
      const unit = t(language, `habitUnit_${habit.unit}`);
      return {
        id: `habit-${habit.id}-${date}`,
        title: `${habit.title} · ${amount} ${unit}`,
        description: t(language, "habitScheduledDescription"),
        status: "planned",
        category: habit.category || "personal",
        priority: habit.category === "worship" ? "essential" : "important",
        difficulty: habit.energy_required === "high" ? "hard" : habit.energy_required === "medium" ? "medium" : "light",
        energy_required: habit.energy_required || "low",
        scheduled_date: date,
        duration_minutes: Number(habit.duration_minutes || 20),
        minimum_version: t(language, "habitMinimumTarget", { value: minimumAmount, unit }),
        minimum_duration_minutes: Number(habit.minimum_duration_minutes || 5),
        preferred_anchor: habit.preferred_anchor || "flexible",
        recurrence_key: `habit-${habit.id}`,
        source_habit_id: habit.id,
        habit_target_amount: amount,
        habit_minimum_amount: minimumAmount,
        habit_unit: habit.unit,
        is_habit: true,
        is_deep_work: false,
      };
    });
}

function profileRange(id, title, start, end, date, language, blockType = "fixed") {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 5 || start < 0 || end > 1440) return null;
  return {
    id: `profile-${id}-${date}`,
    title,
    subtitle: t(language, "fingerprintFixedSubtitle"),
    block_type: blockType,
    scheduled_date: date,
    start_time: minutesToTime(start),
    end_time: minutesToTime(end),
    duration_minutes: end - start,
    is_locked: true,
    generated_by: "profile",
    color_key: "profile",
  };
}

function placeProfileReservation({ id, title, start, duration, direction = "forward", date, language }, occupied, dayStart, dayEnd) {
  for (let offset = 0; offset <= 360; offset += 5) {
    const candidates = direction === "backward"
      ? [start - offset, start + offset]
      : [start + offset, start - offset];
    for (const candidate of candidates) {
      const end = candidate + duration;
      if (candidate < dayStart || end > dayEnd) continue;
      if (occupied.some((block) => overlaps(candidate, end, block))) continue;
      return profileRange(id, title, candidate, end, date, language, "profile");
    }
  }
  return null;
}

export function buildProfileTimeBlocks(profile = {}, timings = {}, date = getLocalDate(), language = "ar") {
  if (!profile || profile.onboarding_complete === false) return [];
  const sacred = buildSacredBlocks(timings, language);
  const dayStart = timeToMinutes(profile.day_start_time || "04:00");
  const dayEnd = timeToMinutes(profile.day_end_time || "23:00");
  const reservations = [];
  const occupied = [...sacred];
  const addReservation = (options) => {
    const block = placeProfileReservation({ ...options, date, language }, occupied, dayStart, dayEnd);
    if (!block) return;
    reservations.push(block);
    occupied.push({ start: timeToMinutes(block.start_time), end: timeToMinutes(block.end_time) });
  };

  const commitmentType = profile.commitment_type || "none";
  const commitmentStart = Math.max(dayStart, timeToMinutes(profile.commitment_start_time || "08:00"));
  const commitmentEnd = Math.min(dayEnd, timeToMinutes(profile.commitment_end_time || "15:00"));
  const commute = Math.max(0, Number(profile.commute_minutes || 0));
  if (commitmentType !== "none" && commitmentEnd > commitmentStart && commute > 0) {
    addReservation({ id: "commute-to", title: t(language, "fingerprintCommuteTo"), start: commitmentStart - commute, duration: commute, direction: "backward" });
    addReservation({ id: "commute-from", title: t(language, "fingerprintCommuteFrom"), start: commitmentEnd, duration: commute });
  }

  [
    ["breakfast", "fingerprintBreakfast"],
    ["lunch", "fingerprintLunch"],
    ["dinner", "fingerprintDinner"],
  ].forEach(([meal, labelKey]) => {
    if (!profile[`reserve_${meal}`]) return;
    addReservation({
      id: meal,
      title: t(language, labelKey),
      start: timeToMinutes(profile[`${meal}_time`]),
      duration: Math.max(10, Number(profile[`${meal}_duration_minutes`] || 30)),
    });
  });

  if (profile.reserve_family_time) {
    addReservation({
      id: "family",
      title: t(language, "fingerprintFamilyBlock"),
      start: timeToMinutes(profile.family_time || "19:00"),
      duration: Math.max(15, Number(profile.family_duration_minutes || 60)),
    });
  }

  const commitmentBlocks = [];
  if (commitmentType !== "none" && commitmentEnd > commitmentStart) {
    const blockers = occupied
      .filter((block) => block.end > commitmentStart && block.start < commitmentEnd)
      .sort((a, b) => a.start - b.start);
    let cursor = commitmentStart;
    let segment = 1;
    blockers.forEach((block) => {
      if (block.start - cursor >= 5) {
        const entry = profileRange(
          `commitment-${segment}`,
          t(language, `fingerprintCommitmentBlock_${commitmentType}`),
          cursor,
          Math.min(block.start, commitmentEnd),
          date,
          language,
          "profile"
        );
        if (entry) commitmentBlocks.push(entry);
        segment += 1;
      }
      cursor = Math.max(cursor, block.end);
    });
    if (commitmentEnd - cursor >= 5) {
      const entry = profileRange(
        `commitment-${segment}`,
        t(language, `fingerprintCommitmentBlock_${commitmentType}`),
        cursor,
        commitmentEnd,
        date,
        language,
        "profile"
      );
      if (entry) commitmentBlocks.push(entry);
    }
  }

  return [...reservations, ...commitmentBlocks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
}

export function buildTaskSuggestions(tasks = [], targetDate = getTomorrowDate(), limit = 5) {
  const targetKeys = new Set(
    tasks
      .filter((task) => taskBelongsToDate(task, targetDate))
      .map((task) => task.recurrence_key || normalizeRecurrenceKey(task.title))
  );
  const groups = new Map();

  tasks
    .filter((task) => task.status !== "cancelled" && (!task.scheduled_date || task.scheduled_date < targetDate))
    .forEach((task) => {
      const key = task.recurrence_key || normalizeRecurrenceKey(task.title);
      if (!key || targetKeys.has(key)) return;
      const current = groups.get(key) || { key, items: [] };
      current.items.push(task);
      groups.set(key, current);
    });

  return Array.from(groups.values())
    .map(({ key, items }) => {
      const sorted = [...items].sort((a, b) => String(b.scheduled_date || b.created_date || "").localeCompare(String(a.scheduled_date || a.created_date || "")));
      const latest = sorted[0];
      const measured = items.map((item) => Number(item.actual_minutes || 0)).filter((value) => value > 0);
      const learnedDuration = measured.length
        ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length / 5) * 5
        : Number(latest.duration_minutes || 30);
      return {
        key,
        source: latest,
        occurrenceCount: items.length,
        suggestedDuration: Math.max(5, learnedDuration),
      };
    })
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || String(b.source.scheduled_date || "").localeCompare(String(a.source.scheduled_date || "")))
    .slice(0, limit);
}

export function recommendPlanVariant({ profile = {}, reviews = [], date = getLocalDate() } = {}) {
  const recent = reviews
    .filter((review) => review.review_date && review.review_date < date)
    .sort((a, b) => String(b.review_date).localeCompare(String(a.review_date)))
    .slice(0, 3);
  const averageCompletion = recent.length
    ? Math.round(recent.reduce((sum, review) => sum + Number(review.completion_rate || 0), 0) / recent.length)
    : null;
  const lowEnergyDays = recent.filter((review) => review.energy_level === "low").length;
  const style = profile?.planning_style || "balanced";

  if (recent.length >= 2 && averageCompletion < 55) {
    return { id: "minimum", reasonKey: "recommendLowCompletion", averageCompletion, reviewCount: recent.length };
  }
  if (recent.length >= 2 && lowEnergyDays >= 2) {
    return { id: "minimum", reasonKey: "recommendLowEnergy", averageCompletion, reviewCount: recent.length };
  }
  if (style === "gentle") {
    return { id: "minimum", reasonKey: "recommendGentleProfile", averageCompletion, reviewCount: recent.length };
  }
  if (style === "ambitious" && recent.length >= 2 && averageCompletion >= 75) {
    return { id: "full", reasonKey: "recommendStrongHistory", averageCompletion, reviewCount: recent.length };
  }
  if (style === "ambitious") {
    return { id: "full", reasonKey: "recommendAmbitiousProfile", averageCompletion, reviewCount: recent.length };
  }
  return { id: "balanced", reasonKey: "recommendBalancedDefault", averageCompletion, reviewCount: recent.length };
}

function roundToFive(value) {
  return Math.max(5, Math.round(Number(value || 30) / 5) * 5);
}

export function buildSacredBlocks(timings = {}, language = "ar") {
  const blocks = Object.keys(prayerDurations).map((key) => {
    const start = timeToMinutes(timings[key]);
    const duration = prayerDurations[key];
    return {
      id: `prayer-${key}`,
      title: language === "ar" ? `${t(language, "prayer")} ${t(language, prayerLabelKeys[key])}` : `${t(language, prayerLabelKeys[key])} ${t(language, "prayer")}`,
      subtitle: t(language, "fromAdhan", { duration }),
      kind: "prayer",
      icon: "prayer",
      start,
      end: start + duration,
      duration,
      locked: true,
      color: "prayer",
    };
  });

  const fajr = blocks.find((block) => block.id === "prayer-Fajr");
  const asr = blocks.find((block) => block.id === "prayer-Asr");
  blocks.push(
    {
      id: "adhkar-morning",
      title: t(language, "morningAdhkarTitle"),
      subtitle: t(language, "morningFollows"),
      kind: "adhkar",
      icon: "quran",
      start: fajr.end,
      end: fajr.end + 15,
      duration: 15,
      locked: true,
      color: "worship",
    },
    {
      id: "adhkar-evening",
      title: t(language, "eveningAdhkarTitle"),
      subtitle: t(language, "eveningFollows"),
      kind: "adhkar",
      icon: "quran",
      start: asr.end,
      end: asr.end + 15,
      duration: 15,
      locked: true,
      color: "worship",
    }
  );

  return blocks.sort((a, b) => a.start - b.start);
}

function normalizeUserBlock(block, language) {
  const start = timeToMinutes(block.start_time);
  const end = timeToMinutes(block.end_time);
  return {
    id: `fixed-${block.id}`,
    sourceId: block.id,
    title: localizeTitle(block.title, language),
    subtitle: block.subtitle || t(language, "fixedByYou"),
    kind: "fixed",
    icon: inferTaskIcon(block.title, "personal", block.block_type),
    start,
    end,
    duration: Math.max(5, end - start),
    locked: true,
    color: "fixed",
    linkedTaskId: block.linked_task_id,
    linkedTaskTitle: block.linked_task_title,
    relativeOffset: Number(block.relative_offset_minutes || 0),
  };
}

function overlaps(start, end, block) {
  return start < block.end && end > block.start;
}

function freeRanges(dayStart, dayEnd, occupied) {
  const sorted = occupied
    .filter((block) => block.end > dayStart && block.start < dayEnd)
    .sort((a, b) => a.start - b.start);
  const ranges = [];
  let cursor = dayStart;
  sorted.forEach((block) => {
    if (block.start > cursor) ranges.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  });
  if (cursor < dayEnd) ranges.push({ start: cursor, end: dayEnd });
  return ranges;
}

function occupiedMinutes(dayStart, dayEnd, blocks) {
  const ranges = blocks
    .map((block) => ({ start: Math.max(dayStart, block.start), end: Math.min(dayEnd, block.end) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  if (!ranges.length) return 0;
  let total = 0;
  let current = { ...ranges[0] };
  ranges.slice(1).forEach((range) => {
    if (range.start <= current.end) {
      current.end = Math.max(current.end, range.end);
      return;
    }
    total += current.end - current.start;
    current = { ...range };
  });
  return total + current.end - current.start;
}

function energyAnchorRange(anchor, timings) {
  const fajr = timeToMinutes(timings.Fajr);
  const dhuhr = timeToMinutes(timings.Dhuhr);
  const asr = timeToMinutes(timings.Asr);
  const maghrib = timeToMinutes(timings.Maghrib);
  const isha = timeToMinutes(timings.Isha);
  const ranges = {
    after_fajr: [fajr + prayerDurations.Fajr + 15, Math.min(dhuhr - 20, fajr + 240)],
    morning: [Math.max(fajr + 150, 8 * 60), dhuhr - 20],
    after_dhuhr: [dhuhr + prayerDurations.Dhuhr, Math.min(asr - 20, dhuhr + 180)],
    after_asr: [asr + prayerDurations.Asr + 15, maghrib - 15],
    evening: [maghrib + prayerDurations.Maghrib, isha - 15],
    after_isha: [isha + prayerDurations.Isha, Math.min(1439, isha + prayerDurations.Isha + 150)],
  };
  const range = ranges[anchor];
  return range && range[1] > range[0] ? range : null;
}

function inEnergyRange(minute, range) {
  return Boolean(range && minute >= range[0] && minute < range[1]);
}

function energyAt(minute, timings, profile = {}) {
  const fajr = timeToMinutes(timings.Fajr);
  const dhuhr = timeToMinutes(timings.Dhuhr);
  const asr = timeToMinutes(timings.Asr);
  const maghrib = timeToMinutes(timings.Maghrib);
  const isha = timeToMinutes(timings.Isha);
  const peakRange = energyAnchorRange(profile.peak_energy_anchor, timings);
  const lowRange = energyAnchorRange(profile.low_energy_anchor, timings);
  if (inEnergyRange(minute, lowRange)) return "low";
  if (inEnergyRange(minute, peakRange)) return "high";
  if (peakRange) {
    if (minute >= isha + prayerDurations.Isha) return "low";
    return "medium";
  }
  if (minute >= fajr + 60 && minute < dhuhr - 20) return "high";
  if (minute >= asr + prayerDurations.Asr + 15 && minute < maghrib - 15) return "medium";
  if (minute >= isha + prayerDurations.Isha) return "low";
  return "low";
}

function linkedEarliest(task, fixedBlocks) {
  const link = fixedBlocks.find((block) =>
    (block.linkedTaskId && block.linkedTaskId === task.id) ||
    (block.linkedTaskTitle && block.linkedTaskTitle === task.title)
  );
  return link ? link.start + link.relativeOffset : null;
}

function preferredAnchorEarliest(task, timings) {
  const anchor = task.preferred_anchor;
  if (!anchor || anchor === "flexible") return null;
  const anchors = {
    after_fajr: timeToMinutes(timings.Fajr) + prayerDurations.Fajr + 15,
    morning: timeToMinutes(timings.Fajr) + prayerDurations.Fajr + 15,
    after_dhuhr: timeToMinutes(timings.Dhuhr) + prayerDurations.Dhuhr,
    after_asr: timeToMinutes(timings.Asr) + prayerDurations.Asr + 15,
    after_maghrib: timeToMinutes(timings.Maghrib) + prayerDurations.Maghrib,
    after_isha: timeToMinutes(timings.Isha) + prayerDurations.Isha,
  };
  return Number.isFinite(anchors[anchor]) ? anchors[anchor] : null;
}

function taskLearning(task, allTasks) {
  const key = task.recurrence_key || normalizeRecurrenceKey(task.title);
  const samples = allTasks
    .filter((candidate) => {
      const candidateKey = candidate.recurrence_key || normalizeRecurrenceKey(candidate.title);
      return candidateKey === key && Number(candidate.actual_minutes || 0) > 0;
    })
    .map((candidate) => Number(candidate.actual_minutes));
  if (!samples.length) return { sampleCount: 0, expectedMinutes: Number(task.duration_minutes || 30) };
  const expectedMinutes = Math.max(5, Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length / 5) * 5);
  return { sampleCount: samples.length, expectedMinutes };
}

function candidateScore(start, duration, task, timings, earliest, profile) {
  const offered = energyAt(start, timings, profile);
  const required = task.energy_required || "medium";
  const difference = energyRank[offered] - energyRank[required];
  let score = difference === 0 ? 36 : difference > 0 ? 22 : -32 * Math.abs(difference);
  const fajr = timeToMinutes(timings.Fajr);
  const dhuhrEnd = timeToMinutes(timings.Dhuhr) + prayerDurations.Dhuhr;
  const asrEnd = timeToMinutes(timings.Asr) + prayerDurations.Asr + 15;
  if (start < fajr) score -= 100;
  if (required === "high") score -= start / 120;
  if (required === "low" && start >= dhuhrEnd) score += 10;
  if (task.category === "worship" && (Math.abs(start - dhuhrEnd) <= 30 || Math.abs(start - asrEnd) <= 30)) score += 18;
  if (earliest !== null) score -= Math.abs(start - earliest) / 4;
  if (task.start_time) score -= Math.abs(start - timeToMinutes(task.start_time)) / 6;
  score -= duration / 1000;
  return score;
}

function bestStart(duration, task, occupied, timings, dayStart, dayEnd, earliest = null, profile = {}) {
  const ranges = freeRanges(dayStart, dayEnd, occupied);
  const candidates = [];
  ranges.forEach((range) => {
    const first = Math.max(range.start, earliest ?? dayStart);
    for (let start = Math.ceil(first / 5) * 5; start + duration <= range.end; start += 5) {
      candidates.push({ start, score: candidateScore(start, duration, task, timings, earliest, profile) });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.start - b.start);
  const best = candidates[0];
  if (!best) return null;
  const alternative = candidates.find((candidate) => Math.abs(candidate.start - best.start) >= 30);
  return {
    start: best.start,
    rawScore: best.score,
    alternativeStart: alternative?.start ?? null,
    alternativeDelta: alternative ? Math.max(0, Math.round(best.score - alternative.score)) : null,
  };
}

function buildDecision(task, start, offeredEnergy, earliest, profile, learning, placement, language) {
  const requiredEnergy = task.energy_required || "medium";
  const difference = energyRank[offeredEnergy] - energyRank[requiredEnergy];
  const energyMatched = difference === 0;
  const peakProtected = requiredEnergy === "high" && offeredEnergy === "high";
  const factors = [];
  let fitScore = 58;

  if (energyMatched) {
    fitScore += 20;
    factors.push(t(language, "decisionFactorEnergyMatch", { energy: t(language, requiredEnergy) }));
  } else if (difference > 0) {
    fitScore += 10;
    factors.push(t(language, "decisionFactorEnergySurplus"));
  } else {
    fitScore -= 12 * Math.abs(difference);
    factors.push(t(language, "decisionFactorEnergyCompromise"));
  }
  if (peakProtected) {
    fitScore += 8;
    factors.push(t(language, "decisionFactorPeak"));
  }
  if (earliest !== null) {
    const anchorDistance = Math.abs(start - earliest);
    fitScore += anchorDistance <= 15 ? 10 : anchorDistance <= 45 ? 6 : 2;
    factors.push(t(language, "decisionFactorAnchor"));
  }
  if (task.category === "worship") {
    fitScore += 6;
    factors.push(t(language, "decisionFactorPrayer"));
  }
  factors.push(t(language, "decisionFactorFixed"));

  if (learning.sampleCount > 0) {
    fitScore += Math.min(6, learning.sampleCount * 2);
    factors.push(t(language, "decisionFactorLearned", { value: learning.expectedMinutes, count: learning.sampleCount }));
  } else {
    factors.push(t(language, "decisionFactorEstimateNew", { value: Number(task.duration_minutes || 30) }));
  }
  if (task.__minimum) {
    fitScore += 5;
    factors.push(t(language, "decisionFactorMinimum"));
  }

  return {
    fitScore: Math.max(35, Math.min(98, Math.round(fitScore))),
    confidence: learning.sampleCount >= 3 ? "high" : learning.sampleCount > 0 ? "medium" : "profile",
    factors,
    energyMatched,
    peakProtected,
    requiredEnergy,
    offeredEnergy,
    userEstimate: Number(task.duration_minutes || 30),
    learnedEstimate: learning.expectedMinutes,
    learningSamples: learning.sampleCount,
    alternativeStart: placement.alternativeStart,
    alternativeDelta: placement.alternativeDelta,
    profileAnchor: profile?.peak_energy_anchor || "after_fajr",
  };
}

function taskChunks(task, profile = {}) {
  const total = roundToFive(task.duration_minutes);
  const sessionLimit = Math.max(30, Math.min(120, roundToFive(profile.deep_work_session_minutes || 90)));
  if (!task.is_deep_work || total <= sessionLimit) return [total];
  const chunks = [];
  let remaining = total;
  while (remaining > 0) {
    const size = Math.min(sessionLimit, remaining);
    chunks.push(size);
    remaining -= size;
  }
  return chunks;
}

function placementReason(task, offeredEnergy, earliest, language) {
  if (task.is_habit && task.preferred_anchor && task.preferred_anchor !== "flexible") return t(language, "reasonHabitAnchor");
  if (earliest !== null) return t(language, "reasonLinkedBlock");
  if (task.category === "worship") return t(language, "reasonNearPrayer");
  if (task.energy_required === "high" && offeredEnergy === "high") return t(language, "reasonDeepWindow");
  if ((task.energy_required || "medium") === offeredEnergy) return t(language, "reasonEnergyMatch");
  return t(language, "reasonBestAvailable");
}

function rescuePriority(task, currentEnergy) {
  const priorityWeight = { essential: 30, important: 20, optional: 10 }[task?.priority] || 20;
  const preferredOrder = {
    low: { low: 3, medium: 2, high: 1 },
    medium: { medium: 3, low: 2, high: 1 },
    high: { high: 3, medium: 2, low: 1 },
  }[currentEnergy] || { medium: 3, low: 2, high: 1 };
  return priorityWeight + (preferredOrder[task?.energy_required || "medium"] || 1);
}

function firstRescueStart(duration, occupied, earliest, dayEnd) {
  const ranges = freeRanges(earliest, dayEnd, occupied);
  for (const range of ranges) {
    const start = Math.ceil(range.start / 5) * 5;
    if (start + duration <= range.end) return start;
  }
  return null;
}

export function rescueRemainingDay({
  schedule = [],
  tasks = [],
  completedIds = new Set(),
  currentMinute = 0,
  dayStart = 0,
  dayEnd = 1440,
  currentEnergy = "medium",
  useMinimum = false,
  language = "ar",
} = {}) {
  const completed = completedIds instanceof Set ? completedIds : new Set(completedIds);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const preserved = schedule.filter((block) => block.kind !== "task" || completed.has(block.id));
  const remainingGroups = new Map();

  schedule
    .filter((block) => block.kind === "task" && !completed.has(block.id))
    .forEach((block) => {
      const key = block.sourceId || block.id;
      const current = remainingGroups.get(key) || { key, blocks: [] };
      current.blocks.push(block);
      remainingGroups.set(key, current);
    });

  const candidates = Array.from(remainingGroups.values())
    .map((group) => ({ ...group, task: taskById.get(group.key) }))
    .sort((a, b) => rescuePriority(b.task, currentEnergy) - rescuePriority(a.task, currentEnergy));

  const occupied = preserved.map((block) => ({ ...block }));
  const planned = [];
  const unscheduled = [];
  const earliest = Math.ceil(Math.max(dayStart, currentMinute + 5) / 5) * 5;
  let minimumCount = 0;
  let savedMinutes = 0;

  candidates.forEach(({ key, blocks: groupBlocks, task }) => {
    const originalMinutes = groupBlocks.reduce((sum, block) => sum + block.duration, 0);
    const minimumDescription = task?.minimum_version?.trim()
      ? localizeMinimumVersion(task.minimum_version.trim(), language)
      : t(language, "automaticMinimum");
    const minimumMinutes = Math.min(
      originalMinutes,
      roundToFive(task?.minimum_duration_minutes || Math.min(20, originalMinutes))
    );
    const durations = useMinimum ? [minimumMinutes] : groupBlocks.map((block) => block.duration);
    let groupPlaced = 0;

    durations.forEach((duration, index) => {
      const start = firstRescueStart(duration, occupied, earliest, dayEnd);
      if (start === null) return;
      const base = groupBlocks[Math.min(index, groupBlocks.length - 1)];
      const isMinimum = useMinimum;
      const entry = {
        ...base,
        id: isMinimum ? `task-${key}-minimum` : base.id,
        start,
        end: start + duration,
        duration,
        recovered: true,
        isMinimum,
        minimumVersion: isMinimum ? minimumDescription : undefined,
        subtitle: isMinimum ? minimumDescription : t(language, "reasonEnergyRescue"),
        placementReason: isMinimum ? t(language, "reasonMinimumRescue") : t(language, "reasonEnergyRescue"),
      };
      planned.push(entry);
      occupied.push({ ...entry, end: entry.end + 5 });
      groupPlaced += duration;
    });

    const requestedMinutes = useMinimum ? minimumMinutes : originalMinutes;
    if (groupPlaced < requestedMinutes) {
      unscheduled.push({ taskId: key, title: groupBlocks[0]?.title || task?.title, duration: requestedMinutes - groupPlaced });
    }
    if (groupPlaced === 0) {
      return;
    }
    if (useMinimum) {
      minimumCount += 1;
      savedMinutes += Math.max(0, originalMinutes - groupPlaced);
    }
  });

  return {
    schedule: [...preserved, ...planned].sort((a, b) => a.start - b.start || Number(b.locked) - Number(a.locked)),
    changedCount: planned.length,
    minimumCount,
    savedMinutes,
    unscheduled,
  };
}

export function buildDayPath({
  tasks = [],
  learningTasks = tasks,
  blocks = [],
  timings = {},
  dayStart = "04:00",
  dayEnd = "23:00",
  date = getLocalDate(),
  language = "ar",
  profile = {},
} = {}) {
  const startBoundary = timeToMinutes(dayStart);
  const endBoundary = timeToMinutes(dayEnd);
  const sacred = buildSacredBlocks(timings, language);
  const fixed = blocks
    .filter((block) => block.start_time && block.end_time && block.generated_by !== "zayd" && !block.source_task_id && (!block.scheduled_date || block.scheduled_date === date))
    .map((block) => normalizeUserBlock(block, language));
  const occupied = [...sacred, ...fixed];
  const planned = [];
  const unscheduled = [];

  const activeTasks = tasks
    .filter((task) => taskBelongsToDate(task, date))
    .map((task) => ({
      task,
      earliest: linkedEarliest(task, fixed) ?? preferredAnchorEarliest(task, timings),
      learning: taskLearning(task, learningTasks),
    }))
    .sort((a, b) => {
      const linkedDifference = Number(b.earliest !== null) - Number(a.earliest !== null);
      if (linkedDifference) return linkedDifference;
      return (energyRank[b.task.energy_required] || 2) - (energyRank[a.task.energy_required] || 2) ||
        Number(Boolean(b.task.is_deep_work)) - Number(Boolean(a.task.is_deep_work));
    });

  activeTasks.forEach(({ task, earliest, learning }) => {
    const chunks = taskChunks(task, profile);
    chunks.forEach((duration, index) => {
      const placement = bestStart(duration, task, occupied, timings, startBoundary, endBoundary, index === 0 ? earliest : null, profile);
      if (placement === null) {
        unscheduled.push({ taskId: task.id, title: localizeTitle(task.title, language), duration });
        return;
      }
      const start = placement.start;
      const offeredEnergy = energyAt(start, timings, profile);
      const reason = placementReason(task, offeredEnergy, earliest, language);
      const entry = {
        id: `task-${task.id}-${index + 1}`,
        sourceId: task.id,
        title: localizeTitle(task.title, language),
        subtitle: chunks.length > 1
          ? `${t(language, "sessionOf", { current: index + 1, total: chunks.length })} · ${reason}`
          : reason,
        kind: "task",
        icon: inferTaskIcon(task.title, task.category, "task"),
        start,
        end: start + duration,
        duration,
        energy: task.energy_required || "medium",
        energyWindow: offeredEnergy,
        placementReason: reason,
        locked: false,
        color: task.energy_required || "medium",
        segment: index + 1,
        sourceHabitId: task.source_habit_id,
        habitTargetAmount: task.habit_target_amount,
        habitMinimumAmount: task.habit_minimum_amount,
        habitUnit: task.habit_unit,
        decision: buildDecision(task, start, offeredEnergy, earliest, profile, learning, placement, language),
      };
      planned.push(entry);
      occupied.push({ ...entry, end: entry.end + 5 });
    });
  });

  const schedule = [...sacred, ...fixed, ...planned].sort((a, b) => a.start - b.start || Number(b.locked) - Number(a.locked));
  const requestedMinutes = activeTasks.reduce((sum, item) => sum + roundToFive(item.task.duration_minutes), 0);
  const anchorMinutes = occupiedMinutes(startBoundary, endBoundary, [...sacred, ...fixed]);
  const availableMinutes = Math.max(0, endBoundary - startBoundary - anchorMinutes);
  const scheduledMinutes = planned.reduce((sum, block) => sum + block.duration, 0);
  const unscheduledMinutes = unscheduled.reduce((sum, item) => sum + item.duration, 0);
  const bufferMinutes = Math.max(0, availableMinutes - scheduledMinutes);
  const loadRatio = availableMinutes > 0 ? requestedMinutes / availableMinutes : requestedMinutes > 0 ? 1 : 0;
  const risk = unscheduledMinutes > 0 || loadRatio > 0.92
    ? "overloaded"
    : loadRatio > 0.72 || bufferMinutes < 90
      ? "tight"
      : "balanced";
  return {
    date,
    schedule,
    sacred,
    fixed,
    planned,
    unscheduled,
    dayStart: startBoundary,
    dayEnd: endBoundary,
    scheduledMinutes,
    capacity: {
      requestedMinutes,
      anchorMinutes,
      availableMinutes,
      scheduledMinutes,
      unscheduledMinutes,
      bufferMinutes,
      loadRatio,
      risk,
    },
  };
}

function withVariantMinimum(proposal, minimumTasks, language) {
  const minimumById = new Map(minimumTasks.filter((task) => task.__minimum).map((task) => [task.id, task]));
  return {
    ...proposal,
    schedule: proposal.schedule.map((block) => {
      const task = minimumById.get(block.sourceId);
      if (!task || block.kind !== "task") return block;
      const minimumVersion = task.minimum_version
        ? localizeMinimumVersion(task.minimum_version, language)
        : t(language, "automaticMinimum");
      return {
        ...block,
        isMinimum: true,
        minimumVersion,
        subtitle: minimumVersion,
        placementReason: t(language, "reasonMinimumRescue"),
      };
    }),
  };
}

function minimumTask(task) {
  return {
    ...task,
    duration_minutes: Math.min(
      roundToFive(task.duration_minutes),
      roundToFive(task.minimum_duration_minutes || Math.min(20, Number(task.duration_minutes || 30)))
    ),
    is_deep_work: false,
    __minimum: true,
  };
}

export function buildDayPathVariants(options = {}) {
  const { tasks = [], date = getLocalDate(), language = "ar" } = options;
  const sourceTasks = tasks.filter((task) => taskBelongsToDate(task, date));
  const full = { ...buildDayPath(options), id: "full" };
  const available = full.capacity.availableMinutes || 0;
  const styleShare = { gentle: 0.62, balanced: 0.76, ambitious: 0.9 }[options.profile?.planning_style] || 0.76;
  const protectedBuffer = Math.max(30, Number(options.profile?.target_buffer_minutes || 90));
  const budget = Math.max(60, Math.floor(Math.min(available * styleShare, Math.max(0, available - protectedBuffer)) / 5) * 5);
  const priorityRank = { essential: 3, important: 2, optional: 1 };
  const balancedTasks = [];
  const balancedOmitted = [];
  let used = 0;

  [...sourceTasks]
    .sort((a, b) => (priorityRank[b.priority] || 2) - (priorityRank[a.priority] || 2) || (energyRank[b.energy_required] || 2) - (energyRank[a.energy_required] || 2))
    .forEach((task) => {
      const fullMinutes = roundToFive(task.duration_minutes);
      if (used + fullMinutes <= budget) {
        balancedTasks.push(task);
        used += fullMinutes;
        return;
      }
      const smaller = minimumTask(task);
      if (used + smaller.duration_minutes <= budget && task.priority !== "optional") {
        balancedTasks.push(smaller);
        used += smaller.duration_minutes;
        return;
      }
      balancedOmitted.push({ taskId: task.id, title: localizeTitle(task.title, language), duration: fullMinutes });
    });

  const balancedBase = buildDayPath({ ...options, tasks: balancedTasks, learningTasks: tasks });
  const balanced = withVariantMinimum({
    ...balancedBase,
    id: "balanced",
    unscheduled: [...balancedBase.unscheduled, ...balancedOmitted],
  }, balancedTasks, language);
  const minimumTasks = sourceTasks.map(minimumTask);
  const minimum = withVariantMinimum({ ...buildDayPath({ ...options, tasks: minimumTasks, learningTasks: tasks }), id: "minimum" }, minimumTasks, language);

  return { full, balanced, minimum };
}

export function canPlaceBlock(block, nextStart, schedule, dayStart, dayEnd) {
  const nextEnd = nextStart + block.duration;
  if (nextStart < dayStart || nextEnd > dayEnd) return false;
  return !schedule.some((other) => other.id !== block.id && overlaps(nextStart, nextEnd, other));
}

export function prayerAnchorForPeriod() {
  return "none";
}
