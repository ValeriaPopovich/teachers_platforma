<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="payments-page text-foreground">
    <template #header>
      <div class="topbar payments-topbar">
        <div><h1>Управление расчётами</h1></div>
        <UiButton
          variant="primary"
          class="payments-primary-action"
          data-open="payment"
          @click="openPaymentForm()"
        >
          <template #iconBefore><UiIcon name="card" /></template>
          <span>Принять оплату</span>
        </UiButton>
      </div>
    </template>

    <div id="analyticsCard" class="payments-summary">
      <span id="analyticsRangeLabel" class="payments-sr-only">{{ model.monthLabel }}</span>
      <div id="paymentStats" class="grid stats payments-stats">
        <div v-for="stat in statCards" :key="stat.key" class="card stat" :class="stat.extra">
          <div class="label text-muted-foreground">{{ stat.label }}</div>
          <UiHint :text="stat.tip" :label="`Пояснение к показателю «${stat.label}»`" />
          <div class="value">{{ stat.value }}</div>
          <small class="payment-stat-note text-muted-foreground">{{ stat.note }}</small>
          <span class="payment-stat-chip bg-muted text-muted-foreground">{{ stat.chip }}</span>
        </div>
      </div>
    </div>

    <div class="card payments-workbench">
      <div class="payments-workbench-head border-b border-border">
        <div
          class="payments-tabs bg-muted"
          role="tablist"
          aria-label="Раздел финансового центра"
          @keydown="onTabsKeydown"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :ref="(element) => setTabRef(tab.id, element)"
            class="payments-tab text-muted-foreground aria-selected:text-foreground aria-selected:bg-card"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            @click="onTabClick(tab.id)"
          >
            {{ tab.label }}
            <span
              v-if="tab.id !== 'history'"
              class="payments-tab-count bg-muted text-muted-foreground"
            >
              {{ tab.id === 'attention' ? attentionRows.length : filteredRows.length }}
            </span>
          </button>
        </div>
        <div class="payments-toolbar">
          <label class="payments-search border border-border bg-card text-muted-foreground">
            <UiIcon name="search" />
            <UiInput
              v-model="query"
              type="search"
              placeholder="Поиск ученика..."
              aria-label="Поиск ученика"
              class="text-foreground"
            />
          </label>
        </div>
      </div>

      <div
        v-show="activeTab !== 'history'"
        id="paymentBalances"
        class="payment-balance-list"
        aria-live="polite"
      >
        <div v-show="activeTab === 'attention'" class="payment-panel" role="tabpanel">
          <TransitionGroup
            v-if="attentionRows.length"
            name="entity-card"
            tag="div"
            class="payment-balance-stack"
          >
            <PaymentBalanceItem
              v-for="row in visibleAttention"
              :key="row.student.id"
              :row="row"
              @pay="onBalancePay"
            />
          </TransitionGroup>
          <UiEmptyState
            v-else
            :title="attentionEmptyText"
            :description="attentionEmptyHint"
            compact
          />
          <button
            v-if="attentionRows.length > visibleAttention.length || expanded.attention"
            class="payments-show-more border border-dashed border-border text-primary"
            type="button"
            @click="toggleExpand('attention')"
          >
            {{ expandButtonLabel('attention', attentionRows.length, visibleAttention.length) }}
          </button>
        </div>

        <div v-show="activeTab === 'all'" class="payment-panel" role="tabpanel">
          <TransitionGroup
            v-if="filteredRows.length"
            name="entity-card"
            tag="div"
            class="payment-balance-stack"
          >
            <PaymentBalanceItem
              v-for="row in visibleAll"
              :key="row.student.id"
              :row="row"
              @pay="onBalancePay"
            />
          </TransitionGroup>
          <UiEmptyState
            v-else
            :title="query ? 'Ничего не найдено' : 'Учеников пока нет'"
            :description="
              query
                ? 'Попробуйте изменить поисковый запрос.'
                : 'Здесь появится полный список расчётов.'
            "
            compact
          />
          <button
            v-if="filteredRows.length > visibleAll.length || expanded.all"
            class="payments-show-more border border-dashed border-border text-primary"
            type="button"
            @click="toggleExpand('all')"
          >
            {{ expandButtonLabel('all', filteredRows.length, visibleAll.length) }}
          </button>
        </div>
      </div>

      <div
        v-show="activeTab === 'history'"
        class="payments-history-card payment-subpanel"
        role="tabpanel"
      >
        <div class="section-head payments-history-head">
          <div>
            <h2 class="text-muted-foreground">Оплаты ({{ filteredHistory.length }})</h2>
            <span>{{ historyHint }}</span>
          </div>
          <div class="payments-history-controls">
            <div class="payments-period-picker">
              <button
                class="payments-period-trigger border border-border text-foreground bg-muted"
                type="button"
                :aria-expanded="historyRangeOpen"
                @click="toggleHistoryRange"
              >
                <UiIcon name="calendar" />
                <span>{{ historyRangeLabel }}</span>
              </button>
              <div
                v-if="historyRangeOpen"
                class="payments-mini-calendar border border-border bg-card"
              >
                <div class="payments-mini-calendar-head">
                  <button
                    type="button"
                    class="text-foreground"
                    aria-label="Предыдущий месяц"
                    @click="shiftCalendarMonth(-1)"
                  >
                    ‹
                  </button>
                  <b>{{ calendarTitle }}</b>
                  <button
                    type="button"
                    class="text-foreground"
                    aria-label="Следующий месяц"
                    @click="shiftCalendarMonth(1)"
                  >
                    ›
                  </button>
                </div>
                <div class="payments-mini-weekdays" aria-hidden="true">
                  <span
                    v-for="day in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']"
                    :key="day"
                    class="text-muted-foreground"
                    >{{ day }}</span
                  >
                </div>
                <div class="payments-mini-days">
                  <button
                    v-for="day in calendarDays"
                    :key="day.key"
                    type="button"
                    class="text-foreground"
                    :class="{
                      outside: day.outside,
                      selected: day.selected,
                      'in-range': day.inRange,
                    }"
                    @click="selectRangeDay(day.key)"
                  >
                    {{ day.label }}
                  </button>
                </div>
                <div class="payments-mini-calendar-actions border-t border-border">
                  <button type="button" class="text-foreground bg-muted" @click="resetHistoryRange">
                    Сбросить
                  </button>
                  <button type="button" class="primary bg-primary" @click="applyHistoryRange">
                    Применить
                  </button>
                </div>
              </div>
            </div>
            <label>
              <span class="payments-sr-only">Ученик в истории платежей</span>
              <select
                v-model="historyStudentId"
                class="border border-border bg-muted text-foreground"
              >
                <option value="">Все ученики</option>
                <option v-for="student in model.students" :key="student.id" :value="student.id">
                  {{ student.name }}
                </option>
              </select>
            </label>
          </div>
        </div>
        <div id="paymentHistory" class="payment-history-list">
          <TransitionGroup v-if="filteredHistory.length" name="entity-card">
            <PaymentHistoryItem
              v-for="payment in visibleHistory"
              :key="payment.id"
              :payment="payment"
              @delete="onHistoryDelete"
            />
            <button
              v-if="filteredHistory.length > visibleHistory.length || expanded.history"
              class="payments-show-more border border-dashed border-border text-primary"
              type="button"
              @click="toggleExpand('history')"
            >
              {{ expandButtonLabel('history', filteredHistory.length, visibleHistory.length) }}
            </button>
          </TransitionGroup>
          <UiEmptyState
            v-else
            title="Платежей за этот период нет"
            description="Попробуйте другой период или другого ученика."
            compact
          />
        </div>
      </div>
    </div>
  </UiPageLayout>

  <PaymentForm />
</template>
