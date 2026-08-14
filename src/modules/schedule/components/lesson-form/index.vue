<script src="./scripts/index.js" />

<template>
  <UiModal
    :open="lessonFormUi.open"
    :title="modalTitle"
    form-id="lessonForm"
    :subtitle="modalSubtitle"
    title-id="lessonModalTitle"
    content-class="lesson-form-modal"
    wrap-class="ui-modal-wrap--side"
    :should-confirm-close="confirmDiscard.isDirty"
    @close="onModalClose"
    @submit="onFormSubmit"
  >
    <div>
      <input type="hidden" name="id" :value="form.id" />
      <div v-if="lessonContext" class="notice">{{ lessonContext }}</div>
      <div class="form-grid">
        <div v-if="!isEditing" class="field">
          <label>Ученик или группа *</label>
          <select v-model="form.targetId" name="targetId" required :disabled="isEditing">
            <option value="">Выберите ученика или группу</option>
            <option v-for="student in students" :key="student.id" :value="`s:${student.id}`">
              {{ student.name }}
            </option>
            <option v-for="group in groups" :key="group.id" :value="`g:${group.id}`">
              Группа: {{ group.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Дата и время *</label>
          <input v-model="form.date" placeholder=" " name="date" type="datetime-local" required />
        </div>
        <div class="field">
          <label>Длительность, мин *</label>
          <input
            v-model.number="form.duration"
            placeholder=" "
            name="duration"
            type="number"
            min="15"
            step="5"
            required
          />
        </div>

        <div v-show="showAttendance" id="groupAttendance" class="field full">
          <label>Присутствовали на групповом занятии</label>
          <div id="groupAttendanceMembers" class="member-chips">
            <label
              v-for="member in attendanceChips"
              :key="member.id"
              class="member-chip"
              :class="{ selected: attendance.includes(member.id) }"
              ><input
                type="checkbox"
                name="attendance"
                :value="member.id"
                :checked="attendance.includes(member.id)"
                @change="onAttendanceToggle(member.id)"
              />{{ member.name }}</label
            >
          </div>
        </div>

        <div class="field">
          <label>Тип занятия</label>
          <select v-model="form.lessonKind" name="lessonKind" :disabled="isEditing">
            <option v-for="option in lessonKindOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Статус</label>
          <select v-model="form.status" name="status">
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <UiCollapse class="full" :open="showMovedTo">
          <div id="movedToField" class="field full">
            <div class="field-label-with-hint">
              <label>Перенести на *</label>
              <UiHint
                text="Старое занятие останется со статусом «Перенесено», а на новую дату будет создано новое запланированное занятие."
              />
            </div>
            <input v-model="form.movedTo" placeholder=" " name="movedTo" type="datetime-local" />
          </div>
        </UiCollapse>

        <UiCollapse :open="showLessonAmountField">
          <div id="lessonAmountField" class="field">
            <div class="field-label-with-hint">
              <label>Сумма занятия, ₽</label>
              <UiHint
                text="Для разового занятия сумма подставляется из карточки ученика, но её можно изменить для конкретного урока."
              />
            </div>
            <input
              v-model.number="form.amount"
              placeholder=" "
              name="amount"
              type="number"
              min="0"
            />
          </div>
        </UiCollapse>

        <UiCollapse :open="showLessonPaymentField">
          <div id="lessonPaymentField" class="field lesson-paid-field">
            <div class="field-inline-control">
              <label class="toggle-row"
                ><input
                  id="lessonPaymentToggle"
                  v-model="lessonPaymentToggle"
                  type="checkbox"
                /><span class="toggle-ui"></span
                ><span
                  ><b>{{ lessonPaymentLabel }}</b></span
                ></label
              >
              <UiHint :text="lessonPaymentHint" :label="`Пояснение: ${lessonPaymentLabel}`" />
            </div>
          </div>
        </UiCollapse>

        <UiCollapse class="full" :open="showTopics">
          <div class="field full">
            <label>Пройденные темы</label>
            <input
              v-model="form.topics"
              name="topics"
              placeholder="Линейные уравнения, раскрытие скобок"
            />
          </div>
        </UiCollapse>

        <UiCollapse class="full" :open="showReportFields">
          <div class="field full">
            <label class="toggle-row"
              ><input id="testDoneToggle" v-model="testDoneToggle" type="checkbox" /><span
                class="toggle-ui"
              ></span
              ><span><b>Была проверочная работа</b></span></label
            >
          </div>
        </UiCollapse>
        <UiCollapse class="full" :open="testDoneToggle && showReportFields">
          <div id="testFields" class="field full">
            <div class="form-grid">
              <div class="field">
                <label>Название проверочной</label>
                <input
                  v-model="form.testName"
                  name="testName"
                  placeholder="Уравнения, самостоятельная работа"
                />
              </div>
              <div class="field">
                <span class="field-group-label">Результат</span>
                <div class="test-result-fields">
                  <div class="field" :class="{ 'is-invalid': testScoreError }">
                    <label for="lessonTestScore">Баллы</label>
                    <input
                      id="lessonTestScore"
                      v-model="form.testScore"
                      name="testScore"
                      type="number"
                      min="0"
                      :max="form.testMax || undefined"
                      placeholder=" "
                      :required="testDoneToggle"
                      :aria-invalid="Boolean(testScoreError)"
                      :aria-describedby="testScoreError ? 'lessonTestScoreError' : undefined"
                    />
                  </div>
                  <div class="field" :class="{ 'is-invalid': testScoreError }">
                    <label for="lessonTestMax">Максимум</label>
                    <input
                      id="lessonTestMax"
                      v-model="form.testMax"
                      name="testMax"
                      type="number"
                      min="1"
                      placeholder=" "
                      :required="testDoneToggle"
                      :aria-invalid="Boolean(testScoreError)"
                      :aria-describedby="testScoreError ? 'lessonTestScoreError' : undefined"
                    />
                  </div>
                </div>
                <small v-if="testScoreError" id="lessonTestScoreError" class="field-error">{{
                  testScoreError
                }}</small>
              </div>
            </div>
          </div>
        </UiCollapse>

        <UiCollapse class="full" :open="showPreviousHomework">
          <div class="field full">
            <label>Домашнее задание</label>
            <div class="card lesson-homework-card" style="box-shadow: none; padding: 13px">
              <div class="form-grid">
                <div class="field">
                  <label class="toggle-row"
                    ><input
                      id="previousHomeworkToggle"
                      v-model="previousHomeworkToggle"
                      type="checkbox"
                    /><span class="toggle-ui"></span
                    ><span
                      ><b>Было предыдущее ДЗ</b
                      ><small>Включите, чтобы поставить оценку</small></span
                    ></label
                  >
                </div>
                <UiCollapse :open="previousHomeworkToggle">
                  <div id="homeworkGradeField" class="field">
                    <label>Оценка за предыдущее ДЗ</label>
                    <select
                      v-model="form.homeworkGrade"
                      name="homeworkGrade"
                      :disabled="!previousHomeworkToggle"
                    >
                      <option
                        v-for="option in homeworkGradeOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </UiCollapse>
                <UiCollapse class="full" :open="showReportFields">
                  <div class="field full">
                    <label>Новое ДЗ</label>
                    <textarea
                      v-model="form.homework"
                      name="homework"
                      placeholder="№ 15–23, повторить формулы..."
                    ></textarea>
                  </div>
                </UiCollapse>
              </div>
            </div>
          </div>
        </UiCollapse>
        <UiCollapse class="full" :open="showReportFields">
          <div class="field full">
            <div class="field-label-with-hint">
              <label for="lessonNextNote">Пометка на следующий урок</label>
              <UiHint
                text="Пометка появится в карточке ученика и перед его ближайшим занятием. Для группы она будет видна всем участникам."
              />
            </div>
            <textarea
              id="lessonNextNote"
              v-model="form.nextNote"
              name="nextNote"
              placeholder="Распечатать карточку, проверить конкретное задание..."
            ></textarea>
          </div>
        </UiCollapse>

        <div class="field full">
          <label>Комментарий об уроке</label>
          <textarea
            v-model="form.comment"
            name="comment"
            placeholder="Что получилось, где были трудности, настроение..."
          ></textarea>
        </div>

        <UiCollapse class="full" :open="showParentMessage">
          <div id="parentMessageField" class="field full">
            <div class="field-label-with-hint">
              <label>Сообщение родителю</label>
              <UiHint
                text="Текст соберётся из данных о занятии. Его можно изменить перед копированием."
              />
            </div>
            <div class="textarea-copy">
              <textarea
                id="parentMessage"
                v-model="parentMessage"
                placeholder=" "
                rows="5"
              ></textarea>
              <button
                id="copyParentMessage"
                class="copy-textarea-btn"
                type="button"
                title="Скопировать сообщение"
                aria-label="Скопировать сообщение"
                @click="onCopyParentMessageClick"
              >
                <span aria-hidden="true">⧉</span>
              </button>
            </div>
          </div>
        </UiCollapse>
      </div>
      <div id="lessonConflict" class="conflict-error">{{ conflictMessage }}</div>
    </div>

    <template #foot>
      <button
        v-show="isEditing"
        id="deleteLesson"
        type="button"
        class="btn danger"
        style="margin-right: auto"
        @click="onDeleteButtonClick"
      >
        Удалить занятие
      </button>
      <button type="submit" class="btn primary">Сохранить отчёт</button>
    </template>
  </UiModal>
</template>
