<script src="./scripts/index.js" />

<template>
  <UiModal
    :open="paymentFormUi.open"
    :title="modalTitle"
    form-id="paymentForm"
    title-id="paymentModalTitle"
    :should-confirm-close="confirmDiscard.isDirty"
    @close="onModalClose"
    @submit="onFormSubmit"
  >
    <div class="form-grid">
      <div class="field full">
        <label>Ученик *</label>
        <select v-model="form.studentId" name="studentId" required>
          <option value="">Выберите ученика</option>
          <option v-for="item in students" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
      </div>
      <div class="field full">
        <label>Полученная сумма, ₽ *</label>
        <input
          v-model.number="form.amount"
          placeholder=" "
          name="amount"
          type="number"
          min="1"
          required
          inputmode="numeric"
        />
        <small class="sub">{{ amountHint }}</small>
      </div>
    </div>

    <template #foot="{ close }">
      <button type="button" class="btn ghost" @click="close">Отмена</button>
      <button type="submit" class="btn primary">{{ submitLabel }}</button>
    </template>
  </UiModal>
</template>
