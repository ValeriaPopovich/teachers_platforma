<script src="./scripts/index.js" />

<template>
  <div class="schedule-toolbar">
    <div class="schedule-toolbar-main">
      <button
        class="schedule-icon-button schedule-today-button"
        type="button"
        aria-label="Вернуться к сегодняшней дате"
        @click="goToday"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      <div id="calendarViewSwitch" class="calendar-view-switch">
        <button
          type="button"
          class="pill"
          :class="{ active: view === 'month' }"
          aria-label="Месяц"
          :aria-pressed="String(view === 'month')"
          @click="setView('month')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path
              d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"
            />
          </svg>
          <span>Месяц</span>
        </button>
        <button
          type="button"
          class="pill"
          :class="{ active: view === 'week' }"
          aria-label="Неделя"
          :aria-pressed="String(view === 'week')"
          @click="setView('week')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18M8 14h8M8 18h5" />
          </svg>
          <span>Неделя</span>
        </button>
        <button
          type="button"
          class="pill"
          :class="{ active: view === 'day' }"
          aria-label="День"
          :aria-pressed="String(view === 'day')"
          @click="setView('day')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          <span>День</span>
        </button>
      </div>
      <div class="schedule-period">
        <button
          class="schedule-icon-button"
          type="button"
          aria-label="Предыдущий период"
          @click="moveCalendar('prev')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <strong>{{ periodLabel }}</strong>
        <button
          class="schedule-icon-button"
          type="button"
          aria-label="Следующий период"
          @click="moveCalendar('next')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </div>
    <div class="schedule-actions">
      <button class="btn primary schedule-add" type="button" @click="onToolbarAddButtonClick">
        <span>Добавить</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  </div>
  <div class="schedule-workspace">
    <div class="calendar-card">
      <ScheduleCalendar
        ref="calendarRef"
        v-model:selected-date-key="selectedDateKey"
        v-model:draft-slot="draftSlot"
        :view="view"
        :timeline="timeline"
        :month="month"
        @update:anchor-date="(value) => (anchorDate = value)"
        @request-create="onCalendarRequestCreate"
      />
    </div>
    <ScheduleDaySummary :summary="summary" :selected-date-key="selectedDateKey" />
  </div>
  <ScheduleCreateSheet />
  <ScheduleForms />
</template>
