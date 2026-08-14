<script src="./scripts/index.js" />

<template>
  <UiCard class="card day-timeline" padding="lg">
    <div class="day-timeline__head">
      <h2 class="day-timeline__title">Мой день</h2>
      <span v-if="next" class="day-timeline__next text-primary rounded-full">{{ next.label }}</span>
      <button
        type="button"
        class="day-timeline__link text-muted-foreground hover:text-primary"
        data-page-go="schedule"
        aria-label="Открыть расписание"
        title="Открыть расписание"
      >
        <span class="day-timeline__link-long">Открыть расписание →</span>
        <span class="day-timeline__link-short">Расписание →</span>
        <span class="day-timeline__link-compact" aria-hidden="true">
          <UiIcon name="calendar" :size="17" />
        </span>
      </button>
    </div>

    <p v-if="!timeline.length" class="day-timeline__empty text-muted-foreground">
      На сегодня занятий нет
    </p>

    <div v-else class="day-timeline__wrap">
      <ol ref="scrollEl" class="day-timeline__list" @scroll="onScroll">
        <li
          v-for="(row, index) in timeline"
          :key="rowKey(row, index)"
          class="timeline-row"
          :class="{
            'timeline-row--past': row.isPast,
            'timeline-row--active': row.activeCount,
            'timeline-row--now': row.kind === 'now',
            'timeline-row--overlap': row.lessons?.length > 1,
            'timeline-row--tight': row.gapLabel,
          }"
        >
          <template v-if="row.kind === 'now'">
            <div class="timeline-row__time timeline-row__time--now text-primary">
              {{ row.time }}
            </div>
            <div class="timeline-row__spine"><span class="now-dot"></span></div>
            <div class="timeline-now">
              <span class="timeline-now__label text-primary">
                Сейчас<template v-if="row.remainingMinutes">
                  · осталось {{ row.remainingMinutes }} мин</template
                >
              </span>
            </div>
          </template>

          <template v-else>
            <div class="timeline-row__time">{{ row.time }}</div>
            <div class="timeline-row__spine">
              <span v-if="row.gapLabel" class="gap-dot" aria-hidden="true"></span>
              <span class="bead" :class="beadClass(row)"></span>
            </div>
            <div class="timeline-row__body">
              <div v-if="row.gapLabel" class="timeline-gap text-muted-foreground">
                {{ row.gapLabel }}
              </div>
              <div v-if="row.lessons.length > 1" class="timeline-cluster text-muted-foreground">
                <span class="timeline-cluster__label">
                  Одновременно · {{ row.maxConcurrent }}
                </span>
                <span class="timeline-cluster__range">
                  {{ row.time }}–{{ row.endTime
                  }}<template v-if="row.overlapMinutes">
                    · пересечение {{ row.overlapMinutes }} мин</template
                  >
                </span>
              </div>
              <button
                v-for="lesson in row.lessons"
                :key="`${lesson.type}-${lesson.id}`"
                type="button"
                class="lesson hover:bg-muted"
                :class="{
                  'lesson--next': lesson.kind === 'next',
                  'lesson--overlap': row.lessons.length > 1,
                }"
                @click="onItemClick(lesson)"
              >
                <span class="lesson__content">
                  <span class="lesson__name">{{ lesson.name }}</span>
                  <span class="lesson__meta text-muted-foreground">
                    {{
                      lesson.type === 'event'
                        ? 'Своё событие'
                        : lesson.type === 'group'
                          ? 'Групповое'
                          : 'Индивидуальное'
                    }}
                    · {{ lesson.timeRange }} · {{ lesson.duration }} мин
                  </span>
                  <span
                    v-if="lesson.topic"
                    class="lesson__topic text-foreground"
                    :title="lesson.topic"
                  >
                    {{ lesson.topic }}
                  </span>
                </span>
                <span class="lesson__status" :class="`lesson__status--${lesson.kind}`">
                  {{ lesson.statusLabel }}<template v-if="lesson.kind === 'done'"> ✓</template>
                </span>
              </button>
            </div>
          </template>
        </li>
      </ol>

      <div v-if="isScrollable" class="day-timeline__fade" aria-hidden="true"></div>
      <div
        v-if="showScrollHint"
        class="day-timeline__scroll-hint text-muted-foreground bg-card border border-border"
        aria-hidden="true"
      >
        ↓
      </div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
