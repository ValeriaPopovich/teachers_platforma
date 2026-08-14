<script src="./scripts/index.js" />

<template>
  <UiModal
    :open="studentFormUi.open"
    :title="modalTitle"
    form-id="studentForm"
    title-id="studentModalTitle"
    :should-confirm-close="confirmDiscard.isDirty"
    @close="onModalClose"
    @submit="onFormSubmit"
  >
    <input type="hidden" name="id" :value="form.id" />
    <div class="form-grid">
      <div class="field">
        <label>Имя *</label><input v-model="form.name" placeholder=" " name="name" required />
      </div>
      <div class="field">
        <label>Класс</label>
        <select v-model="form.grade" name="grade">
          <option value="">Не указан</option>
          <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
        </select>
      </div>
      <div class="field">
        <label>Телефон / Telegram</label
        ><input v-model="form.contact" placeholder=" " name="contact" />
      </div>
      <div class="field">
        <label for="studentParentDetails">Контакты родителя</label>
        <input
          id="studentParentDetails"
          v-model="form.parentDetails"
          name="parentDetails"
          placeholder="Имя, телефон или Telegram"
        />
      </div>
      <div class="field">
        <label>Ссылка на занятие</label>
        <input v-model="form.lessonLink" name="lessonLink" type="url" placeholder="https://..." />
      </div>
      <div class="field">
        <label>Стоимость занятия, ₽ *</label>
        <input
          v-model.number="form.price"
          placeholder=" "
          name="price"
          type="number"
          min="1"
          required
        />
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
      <div class="field">
        <label>Формат оплаты</label>
        <select v-model="form.payType" name="payType">
          <option value="single">Разовые занятия</option>
          <option value="package">Абонемент</option>
        </select>
      </div>
      <div class="field">
        <label class="toggle-row"
          ><input id="studentPausedToggle" v-model="form.paused" type="checkbox" /><span
            class="toggle-ui"
          ></span
          ><span
            ><b>На паузе</b
            ><small>Расписание не генерируется, ученик не попадает в оплаты</small></span
          ></label
        >
      </div>
      <div v-if="billingFieldVisible" class="field">
        <label>Абонемент считать с</label>
        <input
          v-model="form.billingStartDate"
          placeholder=" "
          name="billingStartDate"
          type="date"
        />
        <small class="sub">{{ billingStartHint }}</small>
      </div>
      <div class="field full">
        <div class="field-label-with-hint">
          <label>Регулярное расписание</label>
          <UiHint
            text="Система проверит занятость времени и автоматически создаст занятия вперёд."
          />
        </div>
        <ScheduleSlotsField v-model="form.scheduleSlots" />
      </div>
      <div class="field full">
        <label>Цели обучения</label>
        <div class="goal-chips">
          <span v-for="goal in goalOptions" :key="goal" class="goal-option">
            <label class="goal-chip" :class="{ selected: selectedGoals.includes(goal) }">
              <input
                type="checkbox"
                :checked="selectedGoals.includes(goal)"
                @change="onGoalToggle(goal)"
              />{{ goal }}
            </label>
            <button
              type="button"
              class="goal-remove"
              title="Удалить цель из списка"
              aria-label="Удалить цель из списка"
              @click="onRemoveGoalButtonClick(goal)"
            >
              ×
            </button>
          </span>
        </div>
        <input
          v-model="customGoalInput"
          aria-label="Добавить свою цель"
          placeholder="Своя цель — Enter, чтобы добавить"
          style="margin-top: 9px"
          @keydown="onCustomGoalKeydown"
        />
      </div>
      <div class="field full">
        <label>Заметки</label>
        <textarea
          v-model="form.notes"
          name="notes"
          placeholder="Особенности ученика, договорённости..."
        ></textarea>
      </div>
    </div>

    <template #foot="{ close }">
      <button v-if="isEditing" type="button" class="btn ghost" @click="close">Отмена</button>
      <button type="submit" class="btn primary">Сохранить ученика</button>
    </template>
  </UiModal>
</template>
