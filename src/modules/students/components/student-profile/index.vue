<script src="./scripts/index.js" />

<template>
  <UiModal
    v-if="student"
    :open="studentProfileUi.open"
    title="Карточка ученика"
    :side="false"
    content-class="profile-modal-card"
    @close="closeStudentProfile"
  >
    <div id="profileBody" class="profile-redesign">
      <section class="profile-hero">
        <div class="profile-identity">
          <div class="profile-summary">
            <div>
              <div class="profile-kicker">Ученик</div>
              <h2 style="margin: 0">{{ student.name }}</h2>
              <div class="sub">{{ student.grade || 'Класс не указан' }}</div>
              <a
                v-if="lessonUrl"
                class="btn secondary profile-lesson-link"
                :href="lessonUrl"
                target="_blank"
                rel="noopener"
                >Открыть занятие ↗</a
              >
            </div>
          </div>
        </div>
        <div class="profile-meta">
          <div class="profile-meta-item">
            <span class="profile-meta-icon"><UiIcon name="user" /></span>
            <span
              ><small>Контакты родителя</small
              ><b>{{ parentDetails(student) || 'Не указано' }}</b></span
            >
          </div>
          <div class="profile-meta-item">
            <span class="profile-meta-icon"><UiIcon name="clock" /></span>
            <span
              ><small>Условия занятий</small
              ><b
                >{{ money(student.price) }} · {{ +student.duration || 60 }} мин ·
                {{ paymentFormatLabel }}</b
              ></span
            >
          </div>
          <div v-if="student.contact" class="profile-extra-contacts">
            <div v-if="student.contact">
              <span>Контакт ученика</span><b>{{ student.contact }}</b>
            </div>
          </div>
        </div>
      </section>

      <div class="student-metrics">
        <div class="profile-kpi">
          <span class="profile-kpi-icon profile-kpi-icon-attendance"
            ><UiIcon name="attendance"
          /></span>
          <b>{{ metrics.attendance }}%</b><small>Посещаемость</small>
        </div>
        <div class="profile-kpi">
          <span class="profile-kpi-icon profile-kpi-icon-homework"><UiIcon name="homework" /></span>
          <b>{{ homeworkLabel }}</b
          ><small>Средняя оценка ДЗ</small>
        </div>
        <div class="profile-kpi">
          <span class="profile-kpi-icon profile-kpi-icon-tests"><UiIcon name="tests" /></span>
          <b>{{ testsCount }}</b
          ><small>Проверочных</small>
        </div>
      </div>

      <div class="profile-tabs" role="tablist" aria-label="Разделы карточки ученика">
        <button
          type="button"
          class="profile-tab"
          role="tab"
          :aria-selected="activeTab === 'overview'"
          @click="activeTab = 'overview'"
        >
          Обзор
        </button>
        <button
          type="button"
          class="profile-tab"
          role="tab"
          :aria-selected="activeTab === 'history'"
          @click="activeTab = 'history'"
        >
          История занятий
        </button>
      </div>

      <section v-if="activeTab === 'overview'" class="profile-panel profile-panel-overview">
        <section class="profile-next-card">
          <div class="profile-next-icon"><UiIcon name="calendar" /></div>
          <div class="profile-next-column profile-next-primary">
            <b>Следующее занятие</b><small>Дата и время</small><strong>{{ nextDateLabel }}</strong>
          </div>
          <div class="profile-next-column">
            <small>Регулярное расписание</small
            ><span>{{ scheduleText(student.scheduleSlots) }}</span>
          </div>
          <div class="profile-next-column">
            <small>Пометка на следующий урок</small><span>{{ nextNoteLabel }}</span>
          </div>
        </section>
        <div class="profile-notes-grid">
          <section class="profile-info-card">
            <span class="profile-info-icon profile-info-goals"><UiIcon name="target" /></span>
            <div>
              <b>Цели</b>
              <p>{{ student.goals || 'не указаны' }}</p>
            </div>
          </section>
          <section class="profile-info-card">
            <span class="profile-info-icon profile-info-notes"><UiIcon name="note" /></span>
            <div>
              <b>Заметки</b>
              <p>{{ student.notes || 'нет' }}</p>
            </div>
          </section>
        </div>
        <section class="profile-history-preview">
          <div class="profile-section-title">
            <b>Последнее занятие</b>
            <button type="button" class="profile-history-link" @click="activeTab = 'history'">
              Вся история →
            </button>
          </div>
          <div v-if="lastLesson" class="profile-preview-row">
            <span
              ><small>Дата</small><b>{{ formatDate(lastLesson.date, true) }}</b></span
            >
            <span
              ><small>Статус</small><b>{{ statusLabel(lastLesson.status) }}</b></span
            >
            <span
              ><small>Темы / комментарий</small><b>{{ lastLesson.topics || '—' }}</b></span
            >
            <span
              ><small>ДЗ</small><b>{{ lastLesson.homework || '—' }}</b></span
            >
            <span
              ><small>Проверочная</small
              ><b>{{
                lastLesson.testDone === 'yes' ? lastLesson.testName || 'Работа' : '—'
              }}</b></span
            >
          </div>
          <p v-else class="profile-empty-history">Проведённых занятий пока нет.</p>
        </section>
      </section>

      <section v-else class="profile-panel profile-panel-history">
        <h3 class="profile-history-heading">История занятий</h3>
        <div v-if="lessons.length" style="overflow: auto">
          <table class="mini-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статус</th>
                <th>Темы / комментарий</th>
                <th>ДЗ</th>
                <th>Проверочная</th>
                <th aria-label="Действия"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lesson in lessons.slice(0, 20)"
                :key="lesson.id"
                class="profile-history-row"
                tabindex="0"
                role="button"
                :aria-label="`Открыть занятие ${formatDate(lesson.date, true)}`"
                @click="onHistoryRowClick(lesson.id)"
                @keydown.enter.prevent="onHistoryRowClick(lesson.id)"
              >
                <td data-label="Дата">{{ formatDate(lesson.date, true) }}</td>
                <td data-label="Статус">{{ statusLabel(lesson.status) }}</td>
                <td data-label="Темы / комментарий">
                  {{ lesson.topics || '—' }}<br /><span class="sub">{{
                    lesson.comment || ''
                  }}</span>
                </td>
                <td data-label="ДЗ">
                  <template v-if="lesson.homework"
                    >{{ lesson.homework
                    }}<template v-if="homeworkGrade(lesson) != null"
                      ><br /><b>Оценка {{ homeworkGrade(lesson) }}</b></template
                    ></template
                  >
                  <template v-else-if="homeworkGrade(lesson) == null">—</template>
                  <template v-else>Оценка {{ homeworkGrade(lesson) }}</template>
                </td>
                <td data-label="Проверочная">
                  {{
                    lesson.testDone === 'yes'
                      ? `${lesson.testName || 'Работа'}: ${lesson.testScore || '—'}/${lesson.testMax || '—'}`
                      : '—'
                  }}
                </td>
                <td data-label="">
                  <button
                    class="icon-btn"
                    type="button"
                    title="Удалить занятие"
                    :aria-label="`Удалить занятие ${formatDate(lesson.date, true)}`"
                    @click.stop="onDeleteHistoryLessonClick(lesson.id)"
                  >
                    ×
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">Занятий пока нет</div>
        <template v-if="topicLogEntries.length">
          <h3 style="margin-top: 18px">Ранее пройденные темы (архив)</h3>
          <ul style="margin: 0; padding-left: 18px; max-height: 220px; overflow: auto">
            <li v-for="(entry, index) in topicLogEntries" :key="index" style="margin: 3px 0">
              <b>{{ formatDate(entry.d) }}</b> — {{ entry.t }}
            </li>
          </ul>
        </template>
      </section>
      <div class="profile-finance-sr" hidden>{{ finance?.debt }}</div>
    </div>

    <template #foot>
      <button id="deleteStudent" type="button" class="btn danger" @click="onDeleteButtonClick">
        Удалить
      </button>
      <button id="editStudent" type="button" class="btn secondary" @click="onEditButtonClick">
        Редактировать
      </button>
      <button
        id="addStudentLesson"
        type="button"
        class="btn primary"
        @click="onAddLessonButtonClick"
      >
        + Занятие
      </button>
    </template>
  </UiModal>
</template>
