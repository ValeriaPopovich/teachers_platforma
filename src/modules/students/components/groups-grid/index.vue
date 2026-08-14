<script src="./scripts/index.js" />

<template>
  <TransitionGroup name="entity-card">
    <GroupCard v-for="row in rows" :key="row.group.id" :row="row" />
    <GroupsEmptyState v-if="isEmpty" key="groups-empty" :reason="emptyReason" />
  </TransitionGroup>
</template>
