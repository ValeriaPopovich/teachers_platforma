<script src="./scripts/index.js" />

<template>
  <UiCard class="card dash-attention" padding="lg">
    <div class="dash-attention__head">
      <span class="dash-attention__title text-muted-foreground">Требует внимания</span>
      <UiBadge v-if="availableItems.length" variant="danger">{{ availableItems.length }}</UiBadge>
    </div>

    <TransitionGroup
      v-if="availableItems.length"
      ref="listRef"
      name="attention-task"
      tag="div"
      class="dash-attention__list"
      :class="{ 'dash-attention__list--expanded': expanded }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="dash-attention__item"
        :class="{ 'dash-attention__item--editing': activePaymentId === item.id }"
      >
        <div class="dash-attention__item-main">
          <span
            class="dash-attention__icon"
            :class="`dash-attention__icon--${item.kind}`"
            aria-hidden="true"
          >
            <UiIcon :name="item.kind === 'pay' ? 'card' : 'warning'" :size="19" />
          </span>
          <span class="dash-attention__text">
            <b class="text-foreground">{{ item.title }}</b>
            <small class="text-muted-foreground">{{ item.subtitle }}</small>
          </span>
          <Transition name="attention-input">
            <label
              v-if="item.kind === 'pay' && activePaymentId === item.id"
              class="dash-attention__payment-input"
              :for="`attention-payment-${item.studentId}`"
            >
              <span class="payments-sr-only">Сумма оплаты, ₽</span>
              <input
                :id="`attention-payment-${item.studentId}`"
                v-model.number="paymentAmount"
                class="text-foreground bg-card border border-border rounded-lg focus:border-primary focus:outline-none"
                placeholder=" "
                type="number"
                min="1"
                inputmode="numeric"
                required
                @keydown.enter.prevent="submitPayment(item)"
                @keydown.esc="closePaymentEditor"
              />
              <span class="text-muted-foreground">₽</span>
            </label>
          </Transition>
          <UiButton
            v-if="item.kind === 'pay' && activePaymentId === item.id"
            class="dash-attention__payment-cancel"
            size="sm"
            variant="ghost"
            @click="closePaymentEditor"
          >
            Отмена
          </UiButton>
          <UiButton
            size="sm"
            variant="secondary"
            :class="{
              'dash-attention__payment-submit': activePaymentId === item.id,
              'text-primary-foreground': activePaymentId === item.id,
            }"
            @click="onPrimaryAction(item)"
          >
            {{ activePaymentId === item.id ? 'Принять' : item.actionLabel }}
          </UiButton>
        </div>
      </div>
    </TransitionGroup>

    <p v-else class="dash-attention__empty text-muted-foreground">
      Сейчас нет задач, требующих внимания
    </p>

    <button
      v-if="availableItems.length > maxVisible"
      class="dash-attention__more text-muted-foreground hover:text-primary"
      type="button"
      :aria-expanded="expanded"
      @click="toggleExpanded"
    >
      {{ expanded ? 'Свернуть' : `Показать все · ${availableItems.length}` }}
    </button>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
