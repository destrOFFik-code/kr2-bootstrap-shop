/* Колесо — клиентская акция. Итоговую скидку подтверждает студия. */
'use strict';

(() => {
  const wheel = document.getElementById('discount-wheel');
  if (!wheel) return;
  const prizes = [5, 10, 15, 20, 25, 10, 15, 5];
  const button = document.getElementById('spin-button');
  const feedback = document.getElementById('wheel-status');
  const result = document.getElementById('wheel-result');
  const rewards = window.SoundSpaceRewards;
  let spinning = false;
  let dayTimer;

  function showReward(reward, focus = false) {
    const index = Number.isInteger(reward.index) && prizes[reward.index] === reward.percent ? reward.index : prizes.indexOf(reward.percent);
    wheel.style.transform = `rotate(${360 - (index * 45 + 22.5)}deg)`;
    document.getElementById('reward-percent').textContent = reward.percent + '%';
    document.getElementById('reward-code').textContent = reward.code;
    result.hidden = false;
    button.disabled = true;
    button.textContent = 'Ваш бонус уже получен';
    feedback.textContent = 'Результат сохранён до конца дня. Следующее вращение — завтра.';
    if (focus) document.getElementById('reward-title').focus({preventScroll: true});
  }
  function refreshDay() {
    clearTimeout(dayTimer);
    const reward = rewards.get();
    if (reward) showReward(reward);
    else if (!spinning) {
      result.hidden = true;
      button.disabled = false;
      button.textContent = 'Крутить колесо →';
      feedback.textContent = 'Одна попытка в день. Каждый сектор — скидка.';
    }
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 100);
    dayTimer = setTimeout(refreshDay, tomorrow.getTime() - Date.now());
  }
  refreshDay();
  window.addEventListener('storage', event => { if (event.key === rewards.key && !spinning) refreshDay(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !spinning) refreshDay(); });

  async function spin() {
    if (spinning) return;
    const existing = rewards.get();
    if (existing) { showReward(existing); return; }
    const random = crypto.getRandomValues(new Uint32Array(2));
    const index = random[0] % prizes.length;
    const reward = {day: rewards.today(), percent: prizes[index], index, code: `SS-${prizes[index]}-${random[1].toString(16).padStart(8, '0').slice(0, 6).toUpperCase()}`};
    try {
      // Store before animation so reloading cannot reroll the same attempt.
      localStorage.setItem(rewards.key, JSON.stringify(reward));
    } catch {
      feedback.textContent = 'Разрешите хранение данных сайта в браузере, чтобы сохранить ваш бонус.';
      return;
    }
    spinning = true;
    button.disabled = true;
    button.textContent = 'Ловим ваш бонус…';
    feedback.textContent = 'Колесо вращается. Пусть сегодня повезёт!';
    wheel.setAttribute('aria-busy', 'true');
    const angle = 360 * 5 + 360 - (index * 45 + 22.5);
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 5200;
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    const animation = wheel.animate([{transform: 'rotate(0deg)'}, {transform: `rotate(${angle}deg)`}], {duration, easing: 'cubic-bezier(.12,.75,.12,1)', fill: 'forwards'});
    try { await animation.finished; } catch { /* Still reveal a saved result if interrupted. */ }
    wheel.style.transform = `rotate(${angle}deg)`;
    animation.cancel();
    spinning = false;
    wheel.setAttribute('aria-busy', 'false');
    if (reward.day === rewards.today()) showReward(reward, true);
    else refreshDay();
  }
  button.addEventListener('click', () => {
    // Web Locks serializes simultaneous spins across tabs where supported.
    if (navigator.locks) navigator.locks.request('soundspace-wheel', spin).catch(() => { feedback.textContent = 'Не удалось запустить колесо. Попробуйте ещё раз.'; });
    else spin().catch(() => { spinning = false; refreshDay(); });
  });
  document.getElementById('copy-reward').addEventListener('click', async event => {
    try {
      await navigator.clipboard.writeText(document.getElementById('reward-code').textContent);
      event.currentTarget.textContent = 'Скопировано ✓';
    } catch { feedback.textContent = 'Выделите и скопируйте промокод вручную.'; }
  });
})();
