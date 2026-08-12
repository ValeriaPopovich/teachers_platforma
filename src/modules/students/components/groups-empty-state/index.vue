<script src="./scripts/index.js" />

<template>
  <div :class="rootClass">
    <template v-if="showDetails">
      <span aria-hidden="true">⌕</span>
      <b>Группы не найдены</b>
      <p>Попробуйте изменить поисковый запрос</p>
    </template>
    <template v-else>Групп пока нет</template>
  </div>
</template>
