<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="students-page-layout">
    <template #header
      ><div class="topbar students-topbar">
        <div>
          <h1>Ученики и группы</h1>
        </div>
        <div class="students-updated">
          <span aria-hidden="true">◷</span>
          {{ updatedLabel }}
        </div>
      </div></template
    >

    <StudentsToolbar />

    <div class="students-section-head">
      <h2>Ученики</h2>
      <span class="students-count">{{ studentCount }}</span>
    </div>
    <div id="studentGrid" class="grid student-grid students-grid">
      <StudentsGrid />
    </div>

    <div class="subsection">
      <div class="students-section-head">
        <h2>Группы</h2>
        <span class="students-count">{{ groupCount }}</span>
      </div>
      <div id="groupGrid" class="grid student-grid group-grid">
        <GroupsGrid />
      </div>
    </div>
  </UiPageLayout>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
