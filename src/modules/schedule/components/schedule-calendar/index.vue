<script src="./scripts/index.js" />

<template>
  <div
    id="calendar"
    ref="calendarRoot"
    class="calendar-days"
    :data-calendar-view="view"
    @mouseleave="onCalendarMouseLeave"
  >
    <template v-if="view !== 'month' && timeline">
      <div
        class="timeline-head border-b border-border"
        :style="{ '--timeline-days': timeline.columns.length }"
      >
        <span></span>
        <button
          v-for="header in timeline.headers"
          :key="header.key"
          type="button"
          class="timeline-day-head text-foreground"
          :class="{ 'is-today': header.isToday, 'is-selected': header.isSelected }"
          :data-timeline-date="header.key"
          @click="selectDate(header.key)"
        >
          <b>{{ header.day }}</b>
          <span>{{ header.weekday }}</span>
        </button>
      </div>
      <div :ref="onTimelineScrollRef" class="timeline-scroll" @scroll="onTimelineScroll">
        <div
          class="timeline-grid"
          :style="{
            '--timeline-days': timeline.columns.length,
            '--timeline-height': `${timeline.gridHeight}px`,
          }"
        >
          <div class="timeline-hours border-r border-foreground">
            <span
              v-for="hour in timeline.hours"
              :key="hour.hour"
              class="text-muted-foreground"
              :class="{ 'is-last': hour.isLast }"
              :style="{ top: `${hour.top}px` }"
              >{{ hour.label }}</span
            >
          </div>
          <div class="timeline-lines">
            <i
              v-for="hour in timeline.hours"
              :key="hour.hour"
              class="border-t border-border"
              :style="{ top: `${hour.top}px` }"
            ></i>
          </div>
          <div
            v-for="column in timeline.columns"
            :key="column.key"
            class="timeline-column"
            :class="{
              'is-today': column.isToday,
              'is-selected': column.isSelected,
              'is-hovered': hoveredColumnKey === column.key,
            }"
            :data-date="column.key"
            @mousemove="onColumnMouseMove($event, column)"
            @pointerdown="onColumnPointerDown($event, column)"
          >
            <button
              v-for="entry in column.entries"
              :key="entry.id"
              type="button"
              class="timeline-event"
              :class="[
                `timeline-event--${entry.type}`,
                entry.status ? `timeline-event--${entry.status}` : '',
              ]"
              :data-lesson="entry.type === 'lesson' ? entry.id : null"
              :data-event="entry.type === 'event' ? entry.id : null"
              :style="{ top: `${entry.top}px`, height: `${entry.height}px` }"
              @click="onEntryClick(entry)"
            >
              <b>{{ entry.title }}</b>
              <span class="timeline-event__time">
                <time>{{ entry.startLabel }} <i>–</i></time>
                <time>{{ entry.endLabel }}</time>
              </span>
            </button>
            <div
              v-if="draftSlot && draftSlot.date === column.key"
              class="timeline-draft border-l border-muted-foreground text-muted-foreground"
              :style="{ top: `${draftSlot.top}px`, height: `${draftSlot.height - 4}px` }"
            >
              <span class="timeline-draft__time">
                <time>{{ draftSlot.label }} <i>–</i></time>
                <time>{{ draftSlot.endLabel }}</time>
              </span>
            </div>
            <div
              v-if="hoveredColumnKey === column.key && hoverSlot"
              class="timeline-event timeline-event--temporary"
              aria-hidden="true"
              :style="{ top: `${hoverSlot.top}px`, height: `${hoverSlot.height - 4}px` }"
            >
              <span class="timeline-event__time">
                <time>{{ hoverSlot.label }} <i>–</i></time>
                <time>{{ hoverSlot.endLabel }}</time>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-for="weekday in MONTH_WEEKDAYS"
        :key="weekday"
        class="calendar-weekday text-foreground"
      >
        {{ weekday }}
      </div>
      <button
        v-for="day in month"
        :key="day.key"
        type="button"
        class="day text-foreground"
        :class="{
          today: day.isToday,
          selected: day.isSelected,
          'past-day': day.isPast,
          'outside-month': day.isOutsideMonth,
          'has-events': day.count > 0,
        }"
        :data-date="day.key"
        @click="selectDate(day.key)"
      >
        <span class="date"
          ><span class="mobile-weekday">{{ day.weekdayLabel }},&nbsp;</span>{{ day.day }}</span
        >
        <span v-if="day.count" class="month-event-count" :aria-label="`Событий: ${day.count}`">{{
          day.count
        }}</span>
      </button>
    </template>
  </div>
</template>
