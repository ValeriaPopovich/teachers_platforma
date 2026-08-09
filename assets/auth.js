(() => {
  const SUPABASE_URL = 'https://rbpxlzwycacrfupsthdn.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_LNR81I5WJ9kWXY4yD18FTw_at6E4uZK';
  const STORAGE_KEY = 'tutorCabinet_v1';
  const OWNER_KEY = 'tutorCabinet_owner_user_id';
  const SITE_URL = 'https://valeriapopovich.github.io/teachers_platforma/';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
  });
  window.tutorCloud = {
    client,
    user: null,
    profile: null,
    ready: false,
    allowUnownedBootstrap: false,
    queueSave: null,
    flushSave: null,
  };
  const gate = document.getElementById('authGate'),
    loginView = document.getElementById('authLoginView'),
    accessView = document.getElementById('authAccessView'),
    setPwdView = document.getElementById('authSetPasswordView'),
    message = document.getElementById('authMessage'),
    setPwdMessage = document.getElementById('authSetPasswordMessage'),
    status = document.getElementById('cloudStatus');
  const MAGIC_COOLDOWN_KEY = 'tutor_magic_cooldown_until';
  const AUTH_MODES = {
    password: {
      title: 'Вход в платформу',
      desc: 'Введите почту и пароль. <strong>Входите впервые?</strong> Откройте письмо-приглашение — платформа попросит придумать пароль.',
      pwd: true,
      submit: 'Войти',
      primary: true,
    },
    recovery: {
      title: 'Восстановление пароля',
      desc: 'Введите свою почту — отправим ссылку, по которой вы придумаете новый пароль.',
      pwd: false,
      submit: 'Отправить ссылку для сброса',
      primary: false,
    },
  };
  let saveTimer = null,
    lastSaved = '',
    pendingRaw = '',
    saveChain = Promise.resolve(true),
    openingUser = '',
    recoveryMode = false,
    authMode = 'password';
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  }
  function showMessage(text, error = false, el = message) {
    el.textContent = text;
    el.className = 'auth-message show' + (error ? ' error' : '');
  }
  function showRichMessage(html, error = false, el = message) {
    el.innerHTML = html;
    el.className = 'auth-message show' + (error ? ' error' : '');
  }
  function showView(name) {
    gate.hidden = false;
    loginView.hidden = name !== 'login';
    setPwdView.hidden = name !== 'setpwd';
    accessView.hidden = name !== 'access';
    if (name === 'login' && authMode !== 'password') setAuthMode('password');
  }
  function magicCooldownLeft() {
    return Math.max(
      0,
      Math.ceil(((+sessionStorage.getItem(MAGIC_COOLDOWN_KEY) || 0) - Date.now()) / 1000),
    );
  }
  function startMagicCooldown() {
    sessionStorage.setItem(MAGIC_COOLDOWN_KEY, Date.now() + 60000);
  }
  function setAuthMode(mode) {
    const c = AUTH_MODES[mode] || AUTH_MODES.password;
    authMode = mode;
    document.getElementById('authTitle').textContent = c.title;
    document.getElementById('authDescription').innerHTML = c.desc;
    document.getElementById('authPasswordField').hidden = !c.pwd;
    const submit = document.getElementById('authSubmit');
    submit.textContent = c.submit;
    submit.disabled = false;
    document.getElementById('authLinksPassword').hidden = !c.primary;
    document.getElementById('authLinksAlt').hidden = c.primary;
    message.className = 'auth-message';
    message.textContent = '';
    document.getElementById('authEmail').focus();
  }
  async function emailExistsInDb(email) {
    try {
      const { data, error } = await client.rpc('email_exists', { check_email: email });
      if (error) {
        console.warn('email_exists rpc failed:', error);
        return null;
      }
      return !!data;
    } catch (e) {
      console.warn(e);
      return null;
    }
  }
  function friendlyAuthError(err) {
    const m = err?.message || '';
    if (/rate limit/i.test(m))
      return 'Слишком много запросов. Подождите пару минут и попробуйте снова.';
    if (/invalid.*credentials|invalid login/i.test(m))
      return 'Не удалось войти. Проверьте пароль. Если вы его ещё не задавали (или впервые входите с этого устройства) — нажмите «Забыли пароль?», мы вышлем ссылку.';
    if (/email not confirmed/i.test(m))
      return 'Почта не подтверждена. Откройте письмо-приглашение и перейдите по ссылке.';
    if (/reauth/i.test(m))
      return 'Сессия слишком старая для смены пароля. Сейчас выйдем — войдите по ссылке из почты и попробуйте снова.';
    return 'Не удалось выполнить действие: ' + m;
  }
  function showSync(text, kind = '') {
    status.querySelector('span').textContent = text;
    status.className = 'cloud-status show ' + kind;
    clearTimeout(showSync.timer);
    if (kind !== 'error') showSync.timer = setTimeout(() => status.classList.remove('show'), 1800);
  }
  function localOwner() {
    return localStorage.getItem(OWNER_KEY) || '';
  }
  function setLocalOwner(userId) {
    localStorage.setItem(OWNER_KEY, userId);
  }
  function canUploadLocalState(owner, userId, allowUnowned) {
    return owner === userId || (!owner && allowUnowned);
  }
  function resetCloudRuntime() {
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingRaw = '';
    lastSaved = '';
    openingUser = '';
    window.tutorCloud.user = null;
    window.tutorCloud.profile = null;
    window.tutorCloud.ready = false;
    window.tutorCloud.allowUnownedBootstrap = false;
  }
  async function pushCloud(raw = localStorage.getItem(STORAGE_KEY)) {
    if (!window.tutorCloud.ready || !window.tutorCloud.user || !raw || raw === lastSaved)
      return true;
    const owner = localOwner(),
      userId = window.tutorCloud.user.id;
    if (!canUploadLocalState(owner, userId, window.tutorCloud.allowUnownedBootstrap)) {
      showSync('Локальные данные принадлежат другому аккаунту', 'error');
      return false;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      showSync('Не удалось сохранить', 'error');
      return false;
    }
    showSync('Сохраняем…', 'saving');
    const { error } = await client
      .from('app_data')
      .upsert(
        { user_id: userId, data: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) {
      showSync('Не удалось сохранить', 'error');
      console.error('Cloud save:', error);
      return false;
    }
    setLocalOwner(userId);
    window.tutorCloud.allowUnownedBootstrap = false;
    lastSaved = raw;
    showSync('Сохранено');
    return true;
  }
  function enqueueCloudSave(raw) {
    saveChain = saveChain.catch(() => false).then(() => pushCloud(raw));
    return saveChain;
  }
  function queueCloudSave(raw) {
    pendingRaw = raw;
    if (!window.tutorCloud.ready) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const next = pendingRaw;
      pendingRaw = '';
      if (next) enqueueCloudSave(next);
    }, 500);
  }
  async function flushCloudSave() {
    if (!window.tutorCloud.ready) return true;
    clearTimeout(saveTimer);
    saveTimer = null;
    const next = pendingRaw || localStorage.getItem(STORAGE_KEY);
    pendingRaw = '';
    return enqueueCloudSave(next);
  }
  window.tutorCloud.queueSave = queueCloudSave;
  window.tutorCloud.flushSave = flushCloudSave;
  window.addEventListener('online', () => flushCloudSave());
  async function openAccount(user) {
    if (openingUser === user.id || window.tutorCloud.ready) return;
    openingUser = user.id;
    window.tutorCloud.user = user;
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('email,status,access_until')
      .eq('user_id', user.id)
      .single();
    if (profileError) {
      openingUser = '';
      showMessage('Не удалось проверить доступ. Обновите страницу чуть позже.', true);
      console.error(profileError);
      return;
    }
    window.tutorCloud.profile = profile;
    const expired = profile.access_until && new Date(profile.access_until) <= new Date();
    if (profile.status !== 'active' || expired) {
      openingUser = '';
      loginView.hidden = true;
      accessView.hidden = false;
      document.getElementById('authAccessTitle').textContent =
        profile.status === 'blocked' ? 'Доступ приостановлен' : 'Срок доступа закончился';
      document.getElementById('authAccessText').textContent =
        profile.status === 'blocked'
          ? 'Аккаунт временно заблокирован. Напишите администратору.'
          : `Доступ закончился ${new Date(profile.access_until).toLocaleDateString('ru-RU')}. Напишите администратору для продления.`;
      return;
    }
    const { data: cloudRow, error: cloudError } = await client
      .from('app_data')
      .select('data,updated_at')
      .eq('user_id', user.id)
      .single();
    if (cloudError) {
      openingUser = '';
      showMessage('Не удалось загрузить ваши данные. Обновите страницу чуть позже.', true);
      console.error(cloudError);
      return;
    }
    const cloudData = cloudRow?.data && typeof cloudRow.data === 'object' ? cloudRow.data : {};
    const hasCloud = Object.keys(cloudData).length > 0;
    const marker = sessionStorage.getItem('tutor_cloud_loaded_user');
    if (hasCloud && marker !== user.id) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
      setLocalOwner(user.id);
      sessionStorage.setItem('tutor_cloud_loaded_user', user.id);
      location.reload();
      return;
    }
    const owner = localOwner();
    if (!hasCloud && owner && owner !== user.id) {
      openingUser = '';
      loginView.hidden = true;
      setPwdView.hidden = true;
      accessView.hidden = false;
      document.getElementById('authAccessTitle').textContent = 'Локальные данные не открыты';
      document.getElementById('authAccessText').textContent =
        'Локальная копия принадлежит другому аккаунту. Автоматическая отправка в облако заблокирована.';
      return;
    }
    sessionStorage.setItem('tutor_cloud_loaded_user', user.id);
    window.tutorCloud.ready = true;
    window.tutorCloud.allowUnownedBootstrap = !hasCloud && !owner;
    lastSaved = hasCloud ? JSON.stringify(cloudData) : '';
    if (hasCloud) {
      setLocalOwner(user.id);
      pendingRaw = '';
    } else if (!(await flushCloudSave())) {
      openingUser = '';
      return;
    }
    document.getElementById('accountEmail').textContent = profile.email || user.email || '—';
    document.getElementById('accountAccess').textContent = profile.access_until
      ? `до ${new Date(profile.access_until).toLocaleDateString('ru-RU')}`
      : 'Без ограничения';
    openingUser = '';
    gate.hidden = true;
  }
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim(),
      btn = document.getElementById('authSubmit');
    if (!email || !isValidEmail(email)) {
      showMessage('Введите корректный адрес почты — например, name@example.com.', true);
      document.getElementById('authEmail').focus();
      return;
    }
    if (authMode === 'password') {
      const password = document.getElementById('authPassword').value;
      if (!password) {
        showMessage(
          'Введите пароль. Если вы его ещё не задавали — нажмите «Войти по ссылке на почту».',
          true,
        );
        document.getElementById('authPassword').focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Входим…';
      message.className = 'auth-message';
      const { error } = await client.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      btn.textContent = 'Войти';
      if (error) showMessage(friendlyAuthError(error), true);
      return;
    }
    const left = magicCooldownLeft();
    if (left > 0) {
      showMessage(`Только что уже отправляли письмо. Попробуйте снова через ${left} сек.`, true);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Проверяем…';
    message.className = 'auth-message';
    const exists = await emailExistsInDb(email);
    if (exists === false) {
      btn.disabled = false;
      btn.textContent = AUTH_MODES[authMode].submit;
      showRichMessage(
        '<strong>Аккаунта с такой почтой нет.</strong><br>Проверьте адрес или напишите <b>@leraMathTutor</b> — доступ выдаётся по приглашению.',
        true,
      );
      return;
    }
    btn.textContent = 'Отправляем…';
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    btn.disabled = false;
    btn.textContent = AUTH_MODES.recovery.submit;
    if (error) showMessage(friendlyAuthError(error), true);
    else {
      startMagicCooldown();
      showRichMessage(
        '<strong>🔑 Ссылка для сброса пароля отправлена на ' +
          escHtml(email) +
          '</strong><br>Откройте письмо (тема — <code>Reset Your Password</code>, отправитель — <code>LeraMathTutor</code>) и придумайте новый пароль. <strong>Проверьте «Спам» и «Промоакции»</strong> — письма часто попадают туда.',
      );
    }
  });
  document.getElementById('authForgot').addEventListener('click', () => setAuthMode('recovery'));
  document
    .getElementById('authBackToPassword')
    .addEventListener('click', () => setAuthMode('password'));
  document.getElementById('authSetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('authNewPassword').value,
      p2 = document.getElementById('authNewPassword2').value,
      btn = document.getElementById('authSetPasswordSubmit');
    if (p1.length < 8) {
      showMessage('Пароль слишком короткий — минимум 8 символов.', true, setPwdMessage);
      return;
    }
    if (p1 !== p2) {
      showMessage('Пароли не совпадают.', true, setPwdMessage);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    setPwdMessage.className = 'auth-message';
    const { data, error } = await client.auth.updateUser({
      password: p1,
      data: { password_set: true },
    });
    btn.disabled = false;
    btn.textContent = 'Сохранить пароль';
    if (error) {
      showMessage(friendlyAuthError(error), true, setPwdMessage);
      if (/reauth/i.test(error.message || '')) {
        setTimeout(async () => {
          await client.auth.signOut();
          sessionStorage.removeItem('tutor_cloud_loaded_user');
          location.reload();
        }, 3500);
      }
      return;
    }
    showMessage('Пароль сохранён. Открываем платформу…', false, setPwdMessage);
    recoveryMode = false;
    document.getElementById('authNewPassword').value = '';
    document.getElementById('authNewPassword2').value = '';
    const user = data?.user || (await client.auth.getUser()).data.user;
    if (user) openAccount(user);
  });
  async function signOutSafely() {
    if (!(await flushCloudSave())) {
      showSync('Не удалось сохранить перед выходом', 'error');
      return;
    }
    await client.auth.signOut();
    sessionStorage.removeItem('tutor_cloud_loaded_user');
    location.reload();
  }
  document.getElementById('authSetPasswordCancel').addEventListener('click', async () => {
    recoveryMode = false;
    await signOutSafely();
  });
  document.getElementById('authOtherAccount').addEventListener('click', signOutSafely);
  document.getElementById('logoutBtn').addEventListener('click', signOutSafely);
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryMode = true;
      showView('setpwd');
      return;
    }
    if (event === 'SIGNED_OUT') {
      recoveryMode = false;
      resetCloudRuntime();
      showView('login');
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      if (recoveryMode) {
        showView('setpwd');
        return;
      }
      if (session.user.user_metadata?.password_set) openAccount(session.user);
      else showView('setpwd');
    }
  });
  client.auth.getSession().then(({ data }) => {
    if (!data.session?.user) {
      showView('login');
      return;
    }
    if (recoveryMode) return;
    if (data.session.user.user_metadata?.password_set) openAccount(data.session.user);
    else showView('setpwd');
  });
})();
