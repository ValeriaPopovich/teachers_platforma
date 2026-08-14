<script src="./scripts/index.js" />

<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div
        v-if="open"
        class="ui-modal-wrap"
        :class="[wrapClass, { 'ui-modal-wrap--side': side }]"
        role="presentation"
        @mousedown.self="onBackdropClick"
      >
        <div
          ref="dialog"
          class="modal"
          :class="[contentClass, { 'modal--discard': discardVisible }]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="generatedTitleId"
        >
          <Transition name="modal-content-flow" mode="out-in">
            <component
              :is="formId ? 'form' : 'div'"
              v-if="!discardVisible"
              :id="formId || undefined"
              key="content"
              class="modal-content-stage"
              @submit.prevent="$emit('submit', $event)"
            >
              <div class="modal-head">
                <div class="modal-heading">
                  <h2 :id="generatedTitleId">{{ title }}</h2>
                  <p v-if="subtitle" class="modal-subtitle text-muted-foreground">{{ subtitle }}</p>
                </div>
                <button type="button" class="close" aria-label="Закрыть" @click="requestClose">
                  ×
                </button>
              </div>
              <div class="modal-body"><slot /></div>
              <div v-if="$slots.foot" class="modal-foot">
                <slot name="foot" :close="requestClose" />
              </div>
            </component>
            <section
              v-else
              key="discard"
              class="modal-discard"
              :aria-labelledby="`${generatedTitleId}-discard`"
            >
              <div class="modal-discard__icon text-destructive" aria-hidden="true">!</div>
              <h2 :id="`${generatedTitleId}-discard`">Закрыть без сохранения?</h2>
              <p class="text-muted-foreground">Внесённые изменения не сохранятся.</p>
              <div class="modal-discard__actions">
                <button type="button" class="btn primary" @click="continueEditing">
                  Продолжить редактирование
                </button>
                <button type="button" class="btn danger" @click="discardAndClose">
                  Закрыть без сохранения
                </button>
              </div>
            </section>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
