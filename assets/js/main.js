/* SoundSpace. Обычный JavaScript без сторонних библиотек, кроме Bootstrap. */
'use strict';

(() => {
  const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  const byId = id => document.getElementById(id);

  // Фильтры студий: назначение и верхняя граница стоимости работают вместе.
  const studioFilter = byId('studio-filter-form');
  if (studioFilter) {
    const purpose = byId('purpose-filter');
    const price = byId('price-filter');
    const cards = [...document.querySelectorAll('.studio-item')];
    const filterStudios = () => {
      let count = 0;
      cards.forEach(card => {
        const matches = (purpose.value === 'all' || card.dataset.purpose === purpose.value)
          && Number(card.dataset.price) <= Number(price.value);
        card.hidden = !matches;
        if (matches) count++;
      });
      byId('price-output').textContent = new Intl.NumberFormat('ru-RU').format(price.value);
      price.setAttribute('aria-valuetext', money(Number(price.value)) + ' в час');
      byId('studio-count').textContent = 'Найдено студий: ' + count;
      byId('studio-empty').hidden = count !== 0;
    };
    studioFilter.addEventListener('input', filterStudios);
    studioFilter.addEventListener('submit', event => event.preventDefault());
    // Событие reset возникает до восстановления значений полей браузером.
    studioFilter.addEventListener('reset', () => setTimeout(filterStudios, 0));
    byId('reset-studios').addEventListener('click', () => studioFilter.reset());
    filterStudios();
  }

  // Поиск применяется к текущей категории оборудования и сохраняется при смене вкладки.
  const search = byId('equipment-search');
  if (search) {
    const normalize = value => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
    const filterEquipment = () => {
      const query = normalize(search.value);
      document.querySelectorAll('.equipment-item').forEach(card => {
        card.hidden = !normalize(card.dataset.search).includes(query);
      });
      const active = document.querySelector('#equipment-content .tab-pane.active');
      const count = active ? [...active.querySelectorAll('.equipment-item')].filter(card => !card.hidden).length : 0;
      byId('equipment-count').textContent = 'Найдено устройств: ' + count;
      byId('equipment-empty').hidden = count !== 0;
    };
    search.addEventListener('input', filterEquipment);
    byId('equipment-tabs').addEventListener('shown.bs.tab', filterEquipment);
    byId('reset-equipment').addEventListener('click', () => {
      search.value = '';
      filterEquipment();
      search.focus();
    });
    filterEquipment();
  }

  const gearModal = byId('equipment-modal');
  if (gearModal) {
    gearModal.addEventListener('show.bs.modal', event => {
      const item = equipment[event.relatedTarget?.dataset.gear];
      if (!item) { event.preventDefault(); return; }
      byId('equipment-title').textContent = item.name;
      byId('equipment-category').textContent = item.category;
      byId('equipment-description').textContent = item.description;
      const image = byId('equipment-image');
      image.src = 'assets/images/' + item.image + '.jpg';
      image.alt = item.name + ': иллюстрация категории';
      const specs = byId('equipment-specs');
      specs.replaceChildren();
      item.specs.forEach(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        row.append(term, detail);
        specs.append(row);
      });
    });
  }

  // Ошибки находятся под полями и программно связаны с ними.
  function showErrors(form, errors) {
    form.querySelectorAll('[aria-describedby]').forEach(field => {
      const error = byId(field.id + '-error');
      if (!error) return;
      const message = errors[field.id] || '';
      field.classList.toggle('is-invalid', Boolean(message));
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      error.textContent = message;
    });
  }

  function validateName(field) {
    return field.value.trim().length >= 2 ? '' : 'Введите имя: не менее 2 символов.';
  }

  function validateEmail(field) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim()) && field.validity.valid
      ? '' : 'Введите корректную электронную почту, например name@example.ru.';
  }

  // Дата формируется в локальном часовом поясе, без сдвига дня через UTC.
  function todayString() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function timeInMinutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [hours, minutes] = value.split(':').map(Number);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : NaN;
  }

  const bookingModal = byId('booking-modal');
  if (bookingModal) {
    const form = byId('booking-form');
    const date = byId('booking-date');
    const start = byId('booking-start');
    const end = byId('booking-end');
    const guests = byId('booking-guests');
    let selected = null;
    let submitted = false;

    function evaluateBooking() {
      const errors = {};
      errors['booking-name'] = validateName(byId('booking-name'));
      const phone = byId('booking-phone').value.trim();
      const digits = phone.replace(/\D/g, '');
      if (!/^[+\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
        errors['booking-phone'] = 'Введите телефон: от 10 до 15 цифр. Допустимы +, пробелы, скобки и дефисы.';
      }
      errors['booking-email'] = validateEmail(byId('booking-email'));
      const today = todayString();
      date.min = today;
      const parsedDate = new Date(date.value + 'T12:00:00');
      if (!date.value || Number.isNaN(parsedDate.getTime()) || !date.validity.valid) {
        errors['booking-date'] = 'Выберите корректную дату, не раньше сегодняшнего дня.';
      } else if (date.value < today) {
        errors['booking-date'] = 'Дата аренды не может быть в прошлом.';
      }

      const from = timeInMinutes(start.value);
      const to = timeInMinutes(end.value);
      const duration = (to - from) / 60;
      if (!Number.isFinite(from)) errors['booking-start'] = 'Укажите время начала.';
      else if (from < 540 || from > 1320) errors['booking-start'] = 'Начало аренды — с 09:00 до 22:00.';
      else if (from % 30 !== 0) errors['booking-start'] = 'Выберите время с шагом 30 минут.';
      else if (date.value === today) {
        const now = new Date();
        if (from <= now.getHours() * 60 + now.getMinutes()) {
          errors['booking-start'] = 'Для сегодняшней даты выберите время в будущем.';
        }
      }

      if (!Number.isFinite(to)) errors['booking-end'] = 'Укажите время окончания.';
      else if (Number.isFinite(from) && to <= from) errors['booking-end'] = 'Окончание должно быть позже начала.';
      else if (Number.isFinite(from) && duration < 1) errors['booking-end'] = 'Минимальная длительность аренды — 1 час.';
      else if (to < 600 || to > 1380) errors['booking-end'] = 'Окончание аренды — не позднее 23:00.';
      else if (to % 30 !== 0) errors['booking-end'] = 'Выберите время с шагом 30 минут.';

      const visitors = guests.valueAsNumber;
      if (!Number.isInteger(visitors) || visitors < 1) {
        errors['booking-guests'] = 'Укажите целое количество гостей: не менее 1.';
      } else if (selected && visitors > selected.capacity) {
        errors['booking-guests'] = 'В этой студии могут находиться не более ' + selected.capacity + ' чел.';
      }
      // Цена зависит от помещения и длительности. При ошибках в параметрах аренды цена скрыта.
      const parametersValid = selected && ['date', 'start', 'end', 'guests'].every(key => !errors['booking-' + key]);
      const total = parametersValid ? selected.price * duration : null;
      byId('booking-total').textContent = total === null ? '—' : money(total);
      byId('booking-breakdown').textContent = total === null
        ? 'Выберите корректные дату, время и число гостей'
        : `${money(selected.price)} × ${new Intl.NumberFormat('ru-RU').format(duration)} ч`;
      return {errors, total, duration, visitors};
    }

    bookingModal.addEventListener('show.bs.modal', event => {
      selected = studios[event.relatedTarget?.dataset.studio];
      if (!selected) { event.preventDefault(); return; }
      form.reset();
      submitted = false;
      form.hidden = false;
      byId('booking-success').hidden = true;
      byId('booking-success-details').textContent = '';
      byId('booking-studio').value = selected.name;
      byId('booking-studio-info').textContent = money(selected.price) + ' / час · До ' + selected.capacity + ' чел.';
      guests.max = String(selected.capacity);
      date.min = todayString();
      showErrors(form, {});
      evaluateBooking();
    });

    form.addEventListener('input', () => {
      const result = evaluateBooking();
      if (submitted) showErrors(form, result.errors);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      submitted = true;
      const {errors, total, duration, visitors} = evaluateBooking();
      showErrors(form, errors);
      if (Object.values(errors).some(Boolean) || total === null) {
        form.querySelector('.is-invalid')?.focus();
        return;
      }
      const day = new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'long', year:'numeric'}).format(new Date(date.value + 'T12:00:00'));
      byId('booking-success-details').textContent = `${selected.name}\n${day}\n${start.value}–${end.value} · ${new Intl.NumberFormat('ru-RU').format(duration)} ч\nГостей: ${visitors}\nИтого: ${money(total)}`;
      form.hidden = true;
      byId('booking-success').hidden = false;
      byId('booking-success').querySelector('h3').focus();
    });

    // После закрытия не сохраняем введённые контактные данные даже в скрытой форме.
    bookingModal.addEventListener('hidden.bs.modal', () => form.reset());
  }

  const requestModal = byId('request-modal');
  if (requestModal) {
    const form = byId('request-form');
    let submitted = false;
    const validate = () => ({
      'request-name': validateName(byId('request-name')),
      'request-email': validateEmail(byId('request-email')),
      'request-service': byId('request-service').value ? '' : 'Выберите услугу.'
    });
    requestModal.addEventListener('show.bs.modal', event => {
      form.reset();
      form.hidden = false;
      submitted = false;
      byId('request-success').hidden = true;
      byId('request-success-details').textContent = '';
      const requested = event.relatedTarget?.dataset.service;
      if ([...byId('request-service').options].some(option => option.value === requested)) {
        byId('request-service').value = requested;
      }
      showErrors(form, {});
    });
    form.addEventListener('input', () => { if (submitted) showErrors(form, validate()); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      submitted = true;
      const errors = validate();
      showErrors(form, errors);
      if (Object.values(errors).some(Boolean)) {
        form.querySelector('.is-invalid')?.focus();
        return;
      }
      byId('request-success-details').textContent = 'Выбрано: ' + byId('request-service').value + '\nСтатус: подготовлена к согласованию';
      form.hidden = true;
      byId('request-success').hidden = false;
      byId('request-success').querySelector('h3').focus();
    });
    requestModal.addEventListener('hidden.bs.modal', () => form.reset());
  }

  // Одновременно играет один аудиофрагмент, чтобы записи не перекрывали друг друга.
  document.querySelectorAll('audio').forEach(player => {
    player.addEventListener('play', () => {
      document.querySelectorAll('audio').forEach(other => { if (other !== player) other.pause(); });
    });
  });
})();
