<script src="./scripts/index.js" />

<template>
  <article class="payment-balance-item" :data-kind="row.kind">
    <span class="payment-state-rail" aria-hidden="true"></span>
    <div class="payment-balance-main">
      <b>{{ row.student.name }}</b>
      <small>{{ priceLabel }}</small>
    </div>
    <div class="payment-progress">
      <div>
        <span>{{ packageLabel }}</span>
        <b>{{ used }}/{{ bought }}</b>
      </div>
      <i><span :style="{ width: `${percent}%` }"></span></i>
      <small>{{ progressText }}</small>
    </div>
    <div class="payment-balance-state">
      <strong>{{ amountLabel }}</strong>
      <span>{{ paymentText }}</span>
    </div>
    <button class="btn payment-row-action" type="button" @click="onActionClick">
      <UiIcon name="card" />
      <span>{{ actionLabel }}</span>
    </button>
  </article>
</template>
