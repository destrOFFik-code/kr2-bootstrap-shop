/* Вход и регистрация работают локально, без API и backend. */
'use strict';

(() => {
  const accounts = window.SoundSpaceLocalAuth;
  window.SoundSpaceAuth = {session: accounts.session, logout: accounts.logout};

  function renderSession() {
    const current = accounts.session();
    document.querySelectorAll('[data-account-link]').forEach(link => { link.textContent = current ? 'Мой аккаунт' : 'Войти'; });
    const account = document.getElementById('account-view');
    if (!account) return;
    account.hidden = !current;
    document.getElementById('auth-panel').hidden = Boolean(current);
    if (current) document.getElementById('account-email').textContent = current.user.email;
  }
  document.addEventListener('soundspace:session', renderSession);
  renderSession();
  document.getElementById('logout-button')?.addEventListener('click', () => {
    accounts.logout();
    document.getElementById('auth-form').reset();
    document.getElementById('auth-email').focus();
  });

  const form = document.getElementById('auth-form');
  if (!form) return;
  let mode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
  let pending = false;
  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');
  const confirm = document.getElementById('auth-confirm');
  const feedback = document.getElementById('auth-feedback');
  const submit = document.getElementById('auth-submit');

  function setFeedback(message) {
    feedback.textContent = message;
    feedback.hidden = !message;
  }
  function switchMode(next) {
    mode = next;
    form.reset();
    password.type = 'password';
    document.getElementById('password-toggle').textContent = 'Показать';
    document.getElementById('password-toggle').setAttribute('aria-pressed', 'false');
    setFeedback('');
    document.getElementById('confirm-field').hidden = mode !== 'register';
    confirm.required = mode === 'register';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    document.getElementById('auth-form-title').textContent = mode === 'register' ? 'Создать аккаунт' : 'С возвращением';
    submit.textContent = mode === 'register' ? 'Зарегистрироваться →' : 'Войти →';
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.authMode === mode));
      button.classList.toggle('active', button.dataset.authMode === mode);
    });
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    try { history.replaceState(null, '', url); } catch { /* Form switching still works on restricted file:// pages. */ }
  }
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
    if (!pending) switchMode(button.dataset.authMode);
  }));
  document.getElementById('password-toggle').addEventListener('click', event => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Скрыть' : 'Показать';
    event.currentTarget.setAttribute('aria-pressed', String(show));
  });
  switchMode(mode);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    email.value = email.value.trim().toLowerCase();
    if (!form.reportValidity()) return;
    if ([...password.value].length > 128 || (mode === 'register' && [...password.value].length < 8)) {
      setFeedback('Для регистрации нужен пароль от 8 до 128 символов.'); password.focus(); return;
    }
    if (mode === 'register' && password.value !== confirm.value) {
      setFeedback('Пароли не совпадают.'); confirm.focus(); return;
    }
    pending = true;
    const label = submit.textContent;
    document.querySelectorAll('[data-auth-mode], #auth-form button').forEach(button => { button.disabled = true; });
    submit.textContent = 'Подождите…';
    setFeedback('');
    try {
      if (mode === 'register') await accounts.register(email.value, password.value);
      else await accounts.login(email.value, password.value);
      form.reset();
      const next = new URLSearchParams(location.search).get('next');
      const destination = ['index.html', 'wheel.html', 'studios.html', 'services.html', 'equipment.html', 'contacts.html', 'portfolio.html'].includes(next) ? next : 'index.html';
      location.replace(destination);
    } catch (error) { setFeedback(error.message || 'Не удалось войти. Попробуйте ещё раз.'); }
    finally {
      pending = false;
      document.querySelectorAll('[data-auth-mode], #auth-form button').forEach(button => { button.disabled = false; });
      submit.textContent = label;
    }
  });
})();
