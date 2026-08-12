<script src="./scripts/index.js" />

<template>
  <article class="payment-history-item">
    <span class="payment-history-status" aria-hidden="true"><UiIcon name="check" /></span>
    <div class="payment-history-main">
      <b>{{ payment.studentName }}</b>
      <small>{{ paymentType }}</small>
    </div>
    <time :datetime="payment.date">{{ dateLabel }}</time>
    <strong class="payment-history-amount">{{ amountLabel }}</strong>
    <span class="payment-history-badge">Проведён</span>
    <button
      class="icon-btn payment-history-delete"
      type="button"
      aria-label="Удалить платёж"
      @click="onDeleteClick"
    >
      <span class="student-delete-icon" aria-hidden="true"></span>
    </button>
  </article>
</template>
