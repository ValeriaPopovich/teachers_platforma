<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="students-page-layout">
    <template #header
      ><div class="topbar students-topbar">
        <div>
          <h1>Ученики и группы</h1>
        </div>
      </div></template
    >

    <StudentsToolbar v-model:query="query" v-model:filter="filter" />

    <div class="students-section-head">
      <h2>Ученики</h2>
      <span class="students-count">{{ studentCount }}</span>
    </div>
    <div class="students-carousel">
      <button
        v-show="studentNavigation.previous"
        class="students-carousel-arrow is-previous border-border/72 text-foreground bg-primary-foreground/88 hover:bg-primary-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary/35 focus-visible:outline-offset-2"
        type="button"
        aria-label="Показать предыдущих учеников"
        @click="scrollCarousel(studentScroller, -1)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14.5 6-6 6 6 6" />
        </svg>
      </button>
      <div ref="studentScroller" class="grid student-grid students-grid">
        <StudentsGrid :rows="studentRows" :empty-reason="studentsEmptyReason" />
      </div>
      <button
        v-show="studentNavigation.next"
        class="students-carousel-arrow is-next border-border/72 text-foreground bg-primary-foreground/88 hover:bg-primary-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary/35 focus-visible:outline-offset-2"
        type="button"
        aria-label="Показать следующих учеников"
        @click="scrollCarousel(studentScroller, 1)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      </button>
    </div>

    <div class="subsection">
      <div class="students-section-head">
        <h2>Группы</h2>
        <span class="students-count">{{ groupCount }}</span>
      </div>
      <div class="students-carousel">
        <button
          v-show="groupNavigation.previous"
          class="students-carousel-arrow is-previous border-border/72 text-foreground bg-primary-foreground/88 hover:bg-primary-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary/35 focus-visible:outline-offset-2"
          type="button"
          aria-label="Показать предыдущие группы"
          @click="scrollCarousel(groupScroller, -1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14.5 6-6 6 6 6" />
          </svg>
        </button>
        <div ref="groupScroller" class="grid student-grid group-grid">
          <GroupsGrid :rows="groupRows" :empty-reason="groupsEmptyReason" />
        </div>
        <button
          v-show="groupNavigation.next"
          class="students-carousel-arrow is-next border-border/72 text-foreground bg-primary-foreground/88 hover:bg-primary-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary/35 focus-visible:outline-offset-2"
          type="button"
          aria-label="Показать следующих группы"
          @click="scrollCarousel(groupScroller, 1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9.5 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  </UiPageLayout>

  <StudentForm />
  <GroupForm />
  <StudentProfile />
</template>

<style scoped src="./styles/index.scss" lang="scss" />
