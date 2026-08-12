<script src="./scripts/index.js" />

<template>
  <Teleport to="body">
    <Transition name="bottom-sheet">
      <div v-if="open" class="bottom-sheet-layer" role="presentation" @click.self="close">
        <section
          ref="sheet"
          class="bottom-sheet"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <div class="bottom-sheet__handle" aria-hidden="true"></div>
          <header class="bottom-sheet__header">
            <h2 :id="titleId">{{ title }}</h2>
            <button type="button" class="bottom-sheet__close" aria-label="Закрыть" @click="close">
              ×
            </button>
          </header>
          <div class="bottom-sheet__content"><slot /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
