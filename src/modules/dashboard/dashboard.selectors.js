import { formatDate, formatTime, localDay } from '../../shared/format.js';
import {
  getMonthlyPaymentSummary,
  getPaymentAttentionRows,
} from '../payments/payments.selectors.js';
import { lessonDuration, lessonName, uniqueSessions } from '../schedule/schedule.selectors.js';

const CONDUCTED_HIDDEN = ['cancelled', 'moved'];

function sessionBounds(state, lesson) {
  const start = new Date(lesson.date).getTime();
  return { start, end: start + lessonDuration(state, lesson) * 60000 };
}

function eventBounds(event) {
  const start = new Date(event.date).getTime();
  return { start, end: start + (+event.duration || 60) * 60000 };
}

function nextLabel(startMs, nowMs) {
  const minutes = Math.round((startMs - nowMs) / 60000);
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Ближайший через ${hours ? `${hours}ч ` : ''}${rest}м`;
}

/**
 * Groups today's overlapping sessions into slots (interval merge) and marks the
 * current-time position. Two lessons overlap when `startA < endB && startB < endA`.
 */
export function buildTimeline(state, now = new Date()) {
  const today = localDay(now);
  const nowMs = now.getTime();

  const sessions = uniqueSessions(state.lessons)
    .filter(
      (lesson) =>
        String(lesson.date).slice(0, 10) === today && !CONDUCTED_HIDDEN.includes(lesson.status),
    )
    .map((lesson) => ({ lesson, ...sessionBounds(state, lesson) }))
    .sort((a, b) => a.start - b.start);

  const events = (state.events || [])
    .filter((event) => String(event.date).slice(0, 10) === today)
    .map((event) => ({ event, ...eventBounds(event) }));
  const items = [...sessions, ...events].sort((a, b) => a.start - b.start);

  const total = items.length;
  const done = items.filter((item) => item.end <= nowMs).length;
  const minutes = items.reduce((sum, item) => sum + (item.end - item.start) / 60000, 0);
  const next = items.find((item) => item.start > nowMs) || null;

  const groups = [];
  items.forEach((session) => {
    const current = groups[groups.length - 1];
    if (current && session.start < current.end) {
      current.items.push(session);
      current.end = Math.max(current.end, session.end);
    } else {
      groups.push({ start: session.start, end: session.end, items: [session] });
    }
  });

  const slots = groups.map((group) => ({
    kind: 'slot',
    time: formatTime(new Date(group.start)),
    isPast: group.end <= nowMs,
    lessons: group.items.map((session) => toTimelineItem(state, session, { next, nowMs })),
  }));

  const marker = { kind: 'now', time: formatTime(now) };
  const insertAt = groups.findIndex((group) => group.start > nowMs);
  const timeline = [...slots];
  if (insertAt === -1) timeline.push(marker);
  else timeline.splice(insertAt, 0, marker);

  return {
    timeline,
    progress: { done, total, percent: total ? Math.round((done / total) * 100) : 0 },
    stats: { lessons: total, hours: Math.round(minutes / 60) },
    next: next ? { label: nextLabel(next.start, nowMs) } : null,
  };
}

function toTimelineItem(state, session, { next, nowMs }) {
  if (session.event) {
    return {
      id: session.event.id,
      name: session.event.title,
      type: 'event',
      duration: +session.event.duration || 60,
      topic: String(session.event.note || '').trim(),
      kind: session === next ? 'next' : session.end <= nowMs ? 'done' : 'planned',
      statusLabel:
        session.end <= nowMs ? 'Завершено' : session === next ? 'Следующее' : 'Запланировано',
    };
  }
  const { lesson } = session;
  const isGroup = Boolean(lesson.groupId);
  const isNext = session === next;
  const conducted = session.end <= nowMs;

  let kind = 'planned';
  if (isNext) kind = 'next';
  else if (conducted) kind = lesson.status === 'unconfirmed' ? 'unconfirmed' : 'done';

  const statusLabel = {
    next: 'Следующее',
    done: 'Проведено',
    unconfirmed: 'Заполнить',
    planned: 'Запланировано',
  }[kind];

  return {
    id: lesson.seriesId || lesson.id,
    name: lessonName(state, lesson),
    type: isGroup ? 'group' : 'individual',
    duration: lessonDuration(state, lesson),
    topic: String(lesson.topics || '').trim(),
    groupSize: isGroup
      ? state.groups.find((group) => group.id === lesson.groupId)?.students?.length || 0
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
      title: 'Занятие не заполнено',
      subtitle: `${lessonName(state, lesson)} · ${formatDate(lesson.date, true)}`,
      actionLabel: 'Заполнить',
      lessonId: lesson.seriesId || lesson.id,
    }));

  const payments = getPaymentAttentionRows(state, now).map((row) => ({
    id: `pay:${row.student.id}`,
    kind: 'pay',
    title: row.label,
    subtitle: row.student.name,
    actionLabel: 'Принять оплату',
    studentId: row.student.id,
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
