<script src="./scripts/index.js" />

<template>
  <div class="schedule-list">
    <div v-for="(slot, index) in modelValue" :key="index" class="schedule-slot">
      <select
        class="slot-day"
        :value="slot.day"
        @change="updateSlot(index, { day: +$event.target.value })"
      >
        <option v-for="option in dayOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        placeholder=" "
        class="slot-time"
        type="time"
        :value="slot.time"
        @input="updateSlot(index, { time: $event.target.value })"
      />
      <button
        type="button"
        class="icon-btn remove-slot"
        aria-label="Убрать день"
        @click="onRemoveSlotButtonClick(index)"
      >
        ×
      </button>
    </div>
  </div>
  <button type="button" class="btn secondary" style="margin-top: 8px" @click="onAddSlotButtonClick">
    + Ещё день
  </button>
</template>
