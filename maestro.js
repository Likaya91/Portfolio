const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => motion.matches ? 'instant' : 'smooth';

const videoSlot = document.querySelector('.cover-video');
const videoSource = videoSlot?.dataset.videoSrc?.trim();
if (videoSource) {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.preload = 'metadata';
  video.setAttribute('aria-hidden', 'true');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cover-video-toggle';

  const updateLabel = () => {
    toggle.setAttribute('aria-label', video.paused
      ? 'Воспроизвести видео Maestro'
      : 'Приостановить видео Maestro');
  };
  video.addEventListener('play', updateLabel);
  video.addEventListener('pause', updateLabel);
  video.addEventListener('error', () => {
    video.hidden = true;
    toggle.hidden = true;
  });
  toggle.addEventListener('click', () => {
    if (video.paused) video.play().catch(updateLabel);
    else video.pause();
  });
  motion.addEventListener('change', ({ matches }) => {
    if (matches) video.pause();
  });

  updateLabel();
  videoSlot.append(video, toggle);
  video.src = videoSource;
  if (!motion.matches) video.play().catch(updateLabel);
}

const phones = document.querySelectorAll('.phone-viewport');
const phoneResize = new ResizeObserver(entries => {
  for (const {target, contentRect} of entries) {
    if (contentRect.width) {
      target.style.setProperty('--phone-scale', contentRect.width / Number(target.dataset.width));
    }
  }
});
phones.forEach(phone => phoneResize.observe(phone));

for (const divider of document.querySelectorAll('.phone-divider button')) {
  const phone = divider.closest('.phone-viewport');
  const comparison = divider.closest('.phone-compare');
  const before = phone.querySelector('.phone-before');
  const after = phone.querySelector('.phone-after');
  const sliderValue = () => Number(divider.getAttribute('aria-valuenow'));
  const setSplit = value => {
    const next = Math.round(Math.max(0, Math.min(100, value)));
    comparison.style.setProperty('--split', next + '%');
    divider.style.setProperty('--slider-offset', next === 0 ? '16px' : next === 100 ? '-16px' : '0px');
    divider.setAttribute('aria-valuenow', next);
    divider.setAttribute('aria-valuetext', 'Было: ' + next + ' %, стало: ' + (100 - next) + ' %');
    before.inert = next === 0;
    after.inert = next === 100;
  };
  const move = event => {
    const {left, width} = phone.getBoundingClientRect();
    setSplit(100 * (event.clientX - left) / width);
  };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    divider.setPointerCapture(event.pointerId);
  });
  divider.addEventListener('pointermove', event => {
    if (divider.hasPointerCapture(event.pointerId)) move(event);
  });
  divider.addEventListener('pointerup', event => {
    if (divider.hasPointerCapture(event.pointerId)) {
      move(event);
      divider.releasePointerCapture(event.pointerId);
    }
  });
  divider.addEventListener('keydown', event => {
    const values = {ArrowLeft: sliderValue() - 5, ArrowRight: sliderValue() + 5, Home: 0, End: 100};
    if (!(event.key in values)) return;
    event.preventDefault();
    setSplit(values[event.key]);
  });
  setSplit(sliderValue());
}

for (const rail of document.querySelectorAll('.phone-scroll-x')) {
  let gesture;
  rail.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    gesture = {id: event.pointerId, x: event.clientX, left: rail.scrollLeft, dragging: false};
  });
  rail.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId || !(event.buttons & 1)) return;
    const delta = event.clientX - gesture.x;
    if (!gesture.dragging && Math.abs(delta) < 5) return;
    if (!gesture.dragging) {
      gesture.dragging = true;
      rail.setPointerCapture(event.pointerId);
      rail.classList.add('is-dragging');
    }
    const scale = rail.getBoundingClientRect().width / rail.offsetWidth;
    rail.scrollLeft = gesture.left - delta / scale;
  });
  const stop = () => {
    if (gesture?.dragging) rail.classList.remove('is-dragging');
    gesture = undefined;
  };
  rail.addEventListener('pointerup', stop);
  rail.addEventListener('pointercancel', stop);
  rail.addEventListener('lostpointercapture', stop);
  rail.addEventListener('dragstart', event => event.preventDefault());
  if (rail.matches('.phone-photos')) {
    rail.addEventListener('scroll', () => {
      const active = Math.round(rail.scrollLeft / rail.clientWidth);
      rail.closest('.phone-ui').querySelectorAll('[data-slide]').forEach(dot => {
        dot.setAttribute('aria-current', String(Number(dot.dataset.slide) === active));
      });
    }, {passive: true});
  }
}

