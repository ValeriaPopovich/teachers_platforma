<script src="./scripts/index.js" />

<template>
  <UiEmptyState
    v-if="!students.length"
    title="Сначала добавьте ученика"
    description="Отчёт собирается из истории занятий конкретного ученика."
  >
    <template #action
      ><UiButton variant="primary" @click="openNewStudent">+ Добавить ученика</UiButton></template
    >
  </UiEmptyState>
  <template v-else>
    <div class="topbar reports-topbar">
      <div>
        <h1>Отчёты родителям</h1>
        <div class="sub">
          Настройте содержание отчёта и скачайте готовый результат для родителей
        </div>
      </div>
    </div>
    <div class="report-builder">
      <div class="card reports-editor" aria-label="Настройка отчёта">
        <div class="reports-editor-head border-b border-border">
          <div class="reports-editor-title"><h2>Настройка отчёта</h2></div>
          <label class="report-include-toggle"
            ><input
              type="checkbox"
              :checked="blocks.general"
              @change="onBlockCheckboxChange('general')"
            /><span class="report-toggle-icon" aria-hidden="true"></span
            ><span class="report-toggle-state">В отчёте</span></label
          >
        </div>
        <div class="reports-editor-form">
          <div class="field">
            <label for="reportStudent">Ученик</label>
            <select id="reportStudent" v-model="studentId" @change="onStudentChange">
              <option value="">Выберите ученика</option>
              <option v-for="item in students" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="reportPeriod">Период данных</label>
            <select id="reportPeriod" v-model="period">
              <option v-for="option in periodOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div v-show="period === 'custom'" class="field full">
            <div class="form-grid">
              <div class="field">
                <label for="reportDateFrom">С</label
                ><input id="reportDateFrom" v-model="dateFrom" placeholder=" " type="date" />
              </div>
              <div class="field">
                <label for="reportDateTo">По</label
                ><input id="reportDateTo" v-model="dateTo" placeholder=" " type="date" />
              </div>
            </div>
          </div>
          <div class="field full">
            <label for="reportComment">Комментарий родителю</label>
            <textarea
              id="reportComment"
              v-model="comment"
              placeholder="Что получается, над чем работаем..."
            ></textarea>
          </div>
        </div>

        <div id="reportAccordion" class="report-accordion border-t border-border">
          <section
            class="report-editor-section is-open bg-card border-b border-border"
            data-report-editor-section="topics"
          >
            <div class="report-editor-section-head">
              <button
                class="report-section-toggle text-foreground"
                type="button"
                aria-expanded="true"
                aria-controls="reportTopicsPanel"
              >
                <span
                  class="report-section-chevron text-muted-foreground bg-muted"
                  aria-hidden="true"
                  ><svg viewBox="0 0 20 20"><path d="m7 4 6 6-6 6" /></svg></span
                ><span class="report-section-name">Пройденные темы</span
                ><span
                  class="report-section-count text-muted-foreground bg-muted border border-border"
                  data-report-count="topics"
                  >0 тем</span
                >
              </button>
              <div class="report-section-actions">
                <label class="report-include-toggle"
                  ><input
                    type="checkbox"
                    :checked="blocks.topics"
                    @change="onBlockCheckboxChange('topics')"
                  /><span class="report-toggle-icon" aria-hidden="true"></span
                  ><span class="report-toggle-state">В отчёте</span></label
                >
                <button
                  class="report-add-btn"
                  type="button"
                  aria-label="Добавить тему"
                  @click="onAddRow('topics')"
                >
                  +
                </button>
              </div>
            </div>
            <div id="reportTopicsPanel" class="report-editor-panel">
              <div id="reportTopics" ref="topicsListEl" class="builder-list" @input="onListInput">
                <div
                  v-for="row in topics"
                  :key="row.id"
                  class="builder-item topic border border-border bg-muted"
                  :data-row-id="row.id"
                >
                  <button
                    type="button"
                    class="report-drag-handle text-muted-foreground"
                    draggable="true"
                    aria-label="Перетащить строку"
                    title="Перетащить"
                  ></button>
                  <input v-model="row.value" class="r-name" placeholder="Введите текст" />
                  <button
                    type="button"
                    class="icon-btn r-remove"
                    aria-label="Удалить строку"
                    @click="onRemoveRow('topics', row.id)"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p class="report-editor-empty text-muted-foreground" data-report-empty="topics"></p>
            </div>
          </section>

          <section
            class="report-editor-section bg-card border-b border-border"
            data-report-editor-section="tests"
          >
            <div class="report-editor-section-head">
              <button
                class="report-section-toggle text-foreground"
                type="button"
                aria-expanded="false"
                aria-controls="reportTestsPanel"
              >
                <span
                  class="report-section-chevron text-muted-foreground bg-muted"
                  aria-hidden="true"
                  ><svg viewBox="0 0 20 20"><path d="m7 4 6 6-6 6" /></svg></span
                ><span class="report-section-name">Проверочные работы</span
                ><span
                  class="report-section-count text-muted-foreground bg-muted border border-border"
                  data-report-count="tests"
                  >0 работ</span
                >
              </button>
              <div class="report-section-actions">
                <label class="report-include-toggle"
                  ><input
                    type="checkbox"
                    :checked="blocks.tests"
                    @change="onBlockCheckboxChange('tests')"
                  /><span class="report-toggle-icon" aria-hidden="true"></span
                  ><span class="report-toggle-state">В отчёте</span></label
                >
                <button
                  class="report-add-btn"
                  type="button"
                  aria-label="Добавить проверочную работу"
                  @click="onAddRow('tests')"
                >
                  +
                </button>
              </div>
            </div>
            <div id="reportTestsPanel" class="report-editor-panel" hidden>
              <div id="reportTests" ref="testsListEl" class="builder-list" @input="onListInput">
                <div
                  v-for="row in tests"
                  :key="row.id"
                  class="builder-item border border-border bg-muted"
                  :data-row-id="row.id"
                >
                  <button
                    type="button"
                    class="report-drag-handle text-muted-foreground"
                    draggable="true"
                    aria-label="Перетащить строку"
                    title="Перетащить"
                  ></button>
                  <input v-model="row.value" class="r-name" placeholder="Введите текст" />
                  <button
                    type="button"
                    class="icon-btn r-remove"
                    aria-label="Удалить строку"
                    @click="onRemoveRow('tests', row.id)"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p class="report-editor-empty text-muted-foreground" data-report-empty="tests"></p>
            </div>
          </section>

          <section
            class="report-editor-section bg-card border-b border-border"
            data-report-editor-section="hws"
          >
            <div class="report-editor-section-head">
              <button
                class="report-section-toggle text-foreground"
                type="button"
                aria-expanded="false"
                aria-controls="reportHwsPanel"
              >
                <span
                  class="report-section-chevron text-muted-foreground bg-muted"
                  aria-hidden="true"
                  ><svg viewBox="0 0 20 20"><path d="m7 4 6 6-6 6" /></svg></span
                ><span class="report-section-name">Домашние задания</span
                ><span
                  class="report-section-count text-muted-foreground bg-muted border border-border"
                  data-report-count="hws"
                  >0 записей</span
                >
              </button>
              <div class="report-section-actions">
                <label class="report-include-toggle"
                  ><input
                    type="checkbox"
                    :checked="blocks.hws"
                    @change="onBlockCheckboxChange('hws')"
                  /><span class="report-toggle-icon" aria-hidden="true"></span
                  ><span class="report-toggle-state">В отчёте</span></label
                >
                <button
                  class="report-add-btn"
                  type="button"
                  aria-label="Добавить домашнее задание"
                  @click="onAddRow('hws')"
                >
                  +
                </button>
              </div>
            </div>
            <div id="reportHwsPanel" class="report-editor-panel" hidden>
              <div id="reportHws" ref="hwsListEl" class="builder-list" @input="onListInput">
                <div
                  v-for="row in hws"
                  :key="row.id"
                  class="builder-item border border-border bg-muted"
                  :data-row-id="row.id"
                >
                  <button
                    type="button"
                    class="report-drag-handle text-muted-foreground"
                    draggable="true"
                    aria-label="Перетащить строку"
                    title="Перетащить"
                  ></button>
                  <input v-model="row.value" class="r-name" placeholder="Введите текст" />
                  <button
                    type="button"
                    class="icon-btn r-remove"
                    aria-label="Удалить строку"
                    @click="onRemoveRow('hws', row.id)"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p class="report-editor-empty text-muted-foreground" data-report-empty="hws"></p>
            </div>
          </section>

          <section
            v-show="showNextPackage"
            class="report-editor-section bg-card border-b border-border"
            data-report-editor-section="nextPackage"
          >
            <div class="report-editor-section-head">
              <button
                class="report-section-toggle text-foreground"
                type="button"
                aria-expanded="false"
                aria-controls="reportNextPackagePanel"
              >
                <span
                  class="report-section-chevron text-muted-foreground bg-muted"
                  aria-hidden="true"
                  ><svg viewBox="0 0 20 20"><path d="m7 4 6 6-6 6" /></svg></span
                ><span class="report-section-name">Информация на следующий месяц</span>
              </button>
              <div class="report-section-actions">
                <label class="report-include-toggle"
                  ><input
                    type="checkbox"
                    :checked="blocks.nextPackage"
                    @change="onBlockCheckboxChange('nextPackage')"
                  /><span class="report-toggle-icon" aria-hidden="true"></span
                  ><span class="report-toggle-state">В отчёте</span></label
                >
              </div>
            </div>
            <div id="reportNextPackagePanel" class="report-editor-panel report-next-package-panel">
              <label
                class="report-next-package-label text-foreground"
                for="reportNextPackagePreview"
                >Текст для родителя</label
              >
              <textarea
                id="reportNextPackagePreview"
                v-model="nextPackagePreview"
                rows="5"
                class="bg-muted border border-border text-foreground"
                placeholder="Добавьте информацию о плане и стоимости на следующий месяц"
              ></textarea>
            </div>
          </section>
        </div>
      </div>

      <div class="report-preview-column">
        <div id="reportCard" class="report-paper">
          <div class="paper-head">
            <h2>Итоговый отчёт</h2>
            <div id="paperPills" class="paper-pills">
              <template v-if="student">
                <span class="paper-pill">{{ student.name }}</span>
                <span class="paper-pill">{{ periodLabel }}</span>
              </template>
              <span v-else class="paper-pill">Выберите ученика</span>
            </div>
          </div>
          <div class="paper-body">
            <div v-show="blocks.general" class="paper-section" data-report-section="general">
              <h3>Общая информация</h3>
              <div id="paperComment" :class="{ 'report-empty': !comment.trim() }">
                {{ comment.trim() || '—' }}
              </div>
              <div class="ring-box">
                <div id="paperRing" class="ring-css">
                  <svg viewBox="0 0 128 128" aria-hidden="true">
                    <circle class="ring-track" cx="64" cy="64" r="52"></circle>
                    <circle
                      id="paperRingValue"
                      class="ring-value"
                      cx="64"
                      cy="64"
                      r="52"
                      :style="{
                        strokeDasharray: `${ringCircumference}`,
                        strokeDashoffset: `${ringOffset}`,
                      }"
                    ></circle>
                  </svg>
                  <b id="paperPct">{{ student ? source.progressPercent : 0 }}%</b>
                </div>
              </div>
            </div>
            <div v-show="blocks.topics" class="paper-section" data-report-section="topics">
              <h3>Пройденные темы</h3>
              <div id="paperTopics" :class="{ 'report-empty': !paperTopics.length }">
                <ul v-if="paperTopics.length">
                  <li v-for="(item, index) in paperTopics" :key="index">{{ item }}</li>
                </ul>
                <template v-else>—</template>
              </div>
            </div>
            <div v-show="blocks.hws" class="paper-section" data-report-section="hws">
              <h3>Домашние задания</h3>
              <div id="paperHws" :class="{ 'report-empty': !paperHws.length }">
                <ul v-if="paperHws.length">
                  <li v-for="(item, index) in paperHws" :key="index">{{ item }}</li>
                </ul>
                <template v-else>—</template>
              </div>
            </div>
            <div v-show="blocks.tests" class="paper-section" data-report-section="tests">
              <h3>Проверочные работы</h3>
              <div id="paperTests" :class="{ 'report-empty': !paperTests.length }">
                <ul v-if="paperTests.length">
                  <li v-for="(item, index) in paperTests" :key="index">{{ item }}</li>
                </ul>
                <template v-else>—</template>
              </div>
            </div>
            <div
              v-show="blocks.nextPackage && showNextPackage"
              id="paperNextPackageSection"
              class="paper-section"
              data-report-section="nextPackage"
            >
              <h3>Следующий месяц</h3>
              <div id="paperNextPackage">{{ nextPackagePreview.trim() || '—' }}</div>
            </div>
          </div>
        </div>
        <div class="report-tools-spacer" aria-hidden="true"></div>
        <div class="report-tools" role="group" aria-label="Действия с готовым отчётом">
          <button id="copyReportText" class="btn secondary" @click="onCopyTextButtonClick">
            Копировать текст
          </button>
          <button id="saveReportPng" class="btn secondary" @click="onSavePngButtonClick">
            ↓ Скачать PNG
          </button>
        </div>
      </div>
    </div>
  </template>
</template>
