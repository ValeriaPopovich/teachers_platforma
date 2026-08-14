<script src="./scripts/index.js" />

<template>
  <UiModal
    :open="groupFormUi.open"
    :title="modalTitle"
    form-id="groupForm"
    title-id="groupModalTitle"
    :should-confirm-close="confirmDiscard.isDirty"
    @close="onModalClose"
    @submit="onFormSubmit"
  >
    <input type="hidden" name="id" :value="form.id" />
    <div class="form-grid">
      <div class="field">
        <label>Название группы *</label>
        <input v-model="form.name" name="name" required placeholder="ОГЭ — вторник/четверг" />
      </div>
      <div class="field">
        <label>Класс / направление</label>
        <input v-model="form.grade" name="grade" placeholder="9 класс, ОГЭ" />
      </div>
      <div class="field">
        <label>Длительность, минут *</label>
        <input
          v-model.number="form.duration"
          placeholder=" "
          name="duration"
          type="number"
          min="15"
          required
        />
      </div>
      <div class="field full">
        <div class="field-label-with-hint">
          <label>Участники</label>
          <UiHint text="Стоимость и формат оплаты берутся из личной карточки каждого ученика." />
        </div>
        <div class="member-chips">
          <label
            v-for="student in students"
            :key="student.id"
            class="member-chip"
            :class="{ selected: form.members.includes(student.id) }"
          >
            <input
              type="checkbox"
              :checked="form.members.includes(student.id)"
              @change="onMemberToggle(student.id)"
            />{{ student.name }}
          </label>
        </div>
        <div v-if="nonPackageMemberNames.length" class="notice">
          У {{ nonPackageMemberNames.join(', ') }} указана разовая оплата. Группу можно сохранить,
          но занятия этих учеников не будут списываться из абонемента.
        </div>
      </div>
      <div class="field full">
        <label>Регулярное расписание</label>
        <ScheduleSlotsField v-model="form.scheduleSlots" />
      </div>
      <div class="field full">
        <label>Заметки</label>
        <textarea v-model="form.notes" placeholder=" " name="notes"></textarea>
      </div>
    </div>

    <template #foot="{ close }">
      <button
        v-if="isEditing"
        type="button"
        class="btn danger"
        style="margin-right: auto"
        @click="onDeleteButtonClick"
      >
        Удалить группу
      </button>
      <button v-if="isEditing" type="button" class="btn ghost" @click="close">Отмена</button>
      <button type="submit" class="btn primary">Сохранить группу и расписание</button>
    </template>
  </UiModal>
</template>