const filterOptions = {
  'filter-season': ['Сезон', 'Весна', 'Лето', 'Осень', 'Зима'],
  'filter-period': ['Период', '01.12 - 06.12'],
  'filter-type': ['Тип отдыха', 'Отдых с детьми', 'Культурные путешествия'],
  sort: ['Сортировка', 'По умолчанию', 'Сначала дешевле', 'Сначала дороже'],
};
const galleryState = new WeakMap();
const savedCountries = new Set();
const contactDialog = document.createElement('dialog');
contactDialog.className = 'contact-demo';
contactDialog.innerHTML = `
  <h2>Связаться с менеджером</h2>
  <p>Демонстрация интерфейса Maestro. Форма связи в этом кейсе отсутствует.</p>
  <form method="dialog"><button>Закрыть</button></form>
`;
document.body.append(contactDialog);
const countryOf = control => control.closest('[data-country]')?.dataset.country || 'марокко';

function refreshFavorites() {
  for (const control of document.querySelectorAll('[data-action="favorite"]')) {
    const saved = savedCountries.has(countryOf(control));
    control.setAttribute('aria-pressed', String(saved));
    control.setAttribute('aria-label', saved ? 'Убрать из избранного' : 'Добавить в избранное');
  }
}

function closeSheet(panel, restoreFocus = true) {
  const sheet = panel.querySelector('.phone-sheet');
  const state = galleryState.get(panel);
  sheet.hidden = true;
  if (restoreFocus) state?.trigger?.focus({preventScroll: true});
}

function updateCards(panel) {
  const cards = panel.querySelector('.phone-tour-cards');
  const state = galleryState.get(panel);
  const byCountry = country => country === 'марокко' ? 0 : 1;
  for (const card of cards.children) {
    const country = card.dataset.country;
    card.hidden = Boolean((state.country && !country.includes(state.country.toLowerCase())) ||
      (state.savedOnly && !savedCountries.has(country)));
    card.style.order = state.sort === 'Сначала дороже' ? 1 - byCountry(country) : byCountry(country);
  }
}

function openSheet(panel, control) {
  const action = control.dataset.action;
  const sheet = panel.querySelector('.phone-sheet');
  const state = galleryState.get(panel);
  state.trigger = control;
  const [title, ...options] = filterOptions[action] ?? ['Страна'];
  const heading = document.createElement('h4');
  heading.textContent = title;
  sheet.replaceChildren(heading);
  sheet.setAttribute('role', 'group');
  sheet.setAttribute('aria-label', title);

  const makeButton = (label, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };
  const selected = new Set(state.filters.get(action));
  let searchInput;
  if (action === 'search') {
    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Марокко, Китай';
    searchInput.value = state.country;
    searchInput.setAttribute('aria-label', 'Страна');
    sheet.append(searchInput);
  }
  for (const label of options) {
    const option = makeButton(label, () => {
      if (action === 'sort') {
        selected.clear();
      } else if (selected.delete(label)) {
        option.setAttribute('aria-pressed', 'false');
        return;
      }
      selected.add(label);
      if (action === 'sort') {
        for (const button of sheet.querySelectorAll('[aria-pressed]')) button.setAttribute('aria-pressed', 'false');
      }
      option.setAttribute('aria-pressed', 'true');
    });
    option.setAttribute('aria-pressed', String(selected.has(label)));
    sheet.append(option);
  }
  const apply = () => {
    if (searchInput) {
      state.country = searchInput.value.trim();
      const text = control.querySelector('p');
      if (text) text.textContent = state.country || 'Страна';
    } else {
      state.filters.set(action, selected);
      if (action === 'sort') state.sort = [...selected][0];
      for (const chip of panel.querySelectorAll('.phone-chip')) {
        const label = chip.textContent.trim();
        if (options.includes(label)) chip.hidden = !selected.has(label);
      }
    }
    updateCards(panel);
    closeSheet(panel);
  };
  if (searchInput) searchInput.addEventListener('keydown', event => { if (event.key === 'Enter') apply(); });
  const actions = document.createElement('div');
  actions.className = 'phone-sheet-actions';
  actions.append(makeButton('Закрыть', () => closeSheet(panel)), makeButton('Применить', apply));
  sheet.append(actions);
  sheet.hidden = false;
  (searchInput || sheet.querySelector('button')).focus({preventScroll: true});
}

