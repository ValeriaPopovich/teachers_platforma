<script src="./scripts/index.js" />

<template>
  <UiPageLayout>
    <template #header>
      <div class="topbar">
        <div>
          <h1>Профиль</h1>
          <div class="sub">Личные настройки и данные</div>
        </div>
      </div>
    </template>

    <div class="grid settings-grid">
      <div class="card">
        <div class="section-head"><h2>Профиль</h2></div>
        <div class="form-grid">
          <div class="field full">
            <div class="field-label-with-hint">
              <label for="settingTutor">Имя репетитора</label>
              <UiHint text="Имя автоматически добавляется в отчёты родителям." />
            </div>
            <input id="settingTutor" v-model="tutor" placeholder="Имя" />
          </div>
          <div class="field full">
            <div class="field-label-with-hint">
              <label for="settingReminder">Напомнить до урока</label>
              <UiHint text="Напоминания работают, пока платформа открыта в браузере." />
            </div>
            <select id="settingReminder" v-model="reminder">
              <option value="0">Не напоминать</option>
              <option value="5">За 5 минут</option>
              <option value="10">За 10 минут</option>
              <option value="15">За 15 минут</option>
              <option value="30">За 30 минут</option>
              <option value="60">За 1 час</option>
            </select>
          </div>
        </div>
        <UiButton
          id="saveSettings"
          variant="primary"
          style="margin-top: 14px"
          @click="onSaveButtonClick"
        >
          Сохранить
        </UiButton>
      </div>

      <div class="card">
        <div class="section-head"><h2>Аккаунт</h2></div>
        <div class="kpi-line"><span>Почта</span><b id="accountEmail">—</b></div>
        <div class="kpi-line"><span>Доступ</span><b id="accountAccess">Проверяем…</b></div>
        <button id="logoutBtn" class="btn secondary" type="button">Выйти из аккаунта</button>
      </div>

      <div class="card">
        <div class="section-head"><h2>Данные</h2></div>
        <p class="sub">
          Данные автоматически сохраняются в вашем аккаунте и доступны после входа на другом
          устройстве. Рекомендуется делать резервную копию хотя бы раз в месяц.
        </p>
        <div class="actions">
          <button id="exportBtn" class="btn secondary">↓ Скачать копию</button>
          <label class="btn secondary"
            >↑ Загрузить копию<input id="importFile" type="file" accept="application/json" hidden
          /></label>
          <button id="clearBtn" class="btn danger">Удалить все данные</button>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <h2>Как пользоваться платформой</h2>
            <span>Короткий пошаговый туториал по основным разделам</span>
          </div>
        </div>
        <button id="startTutorial" class="btn secondary">Открыть туториал</button>
      </div>

      <div class="card">
        <div class="section-head"><h2>Оформление и канал</h2></div>
        <div class="actions">
          <button class="btn secondary" type="button" @click="onThemeButtonClick">
            Сменить тему
          </button>
          <a
            class="btn subscribe bg-primary text-primary-foreground"
            href="https://t.me/lera_easy_math"
            target="_blank"
            rel="noopener"
            ><svg class="tg-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M16 3.038c0-.535-.423-.994-.995-.895L1.5 4.516c-.693.12-.79 1.048-.127 1.28l3.904 1.366 1.5 4.88c.197.64.992.82 1.441.325l2.141-2.36 4.325 3.198c.55.407 1.333.105 1.478-.568L16 3.038zM6.813 9.15l-.45 2.897-1.397-4.55 7.81-2.733L6.813 9.15z"
              /></svg
            >@lera_easy_math</a
          >
        </div>
      </div>
    </div>
  </UiPageLayout>
</template>
