// Ping Web Platform - Custom Dropdown Enhancement
//
// Native <select> popup panels are OS-rendered in Chrome/Edge - no CSS on
// the <select> or its <option>s can theme that panel, which is why every
// dropdown site-wide showed a jarring white list against this dark UI no
// matter what inline styles were applied to the closed box.
//
// This keeps the real <select> in the DOM (hidden, not removed) so every
// existing `document.getElementById(id).value` read and any `.onchange`
// handler elsewhere in the codebase keeps working unchanged - it just
// layers a fully-themeable custom trigger + option panel on top that stays
// in sync with it.
export function initCustomSelects(container) {
  if (!container) return;
  container.querySelectorAll('select:not([data-enhanced])').forEach(enhanceSelect);
}

function enhanceSelect(select) {
  select.setAttribute('data-enhanced', 'true');

  const wrap = document.createElement('div');
  wrap.className = 'custom-select-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  // Inherit the original <select>'s own classes AND inline styles so it
  // drops in without needing a per-instance CSS override for every call
  // site - some selects (e.g. the header's persona dropdown) are themed
  // entirely via a CSS class with no inline style at all.
  trigger.className = ['custom-select-trigger', select.className].filter(Boolean).join(' ');
  const originalStyle = select.getAttribute('style');
  if (originalStyle) trigger.setAttribute('style', originalStyle);
  if (select.disabled) trigger.disabled = true;

  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'custom-select-trigger-label';
  trigger.appendChild(triggerLabel);

  const chevron = document.createElement('i');
  chevron.className = 'ph-bold ph-caret-down custom-select-chevron';
  trigger.appendChild(chevron);

  const panel = document.createElement('div');
  panel.className = 'custom-select-panel';

  function renderOptions() {
    panel.innerHTML = '';
    Array.from(select.options).forEach(opt => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option' + (opt.value === select.value ? ' selected' : '');
      item.textContent = opt.text;
      item.disabled = opt.disabled;
      item.onclick = (e) => {
        e.stopPropagation();
        if (select.value !== opt.value) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closePanel();
        syncLabel();
      };
      panel.appendChild(item);
    });
  }

  function syncLabel() {
    const selectedOption = select.options[select.selectedIndex];
    triggerLabel.textContent = selectedOption ? selectedOption.text : '';
  }

  function openPanel() {
    document.querySelectorAll('.custom-select-panel.open').forEach(p => {
      if (p !== panel) p.classList.remove('open');
    });
    renderOptions();
    panel.classList.add('open');
    trigger.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open');
    trigger.classList.remove('open');
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (trigger.disabled) return;
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  };

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closePanel();
  });

  // The underlying <select> stays real and functional (not removed) so
  // form-reading code elsewhere in the app doesn't need to change - just
  // visually hidden in favor of the themed trigger above.
  select.style.display = 'none';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  wrap.appendChild(select);

  syncLabel();
}
