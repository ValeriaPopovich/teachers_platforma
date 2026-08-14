<script src="./scripts/index.js" />

<template>
  <article class="payment-history-item border border-border bg-card">
    <span class="payment-history-status text-secondary" aria-hidden="true"
      ><UiIcon name="check"
    /></span>
    <div class="payment-history-main">
      <b class="text-foreground">{{ payment.studentName }}</b>
      <small class="text-muted-foreground">{{ paymentType }}</small>
    </div>
    <time class="text-muted-foreground" :datetime="payment.date">{{ dateLabel }}</time>
    <strong class="payment-history-amount text-secondary">{{ amountLabel }}</strong>
    <span class="payment-history-badge border border-border text-muted-foreground">Проведён</span>
    <button
      class="icon-btn payment-history-delete"
      type="button"
      aria-label="Удалить платёж"
      @click="onDeleteClick"
    >
      <UiIcon name="trash" />
    </button>
  </article>
</template>
