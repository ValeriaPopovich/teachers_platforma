<script src="./scripts/index.js" />

<template>
  <StudentCard v-for="row in rows" :key="row.student.id" :row="row" />
  <StudentsEmptyState v-if="isEmpty" :reason="emptyReason" />
</template>
