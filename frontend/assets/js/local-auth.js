/* Локальные учебные аккаунты. Это не серверная защита доступа. */
'use strict';

(() => {
  const ACCOUNTS = 'soundspace.local.accounts.v1';
  const SESSION = 'soundspace.local.session.v1';
  const ITERATIONS = 600000;
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  let expiryTimer;

  function readAccounts() {
    let value;
    try { value = JSON.parse(localStorage.getItem(ACCOUNTS) || '[]'); }
    catch { throw new Error('Не удалось прочитать локальные аккаунты. Проверьте доступ браузера к данным сайта.'); }
    if (!Array.isArray(value) || value.some(account => !account || typeof account.id !== 'string' || typeof account.email !== 'string' || !/^[a-f0-9]{32}$/.test(account.salt) || !/^[a-f0-9]{64}$/.test(account.passwordHash))) {
      throw new Error('Локальные данные аккаунтов повреждены. Восстановите данные или очистите хранилище этого сайта.');
    }
    return value;
  }

  function session() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION));
      if (!value?.user?.id || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null;
      const account = readAccounts().find(item => item.id === value.user.id && item.email === value.user.email);
      return account ? {user: {id: account.id, email: account.email}, expiresAt: value.expiresAt} : null;
    } catch { return null; }
  }

  function notify() { document.dispatchEvent(new Event('soundspace:session')); }

  function logout() {
    clearTimeout(expiryTimer);
    try { sessionStorage.removeItem(SESSION); } catch { /* Blocked storage also makes session() return null. */ }
    notify();
  }

  function startSession(account) {
    const value = {user: {id: account.id, email: account.email}, expiresAt: Date.now() + SESSION_TTL};
    try { sessionStorage.setItem(SESSION, JSON.stringify(value)); }
    catch { throw new Error('Разрешите хранение данных сайта в браузере, чтобы войти.'); }
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(logout, SESSION_TTL);
    notify();
    return value;
  }

  const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

  async function hashPassword(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error('Откройте сайт через Live Server на localhost или по HTTPS: здесь браузер не поддерживает локальную регистрацию.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const saltBytes = Uint8Array.from(salt.match(/../g), pair => parseInt(pair, 16));
    const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256'}, key, 256);
    return hex(new Uint8Array(bits));
  }

  function validate(email, password, registering) {
    if (typeof email !== 'string' || typeof password !== 'string') throw new Error('Введите почту и пароль.');
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Введите корректную почту длиной до 100 символов.');
    if (!password || [...password].length > 128 || (registering && [...password].length < 8)) throw new Error('Для регистрации нужен пароль от 8 до 128 символов.');
    return normalized;
  }

  async function register(email, password) {
    const normalized = validate(email, password, true);
    if (readAccounts().some(account => account.email === normalized)) throw new Error('Эта почта уже зарегистрирована в этом браузере. Перейдите ко входу.');
    if (!globalThis.crypto?.getRandomValues) throw new Error('Браузер не поддерживает локальную регистрацию.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hashPassword(password, salt);
    const account = {id: hex(crypto.getRandomValues(new Uint8Array(16))), email: normalized, salt, passwordHash};
    const commit = () => {
      // Read after hashing so another registration is not overwritten.
      const accounts = readAccounts();
      if (accounts.some(item => item.email === normalized)) throw new Error('Эта почта уже зарегистрирована в этом браузере. Перейдите ко входу.');
      try {
        sessionStorage.setItem('soundspace.local.storage-check', '1');
        sessionStorage.removeItem('soundspace.local.storage-check');
        localStorage.setItem(ACCOUNTS, JSON.stringify([...accounts, account]));
      } catch { throw new Error('Не удалось сохранить аккаунт. Разрешите хранение данных сайта в браузере.'); }
      return startSession(account);
    };
    return navigator.locks ? navigator.locks.request('soundspace-local-accounts', commit) : commit();
  }

  async function login(email, password) {
    const normalized = validate(email, password, false);
    const account = readAccounts().find(item => item.email === normalized);
    const actual = await hashPassword(password, account?.salt || '00'.repeat(16));
    const expected = account?.passwordHash || '00'.repeat(32);
    let mismatch = 0;
    for (let index = 0; index < expected.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
    if (!account || mismatch) throw new Error('Неверная почта или пароль. Зарегистрируйтесь, если ещё не создавали аккаунт в этом браузере.');
    return startSession(account);
  }

  window.SoundSpaceLocalAuth = {session, register, login, logout};
  try { sessionStorage.removeItem('soundspace.session.v1'); } catch { /* Remove the old Go JWT when storage is available. */ }
  const current = session();
  if (current) expiryTimer = setTimeout(logout, current.expiresAt - Date.now());
  window.addEventListener('pageshow', () => { if (!session()) logout(); else notify(); });
  window.addEventListener('storage', event => { if (event.key === ACCOUNTS || event.key === null) notify(); });
})();
