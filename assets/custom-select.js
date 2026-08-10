(() => {
  'use strict';

  let openSelect = null;
  let popover = null;
  let activeIndex = -1;

  const enabledOptions = (select) => [...select.options].filter((option) => !option.disabled);

  function sync(select) {
    const wrapper = select.closest('.custom-select');
    const trigger = wrapper?.querySelector('.custom-select-trigger');
    if (!trigger) return;
    trigger.querySelector('.custom-select-value').textContent =
      select.selectedOptions[0]?.textContent || '';
    trigger.disabled = select.disabled;
    trigger.setAttribute('aria-expanded', String(openSelect === select));
  }

  function close({ focus = false } = {}) {
    if (!openSelect) return;
    const wrapper = openSelect.closest('.custom-select');
    const trigger = wrapper?.querySelector('.custom-select-trigger');
    wrapper?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    popover?.remove();
    popover = null;
    openSelect = null;
    activeIndex = -1;
    if (focus) trigger?.focus();
  }

  function positionPopover(select) {
    if (!popover) return;
    const trigger = select.closest('.custom-select')?.querySelector('.custom-select-trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const viewportGap = 8;
    const desiredWidth = Math.max(rect.width, 180);
    const width = Math.min(desiredWidth, window.innerWidth - viewportGap * 2);
    const left = Math.min(
      Math.max(viewportGap, rect.left),
      window.innerWidth - width - viewportGap,
    );
    const below = window.innerHeight - rect.bottom - gap;
    const above = rect.top - gap;
    const openAbove = below < 180 && above > below;

    popover.style.width = `${Math.round(width)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = openAbove ? 'auto' : `${Math.round(rect.bottom + gap)}px`;
    popover.style.bottom = openAbove
      ? `${Math.round(window.innerHeight - rect.top + gap)}px`
      : 'auto';
    popover.style.maxHeight = `${Math.max(120, Math.floor((openAbove ? above : below) - viewportGap))}px`;
  }

  function setActive(index) {
    if (!popover || !openSelect) return;
    const items = [...popover.querySelectorAll('.custom-select-option:not(:disabled)')];
    if (!items.length) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, current) => item.classList.toggle('is-active', current === activeIndex));
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function choose(option) {
    if (!openSelect || option.disabled) return;
    const changed = openSelect.value !== option.value;
    openSelect.value = option.value;
    sync(openSelect);
    if (changed) openSelect.dispatchEvent(new Event('change', { bubbles: true }));
    close({ focus: true });
  }

  function open(select) {
    if (select.disabled) return;
    if (openSelect === select) {
      close({ focus: true });
      return;
    }
    close();
    openSelect = select;
    const wrapper = select.closest('.custom-select');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');

    popover = document.createElement('div');
    popover.className = 'custom-select-popover';
    popover.id = `${trigger.id}-listbox`;
    popover.setAttribute('role', 'listbox');
    popover.setAttribute(
      'aria-label',
      select.getAttribute('aria-label') || select.name || 'Выберите значение',
    );

    [...select.options].forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.textContent = option.textContent;
      item.disabled = option.disabled;
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.addEventListener('click', () => choose(option));
      popover.append(item);
    });

    document.body.append(popover);
    positionPopover(select);
    const items = enabledOptions(select);
    activeIndex = Math.max(
      0,
      items.findIndex((option) => option.selected),
    );
    setActive(activeIndex);
  }

  function enhance(select) {
    if (select.multiple || select.dataset.customSelectReady) return;
    select.dataset.customSelectReady = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    select.before(wrapper);
    wrapper.append(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.id = `custom-select-${Math.random().toString(36).slice(2, 10)}`;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML =
      '<span class="custom-select-value"></span><span class="custom-select-chevron" aria-hidden="true"></span>';
    wrapper.append(trigger);

    trigger.addEventListener('click', () => {
      sync(select);
      open(select);
    });
    trigger.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key))
        event.preventDefault();
      if (!openSelect && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) open(select);
      if (openSelect !== select) return;
      const items = [...popover.querySelectorAll('.custom-select-option:not(:disabled)')];
      if (event.key === 'ArrowDown') setActive(activeIndex + 1);
      else if (event.key === 'ArrowUp') setActive(activeIndex - 1);
      else if (event.key === 'Home') setActive(0);
      else if (event.key === 'End') setActive(items.length - 1);
      else if (event.key === 'Enter' || event.key === ' ') items[activeIndex]?.click();
      else if (event.key === 'Escape') close({ focus: true });
    });
    select.addEventListener('change', () => sync(select));
    select.addEventListener('focus', () => trigger.focus());
    new MutationObserver(() => {
      sync(select);
      if (openSelect === select) open(select);
    }).observe(select, { childList: true, subtree: true, attributes: true });
    sync(select);
  }

  function enhanceAll(root = document) {
    if (root.matches?.('select')) enhance(root);
    root.querySelectorAll?.('select').forEach(enhance);
  }

  document.addEventListener('pointerdown', (event) => {
    if (!openSelect) return;
    if (event.target.closest('.custom-select-popover, .custom-select')) return;
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openSelect) close({ focus: true });
  });
  window.addEventListener('resize', () => openSelect && positionPopover(openSelect), {
    passive: true,
  });
  window.addEventListener('scroll', () => openSelect && positionPopover(openSelect), {
    passive: true,
    capture: true,
  });

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) =>
      mutation.addedNodes.forEach((node) => node.nodeType === 1 && enhanceAll(node)),
    );
  }).observe(document.body, { childList: true, subtree: true });

  enhanceAll();
})();
