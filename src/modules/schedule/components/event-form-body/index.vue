<script src="./scripts/index.js" />

<template>
  <div class="event-form-body">
    <!-- body renders its own action bar; the modal wrapper does not use the #foot slot -->

    <form id="eventForm" @submit.prevent="onFormSubmit">
      <input type="hidden" name="id" :value="form.id" />
      <div class="form-grid">
        <div class="field full">
          <label>Название *</label>
          <input
            v-model="form.title"
            name="title"
            required
            placeholder="Перерыв, консультация, личное дело..."
          />
        </div>
        <div class="field">
          <label>Начало *</label>
          <input v-model="form.date" placeholder=" " name="date" type="datetime-local" required />
        </div>
        <div class="field">
          <label>Конец *</label>
          <input
            v-model="form.endDate"
            placeholder=" "
            name="endDate"
            type="datetime-local"
            required
          />
        </div>
        <div class="field full">
          <label>Заметка</label>
          <textarea v-model="form.note" name="note" placeholder="Необязательно"></textarea>
        </div>
      </div>
      <div id="eventConflict" class="conflict-error"></div>
      <div class="modal-foot">
        <button
          v-show="isEditing"
          type="button"
          class="btn danger"
          style="margin-right: auto"
          @click="onDeleteButtonClick"
        >
          Удалить
        </button>
        <button type="button" class="btn ghost" @click="$emit('close-request')">Отмена</button>
        <button type="submit" class="btn primary">{{ submitLabel }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
// Break the sticky action bar out of the modal-body padding so it hugs the
// modal edges just like when it was rendered via <UiModal>'s #foot slot.
.event-form-body .modal-foot {
  margin: 16px -21px -21px;
}
</style>
