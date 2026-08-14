<script src="./scripts/index.js" />

<template>
  <TransitionGroup name="entity-card">
    <StudentCard v-for="row in rows" :key="row.student.id" :row="row" />
    <StudentsEmptyState v-if="!rows.length" key="students-empty" :reason="emptyReason" />
  </TransitionGroup>
</template>