function jumpTo(panel, section) {
  const rail = panel.querySelector('.phone-scroll');
  const target = panel.querySelector('[data-section-target="' + section + '"]');
  if (!target) return;
  const scale = rail.getBoundingClientRect().height / rail.offsetHeight;
  const offset = (target.getBoundingClientRect().top - rail.getBoundingClientRect().top) / scale;
  const bars = panel.querySelector('.phone-section-nav').offsetHeight + 67;
  rail.scrollTo({top: rail.scrollTop + offset - bars, behavior: scrollBehavior()});
  for (const control of panel.querySelectorAll('.phone-section-links button')) {
    control.setAttribute('aria-current', String(control.dataset.section === section));
  }
}

function findComparison(panel, kind) {
  const version = panel.closest('.phone-viewport').classList.contains('phone-mobile') ? '.phone-mobile' : '.phone-desktop';
  return document.querySelector('[data-comparison="' + kind + '"] ' + version + ' .phone-after');
}

function navigateComparison(panel, kind, section) {
  const target = findComparison(panel, kind);
  if (!target) return;
  target.closest('.phone-viewport').scrollIntoView({behavior: scrollBehavior(), block: 'center'});
  const divider = target.closest('.phone-viewport').querySelector('.phone-divider button');
  if (divider) divider.dispatchEvent(new KeyboardEvent('keydown', {key: 'Home', bubbles: true}));
  if (section) {
    jumpTo(target, section);
  } else if (kind === 'tour') {
    target.querySelector('.phone-scroll').scrollTop = 0;
  }
  target.querySelector('.phone-scroll').focus({preventScroll: true});
}

for (const panel of document.querySelectorAll('.phone-after')) {
  const rail = panel.querySelector('.phone-scroll');
  const kind = panel.closest('[data-kind]').dataset.kind;
  if (kind === 'gallery') {
    const filters = new Map();
    for (const [key, [, ...options]] of Object.entries(filterOptions)) {
      const chips = Array.from(panel.querySelectorAll('.phone-chip'), item => item.textContent.trim());
      filters.set(key, new Set(options.filter(option => chips.includes(option))));
    }
    galleryState.set(panel, {filters, sort: 'По умолчанию', country: '', savedOnly: false});
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.querySelector('.phone-sheet').hidden) closeSheet(panel);
    });
  }

  panel.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const {action, section, slide} = control.dataset;
    const state = galleryState.get(panel);
    if (action in filterOptions || action === 'search') {
      openSheet(panel, control);
    } else if (action === 'favorite') {
      const country = countryOf(control);
      if (!savedCountries.delete(country)) savedCountries.add(country);
      refreshFavorites();
      for (const gallery of document.querySelectorAll('[data-comparison="gallery"] .phone-after')) {
        if (galleryState.get(gallery).savedOnly) updateCards(gallery);
      }
    } else if (action === 'open-tour' || action === 'back-gallery') {
      navigateComparison(panel, action === 'open-tour' ? 'tour' : 'gallery');
    } else if (action === 'section') {
      jumpTo(panel, section);
    } else if (action === 'contact-demo') {
      contactDialog.showModal();
    } else if (action === 'photo') {
      const track = panel.querySelector('.phone-photos');
      track.scrollTo({left: track.clientWidth * Number(slide), behavior: scrollBehavior()});
    } else if (action === 'restart-tour') {
      rail.scrollTo({top: 0, behavior: scrollBehavior()});
    } else if (action === 'remove-chip') {
      control.hidden = true;
      const label = control.textContent.trim();
      for (const values of state.filters.values()) values.delete(label);
    } else if (action === 'reset') {
      for (const values of state.filters.values()) values.clear();
      state.country = '';
      state.sort = 'По умолчанию';
      state.savedOnly = false;
      const label = panel.querySelector('[data-action="search"] p');
      if (label) label.textContent = 'Страна';
      panel.querySelectorAll('.phone-chip').forEach(chip => { chip.hidden = true; });
      updateCards(panel);
    } else if (action === 'home' || action === 'trips' || action === 'saved') {
      if (kind === 'tour') {
        const gallery = findComparison(panel, 'gallery');
        gallery.querySelector('[data-action="' + action + '"]')?.click();
        navigateComparison(panel, 'gallery');
        return;
      }
      state.savedOnly = action === 'saved';
      updateCards(panel);
      const cards = panel.querySelector('.phone-tour-cards');
      const scale = rail.getBoundingClientRect().height / rail.offsetHeight;
      rail.scrollTo({
        top: action === 'home' ? 0 : rail.scrollTop + (cards.getBoundingClientRect().top - rail.getBoundingClientRect().top) / scale - 65,
        behavior: scrollBehavior(),
      });
    } else if (action === 'manager') {
      if (kind === 'tour') jumpTo(panel, 'contacts');
      else navigateComparison(panel, 'tour', 'contacts');
    }
  });
}
