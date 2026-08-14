import { formatDate, formatTime, localDay } from '../../shared/format.js';
import {
  getMonthlyPaymentSummary,
  getPaymentAttentionRows,
} from '../payments/payments.selectors.js';
import { lessonDuration, lessonName, uniqueSessions } from '../schedule/schedule.selectors.js';

const CONDUCTED_HIDDEN = ['cancelled', 'moved'];
const DAY_MS = 86400000;
// Всё-дневные дела не должны склеивать день в один кластер: длинные пункты живут отдельным слотом.
const LONG_ITEM_MS = 4 * 3600000;

function sessionBounds(state, lesson) {
  const start = new Date(lesson.date).getTime();
  return { start, end: start + lessonDuration(state, lesson) * 60000 };
}

function eventBounds(event) {
  const start = new Date(event.date).getTime();
  return { start, end: start + (+event.duration || 60) * 60000 };
}

function nextLabel(startMs, nowMs) {
  const minutes = Math.max(1, Math.round((startMs - nowMs) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Ближайший через ${hours ? `${hours}ч` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}м` : ''}`;
}

function gapLabel(minutes) {
  if (minutes === null) return '';
  if (minutes === 0) return 'Без перерыва';
  if (minutes <= 30) return `Перерыв ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Окно ${[hours && `${hours} ч`, rest && `${rest} мин`].filter(Boolean).join(' ')}`;
}

function slotOverlapStats(group) {
  if (group.items.length < 2) return { maxConcurrent: 1, overlapMinutes: 0 };

  const deltas = new Map();
  group.items.forEach((item) => {
    deltas.set(item.start, (deltas.get(item.start) || 0) + 1);
    deltas.set(item.end, (deltas.get(item.end) || 0) - 1);
  });

  let active = 0;
  let maxConcurrent = 0;
  let overlapMs = 0;
  let previousTime = null;
  [...deltas.entries()]
    .sort(([timeA], [timeB]) => timeA - timeB)
    .forEach(([time, delta]) => {
      if (previousTime !== null && active > 1) overlapMs += time - previousTime;
      active += delta;
      maxConcurrent = Math.max(maxConcurrent, active);
      previousTime = time;
    });

  return { maxConcurrent, overlapMinutes: Math.round(overlapMs / 60000) };
}

/**
 * Groups today's overlapping sessions into slots (interval merge) and marks the
 * current-time position. Two lessons overlap when `startA < endB && startB < endA`.
 * ponytail: merge остаётся транзитивным (A↔B, B↔C склеиваются в один слот) — это
 * терпимо для обычных занятий; всё, что длиннее LONG_ITEM_MS, вынесено в свой слот.
 */
export function buildTimeline(state, now = new Date()) {
  const nowMs = now.getTime();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const dayEnd = dayStart + DAY_MS;
  // Занятие, начавшееся вчера вечером, может идти прямо сейчас — берём и вчерашнюю дату тоже.
  const days = new Set([localDay(new Date(dayStart - DAY_MS)), localDay(now)]);
  const spansToday = (item) => item.end > dayStart && item.start < dayEnd;

  const sessions = uniqueSessions(state.lessons)
    .filter(
      (lesson) =>
        days.has(String(lesson.date).slice(0, 10)) && !CONDUCTED_HIDDEN.includes(lesson.status),
    )
    .map((lesson) => ({ lesson, ...sessionBounds(state, lesson) }))
    .filter(spansToday);

  const events = (state.events || [])
    .filter((event) => days.has(String(event.date).slice(0, 10)))
    .map((event) => ({ event, ...eventBounds(event) }))
    .filter(spansToday);
  const items = [...sessions, ...events].sort((a, b) => a.start - b.start);

  const total = items.length;
  const done = items.filter((item) => item.end <= nowMs).length;
  const minutes = items.reduce((sum, item) => sum + (item.end - item.start) / 60000, 0);
  const next = items.find((item) => item.start > nowMs) || null;
  const nextStart = next ? next.start : null;

  const isLong = (item) => item.end - item.start >= LONG_ITEM_MS;
  const groups = [];
  items.forEach((session) => {
    const current = groups[groups.length - 1];
    if (current && !current.hasLong && !isLong(session) && session.start < current.end) {
      current.items.push(session);
      current.end = Math.max(current.end, session.end);
    } else {
      groups.push({
        start: session.start,
        end: session.end,
        items: [session],
        hasLong: isLong(session),
      });
    }
  });

  // Окно считаем от самого позднего конца, а не от предыдущего слота: длинное дело
  // может перекрывать несколько следующих слотов, и тогда паузы между ними нет.
  let busyUntil = null;
  const slots = groups.map((group) => {
    const gapMinutes =
      busyUntil !== null && group.start >= busyUntil
        ? Math.round((group.start - busyUntil) / 60000)
        : null;
    busyUntil = busyUntil === null ? group.end : Math.max(busyUntil, group.end);
    const activeCount = group.items.filter(
      (item) => item.start <= nowMs && nowMs < item.end,
    ).length;

    return {
      kind: 'slot',
      time: formatTime(new Date(group.start)),
      endTime: formatTime(new Date(group.end)),
      isPast: group.end <= nowMs,
      gapLabel: gapLabel(gapMinutes),
      activeCount,
      ...slotOverlapStats(group),
      lessons: group.items.map((session) => toTimelineItem(state, session, { nextStart, nowMs })),
    };
  });

  const active = items.filter((item) => item.start <= nowMs && nowMs < item.end);
  const timeline = [...slots];
  if (items.length) {
    const marker = {
      kind: 'now',
      time: formatTime(now),
      activeCount: active.length,
      remainingMinutes: active.length
        ? Math.ceil((Math.min(...active.map((item) => item.end)) - nowMs) / 60000)
        : 0,
    };
    const insertAt = groups.findIndex((group) => group.start > nowMs);
    if (insertAt === -1) timeline.push(marker);
    else timeline.splice(insertAt, 0, marker);
  }

  return {
    timeline,
    progress: { done, total, percent: total ? Math.round((done / total) * 100) : 0 },
    stats: { lessons: total, hours: Math.round(minutes / 60) },
    next: next ? { label: nextLabel(next.start, nowMs) } : null,
  };
}

const STATUS_LABEL = {
  next: 'Скоро',
  in_progress: 'В процессе',
  done: 'Проведено',
  unconfirmed: 'Ждёт отчёта',
  planned: 'Запланировано',
};

function toTimelineItem(state, session, { nextStart, nowMs }) {
  const inProgress = session.start <= nowMs && nowMs < session.end;
  const conducted = session.end <= nowMs;
  // Одинаковый старт = все «Скоро», а не только первый в списке.
  const isNext = nextStart !== null && session.start === nextStart;
  const startTime = formatTime(new Date(session.start));
  const endTime = formatTime(new Date(session.end));

  let kind = 'planned';
  if (inProgress) kind = 'in_progress';
  else if (isNext) kind = 'next';
  else if (conducted) kind = session.lesson?.status === 'unconfirmed' ? 'unconfirmed' : 'done';

  if (session.event) {
    return {
      id: session.event.id,
      name: session.event.title,
      type: 'event',
      duration: +session.event.duration || 60,
      startTime,
      endTime,
      timeRange: `${startTime}–${endTime}`,
      topic: String(session.event.note || '').trim(),
      kind,
      statusLabel: kind === 'done' ? 'Завершено' : STATUS_LABEL[kind],
    };
  }

  const { lesson } = session;
  const isGroup = Boolean(lesson.groupId);
  const statusLabel = STATUS_LABEL[kind];

  return {
    id: lesson.seriesId || lesson.id,
    name: lessonName(state, lesson),
    type: isGroup ? 'group' : 'individual',
    duration: lessonDuration(state, lesson),
    startTime,
    endTime,
    timeRange: `${startTime}–${endTime}`,
    topic: String(lesson.topics || '').trim(),
    groupSize: isGroup
      ? state.groups.find((group) => group.id === lesson.groupId)?.members?.length || 0
      : 0,
    kind,
    statusLabel,
  };
}

export function buildAttention(state, now, retentionDays) {
  const cutoff = now.getTime() - retentionDays * 86400000;
  const unfilled = uniqueSessions(state.lessons)
    .filter((lesson) => {
      const time = new Date(lesson.date).getTime();
      return (
        time >= cutoff &&
        time < now.getTime() &&
        (lesson.status === 'unconfirmed' ||
          (lesson.status === 'done' && lesson.reportFilled === false))
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((lesson) => ({
      id: `fill:${lesson.seriesId || lesson.id}`,
      kind: 'fill',
      title: 'Заполнить занятие',
      subtitle: `${lessonName(state, lesson)} · ${formatDate(lesson.date, true)}`,
      actionLabel: 'Заполнить',
      lessonId: lesson.seriesId || lesson.id,
    }));

  const payments = getPaymentAttentionRows(state, now)
    .filter((row) => row.finance.debt > 0)
    .map((row) => ({
      id: `pay:${row.student.id}`,
      kind: 'pay',
      title: 'Долг',
      subtitle: row.student.name,
      actionLabel: 'Принять оплату',
      studentId: row.student.id,
      amountDue: row.finance.debt,
    }));

  return [...unfilled, ...payments];
}

export function buildDashboard(state, { now = new Date(), retentionDays = 45 } = {}) {
  const { timeline, progress, stats, next } = buildTimeline(state, now);
  const { received } = getMonthlyPaymentSummary(state, now);
  const goal = +state.settings?.incomeGoal || 0;

  return {
    dayTitle: now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }),
    progress,
    stats,
    next,
    income: { received, goal },
    timeline,
    attention: buildAttention(state, now, retentionDays),
  };
}
