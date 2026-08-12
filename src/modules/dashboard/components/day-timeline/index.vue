<script src="./scripts/index.js" />

<template>
  <UiCard class="card day-timeline" padding="lg">
    <div class="day-timeline__head">
      <h2 class="day-timeline__title">Мой день</h2>
      <span v-if="next" class="day-timeline__next">{{ next.label }}</span>
      <a class="day-timeline__link" data-page-go="schedule">Открыть расписание →</a>
    </div>

    <div class="day-timeline__wrap">
      <ol ref="scrollEl" class="day-timeline__list" @scroll="onScroll">
        <li
          v-for="(row, index) in timeline"
          :key="rowKey(row, index)"
          class="timeline-row"
          :class="{ 'timeline-row--past': row.isPast, 'timeline-row--now': row.kind === 'now' }"
        >
          <template v-if="row.kind === 'now'">
            <div class="timeline-row__time timeline-row__time--now">{{ row.time }}</div>
            <div class="timeline-row__spine"><span class="now-dot"></span></div>
            <div class="timeline-now">
              <span class="timeline-now__label">Сейчас</span>
            </div>
          </template>

          <template v-else>
            <div class="timeline-row__time">{{ row.time }}</div>
            <div class="timeline-row__spine">
              <span class="bead" :class="beadClass(row)"></span>
            </div>
            <div class="timeline-row__body">
              <button
                v-for="lesson in row.lessons"
                :key="`${lesson.type}-${lesson.id}`"
                type="button"
                class="lesson"
                :class="{ 'lesson--next': lesson.kind === 'next' }"
                @click="onItemClick(lesson)"
              >
                <span class="lesson__content">
                  <span class="lesson__name">{{ lesson.name }}</span>
                  <span class="lesson__meta">
                    {{
                      lesson.type === 'event'
                        ? 'Своё событие'
                        : lesson.type === 'group'
                          ? 'Групповое'
                          : 'Индивидуальное'
                    }}
                    · {{ lesson.duration }} мин
                  </span>
                  <span v-if="lesson.topic" class="lesson__topic" :title="lesson.topic">
                    {{ lesson.topic }}
                  </span>
                </span>
                <UiBadge v-if="lesson.type === 'group'" variant="success">
                  группа · {{ lesson.groupSize }}
                </UiBadge>
                <span class="lesson__status" :class="`lesson__status--${lesson.kind}`">
                  {{ lesson.statusLabel }}<template v-if="lesson.kind === 'done'"> ✓</template>
                </span>
              </button>
            </div>
          </template>
        </li>
      </ol>

      <div v-if="isScrollable" class="day-timeline__fade" aria-hidden="true"></div>
      <div v-if="showScrollHint" class="day-timeline__scroll-hint" aria-hidden="true">↓</div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
