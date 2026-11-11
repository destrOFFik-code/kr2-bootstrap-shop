/* Общие элементы: дневной бонус, фоновая музыка и видео главной. */
'use strict';

(() => {
  const rewardKey = 'soundspace.reward.v1';
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getReward = () => {
    try {
      const value = JSON.parse(localStorage.getItem(rewardKey));
      return value?.day === today() && [5, 10, 15, 20, 25].includes(value.percent) && /^SS-\d{1,2}-[A-F0-9]{6}$/.test(value.code) ? value : null;
    } catch { return null; }
  };
  window.SoundSpaceRewards = {get: getReward, key: rewardKey, today};

  const audio = document.getElementById('background-music');
  const toggle = document.getElementById('music-toggle');
  if (audio && toggle) {
    const volume = document.getElementById('music-volume');
    const status = document.getElementById('music-status');
    let position = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem('soundspace.music.v2'));
      if (saved && Number.isFinite(saved.volume)) volume.value = String(Math.min(100, Math.max(0, saved.volume)));
      if (saved && Number.isFinite(saved.position)) position = Math.max(0, saved.position);
    } catch { /* Defaults remain usable with storage disabled. */ }
    audio.volume = Number(volume.value) / 100;
    audio.addEventListener('loadedmetadata', () => {
      if (position < audio.duration) audio.currentTime = position;
    }, {once: true});
    const saveMusic = () => {
      try { sessionStorage.setItem('soundspace.music.v2', JSON.stringify({position: audio.currentTime, volume: Number(volume.value)})); } catch { /* Optional preference. */ }
    };
    const render = () => {
      const playing = !audio.paused;
      toggle.setAttribute('aria-pressed', String(playing));
      toggle.querySelector('[data-music-label]').textContent = playing ? 'Пауза' : 'Включить';
      status.textContent = playing ? 'Dream Culture · Kevin MacLeod' : 'Музыка для настроения';
      document.querySelector('.music-dock').classList.toggle('is-playing', playing);
    };
    toggle.addEventListener('click', async () => {
      if (!audio.paused) { audio.pause(); saveMusic(); return; }
      try { await audio.play(); } catch { status.textContent = 'Аудио недоступно. Попробуйте ещё раз.'; }
    });
    volume.addEventListener('input', () => { audio.volume = Number(volume.value) / 100; saveMusic(); });
    audio.addEventListener('play', render);
    audio.addEventListener('pause', render);
    audio.addEventListener('error', () => { status.textContent = 'Не удалось загрузить музыку.'; });
    window.addEventListener('pagehide', saveMusic);
    render();
  }

  const video = document.getElementById('hero-video');
  const videoToggle = document.getElementById('video-toggle');
  if (video && videoToggle) {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const renderVideo = () => {
      videoToggle.textContent = video.paused ? '▶ Включить видео' : 'Ⅱ Пауза видео';
      videoToggle.setAttribute('aria-pressed', String(!video.paused));
    };
    video.muted = true;
    const loadVideo = () => {
      if (!video.querySelector('source')) {
        const source = document.createElement('source');
        source.src = 'assets/video/studio-console.mp4';
        source.type = 'video/mp4';
        video.append(source);
        video.load();
      }
      return video.play();
    };
    if (!reducedMotion.matches && !navigator.connection?.saveData) loadVideo().catch(renderVideo);
    videoToggle.addEventListener('click', () => {
      if (video.paused) loadVideo().catch(() => { videoToggle.textContent = 'Видео недоступно'; });
      else video.pause();
    });
    video.addEventListener('play', renderVideo);
    video.addEventListener('pause', renderVideo);
    video.addEventListener('error', () => { videoToggle.textContent = 'Видео недоступно'; });
    reducedMotion.addEventListener('change', event => { if (event.matches) video.pause(); });
    renderVideo();
  }
})();
