<script src="./scripts/index.js" />

<template>
  <aside class="schedule-today border border-border bg-card" aria-labelledby="scheduleTodayTitle">
    <div class="schedule-today-head">
      <h2 id="scheduleTodayTitle">{{ summary.title }}</h2>
    </div>
    <div id="scheduleTodaySummary">
      <section
        v-for="section in summary.sections"
        :key="section.type"
        class="schedule-summary-section"
      >
        <div class="schedule-summary-row">
          <span>{{ section.label }}</span>
          <b class="text-card bg-foreground">{{ section.count }}</b>
          <button
            type="button"
            :aria-label="`Добавить: ${section.label.toLowerCase()}`"
            @click="onAddButtonClick(section.type)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <div v-if="section.items.length" class="schedule-summary-cards">
          <button
            v-for="item in section.items"
            :key="item.id"
            type="button"
            class="schedule-summary-card"
            :class="`schedule-summary-card--${item.type}`"
            @click="onItemClick(item)"
          >
            <time>{{ item.startLabel }}</time>
            <span>
              <b>{{ item.title }}</b>
              <small>{{ item.rangeLabel }}</small>
              <strong v-if="item.type === 'lesson'">{{ item.amountLabel }}</strong>
            </span>
          </button>
        </div>
        <p v-else class="schedule-summary-empty">Записей пока нет</p>
      </section>
    </div>
  </aside>
</template>
