<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="payments-page">
    <template #header>
      <div class="topbar payments-topbar">
        <div><h1>Управление расчётами</h1></div>
        <UiButton variant="primary" class="payments-primary-action" data-open="payment">
          <template #iconBefore><UiIcon name="card" /></template>
          <span>Принять оплату</span>
        </UiButton>
      </div>
    </template>

    <div id="analyticsCard" class="payments-summary">
      <span id="analyticsRangeLabel" class="payments-sr-only">{{ model.monthLabel }}</span>
      <div id="paymentStats" class="grid stats payments-stats">
        <div v-for="stat in statCards" :key="stat.key" class="card stat" :class="stat.extra">
          <div class="label">{{ stat.label }}</div>
          <span class="help-tip" tabindex="0" :data-tip="stat.tip">?</span>
          <div class="value">{{ stat.value }}</div>
          <small class="payment-stat-note">{{ stat.note }}</small>
          <span class="payment-stat-chip">{{ stat.chip }}</span>
        </div>
      </div>
    </div>

    <div class="card payments-workbench">
      <div class="payments-workbench-head">
        <div
          class="payments-tabs"
          role="tablist"
          aria-label="Раздел финансового центра"
          @keydown="onTabsKeydown"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :ref="(element) => setTabRef(tab.id, element)"
            class="payments-tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            @click="onTabClick(tab.id)"
          >
            {{ tab.label }}
            <span v-if="tab.id !== 'history'" class="payments-tab-count">
              {{ tab.id === 'attention' ? attentionRows.length : filteredRows.length }}
            </span>
          </button>
        </div>
        <div class="payments-toolbar">
          <label class="payments-search">
            <UiIcon name="search" />
            <UiInput
              v-model="query"
              type="search"
              placeholder="Поиск ученика..."
              aria-label="Поиск ученика"
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
          <div v-if="attentionRows.length" class="payment-balance-stack">
            <PaymentBalanceItem
              v-for="row in visibleAttention"
              :key="row.student.id"
              :row="row"
              @pay="onBalancePay"
            />
          </div>
          <div v-else class="payments-empty">
            <div>
              <b>{{ attentionEmptyText }}</b
              >{{ attentionEmptyHint }}
            </div>
          </div>
          <button
            v-if="attentionRows.length > visibleAttention.length || expanded.attention"
            class="payments-show-more"
            type="button"
            @click="toggleExpand('attention')"
          >
            {{ expandButtonLabel('attention', attentionRows.length, visibleAttention.length) }}
          </button>
        </div>

        <div v-show="activeTab === 'all'" class="payment-panel" role="tabpanel">
          <div v-if="filteredRows.length" class="payment-balance-stack">
            <PaymentBalanceItem
              v-for="row in visibleAll"
              :key="row.student.id"
              :row="row"
              @pay="onBalancePay"
            />
          </div>
          <div v-else class="payments-empty">
            <div><b>Учеников пока нет</b>Здесь появится полный список расчётов.</div>
          </div>
          <button
            v-if="filteredRows.length > visibleAll.length || expanded.all"
            class="payments-show-more"
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
            <h2>Транзакции ({{ filteredHistory.length }})</h2>
            <span>{{ historyHint }}</span>
          </div>
          <div class="payments-history-controls">
            <label>
              <span class="payments-sr-only">Период истории</span>
              <select v-model.number="historyDays">
                <option :value="31">Этот месяц</option>
                <option :value="45">Последние 45 дней</option>
              </select>
            </label>
            <label>
              <span class="payments-sr-only">Ученик в истории платежей</span>
              <select v-model="historyStudentId">
                <option value="">Все ученики</option>
                <option v-for="student in model.students" :key="student.id" :value="student.id">
                  {{ student.name }}
                </option>
              </select>
            </label>
          </div>
        </div>
        <div id="paymentHistory" class="payment-history-list">
          <template v-if="filteredHistory.length">
            <PaymentHistoryItem
              v-for="payment in visibleHistory"
              :key="payment.id"
              :payment="payment"
              @delete="onHistoryDelete"
            />
            <button
              v-if="filteredHistory.length > visibleHistory.length || expanded.history"
              class="payments-show-more"
              type="button"
              @click="toggleExpand('history')"
            >
              {{ expandButtonLabel('history', filteredHistory.length, visibleHistory.length) }}
            </button>
          </template>
          <div v-else class="payments-empty">
            <div>
              <b>Платежей за этот период нет</b>Попробуйте другой период или другого ученика.
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiPageLayout>
</template>
