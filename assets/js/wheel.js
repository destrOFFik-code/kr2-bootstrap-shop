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
  let rotation = 0;

  function showReward(reward, focus = false) {
    const index = Number.isInteger(reward.index) && prizes[reward.index] === reward.percent ? reward.index : prizes.indexOf(reward.percent);
    rotation = 360 - (index * 45 + 22.5);
    wheel.style.transform = `rotate(${rotation}deg)`;
    document.getElementById('reward-percent').textContent = reward.percent + '%';
    document.getElementById('reward-code').textContent = reward.code;
    result.hidden = false;
    document.getElementById('copy-reward').textContent = 'Скопировать';
    button.disabled = false;
    button.textContent = 'Крутить ещё раз →';
    feedback.textContent = 'Бонус сохранён до конца дня. Крути снова — новый результат заменит предыдущий.';
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
      feedback.textContent = 'Крути сколько хочешь. Каждый сектор — скидка.';
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
    const random = crypto.getRandomValues(new Uint32Array(2));
    const index = random[0] % prizes.length;
    const reward = {day: rewards.today(), percent: prizes[index], index, code: `SS-${prizes[index]}-${random[1].toString(16).padStart(8, '0').slice(0, 6).toUpperCase()}`};
    spinning = true;
    result.hidden = true;
    button.disabled = true;
    button.textContent = 'Ловим ваш бонус…';
    feedback.textContent = 'Колесо вращается. Пусть сегодня повезёт!';
    wheel.setAttribute('aria-busy', 'true');
    const target = 360 - (index * 45 + 22.5);
    const angle = rotation + 360 * 5 + (target - rotation + 360) % 360;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 5200;
    wheel.style.transition = 'none';
    const animation = wheel.animate([{transform: `rotate(${rotation}deg)`}, {transform: `rotate(${angle}deg)`}], {duration, easing: 'cubic-bezier(.12,.75,.12,1)', fill: 'forwards'});
    try { await animation.finished; } catch { /* Reveal the result even if the animation is interrupted. */ }
    wheel.style.transform = `rotate(${angle}deg)`;
    animation.cancel();
    spinning = false;
    wheel.setAttribute('aria-busy', 'false');
    if (reward.day !== rewards.today()) { refreshDay(); return; }
    let saved = true;
    try {
      localStorage.setItem(rewards.key, JSON.stringify(reward));
    } catch { saved = false; }
    showReward(reward, true);
    if (!saved) feedback.textContent = 'Можно крутить снова. Чтобы сохранить бонус для расчёта аренды, разрешите хранение данных сайта.';
  }
  button.addEventListener('click', () => {
    spin().catch(() => {
      spinning = false;
      wheel.setAttribute('aria-busy', 'false');
      refreshDay();
      feedback.textContent = 'Не удалось запустить колесо. Попробуйте ещё раз.';
    });
  });
  document.getElementById('copy-reward').addEventListener('click', async event => {
    try {
      await navigator.clipboard.writeText(document.getElementById('reward-code').textContent);
      event.currentTarget.textContent = 'Скопировано ✓';
    } catch { feedback.textContent = 'Выделите и скопируйте промокод вручную.'; }
  });
})();
