<script src="./scripts/index.js" />

<template>
  <UiCard as="article" class="card group-card">
    <UiMenu
      class="group-card-menu"
      :aria-label="optionsLabel"
      :items="menuItems"
      :owner-id="groupId"
    />

    <div
      class="student-card-main"
      role="button"
      tabindex="0"
      :aria-label="openGroupLabel"
      :data-group="groupId"
    >
      <div class="student-top">
        <div class="group-direction">{{ row.direction }}</div>
        <h3>{{ row.group.name }}</h3>
      </div>
      <div class="student-card-facts">
        <div class="student-fact student-fact-schedule group-schedule">
          <UiIcon class="student-fact-icon" name="calendar" />
          <b>{{ row.schedule }}</b>
        </div>
        <div class="group-facts">
          <span
            ><b>{{ row.membersLabel }}</b></span
          >
          <i>·</i>
          <span>{{ row.durationLabel }}</span>
        </div>
      </div>
      <div class="group-card-bottom">
        <div class="group-member-names">
          {{ row.members.map((member) => member.name).join(', ')
          }}<template v-if="row.moreCount"> и ещё {{ row.moreCount }}</template>
        </div>
        <span class="group-open-icon" aria-hidden="true"><UiIcon name="video" /></span>
      </div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
