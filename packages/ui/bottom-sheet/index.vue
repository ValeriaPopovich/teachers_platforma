<script src="./scripts/index.js" />

<template>
  <Teleport to="body">
    <Transition name="bottom-sheet">
      <div v-if="open" class="bottom-sheet-layer" role="presentation" @click.self="close">
        <section
          ref="sheet"
          class="bottom-sheet border border-border bg-card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <div class="bottom-sheet__handle bg-border" aria-hidden="true"></div>
          <header class="bottom-sheet__header">
            <h2 :id="titleId">{{ title }}</h2>
          </header>
          <div class="bottom-sheet__content"><slot /></div>
          <footer v-if="$slots.footer || showCancel" class="bottom-sheet__footer">
            <slot name="footer" :close="close">
              <UiButton v-if="showCancel" variant="secondary" size="lg" block @click="close">
                {{ cancelLabel }}
              </UiButton>
            </slot>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
