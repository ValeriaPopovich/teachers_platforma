<script src="./scripts/index.js" />

<template>
  <UiCard as="article" class="card student-card" :class="cardClass">
    <UiMenu
      class="student-card-menu"
      :aria-label="optionsLabel"
      :items="menuItems"
      @select="onMenuSelect"
    />

    <div
      class="student-card-main"
      role="button"
      tabindex="0"
      :aria-label="openCardLabel"
      :data-student="studentId"
      @click="onCardClick"
      @keydown.enter="onCardClick"
      @keydown.space.prevent="onCardClick"
    >
      <div class="student-top">
        <div class="student-identity">
          <div class="student-card-eyebrow text-primary">{{ grade }}</div>
          <h3>{{ row.student.name }}</h3>
          <div class="meta">{{ row.contact }}</div>
        </div>
      </div>

      <div class="student-card-facts">
        <div class="student-fact student-fact-schedule">
          <UiIcon class="student-fact-icon" name="calendar" />
          <b>{{ row.schedule }}</b>
        </div>
        <div class="student-fact student-fact-terms">
          <UiIcon class="student-fact-icon" name="clock" />
          <b>{{ row.terms }}</b>
        </div>
      </div>

      <div class="student-card-footer">
        <UiBadge class="student-payment-status" :class="paymentClass" :variant="badgeVariant">
          {{ row.payment.label }}
        </UiBadge>

        <UiTooltip v-if="hasLessonUrl" text="Начать видеозвонок">
          <a
            class="student-lesson-link has-video"
            :href="row.lessonUrl"
            target="_blank"
            rel="noopener"
            :aria-label="videoCallLabel"
            @click="handleInteractiveClick"
          >
            <UiIcon name="video" />
          </a>
        </UiTooltip>
        <UiTooltip v-else text="Добавить видеозвонок">
          <button
            class="student-lesson-link is-empty"
            type="button"
            :aria-label="addVideoCallLabel"
            :data-add-lesson-link="studentId"
            @click="onAddLessonLinkClick"
          >
            <span aria-hidden="true">＋</span>
          </button>
        </UiTooltip>
      </div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
