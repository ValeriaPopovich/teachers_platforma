<script src="./scripts/index.js" />

<template>
  <article class="payment-balance-item border border-border bg-card" :data-kind="row.kind">
    <span class="payment-state-rail" aria-hidden="true"></span>
    <div class="payment-balance-main">
      <b>{{ row.student.name }}</b>
      <small class="text-muted-foreground">{{ priceLabel }}</small>
    </div>
    <div class="payment-progress">
      <div class="text-muted-foreground">
        <span class="payment-progress-label">
          {{ packageLabel }}
          <UiHint
            text="Шкала считает занятия текущего месяца — и индивидуальные, и групповые. Проведённые занятия и пропуски с оплатой уменьшают баланс по цене самого занятия."
            label="Как считается план месяца"
          />
        </span>
        <b>{{ used }}/{{ total }}</b>
      </div>
      <i class="bg-border"><span class="bg-secondary" :style="{ width: `${percent}%` }"></span></i>
      <small class="text-muted-foreground">{{ progressText }}</small>
    </div>
    <div class="payment-balance-state">
      <strong>{{ amountLabel }}</strong>
      <span>{{ paymentText }}</span>
    </div>
    <button class="btn secondary payment-row-action" type="button" @click="onActionClick">
      <UiIcon name="card" />
      <span>{{ actionLabel }}</span>
    </button>
  </article>
</template>
