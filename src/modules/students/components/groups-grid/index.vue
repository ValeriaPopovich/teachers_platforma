<script src="./scripts/index.js" />

<template>
  <GroupCard v-for="row in rows" :key="row.group.id" :row="row" />
  <GroupsEmptyState v-if="isEmpty" :reason="emptyReason" />
</template>
