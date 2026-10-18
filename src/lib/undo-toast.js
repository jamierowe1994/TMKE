/* Undo, after anything is removed from the Planner or a content plan (Dani,
   18 Oct: "we might need an undo button on the calendar for those who, like
   me, don't read the call outs"). Removing happens at once, with no "are
   you sure?"; this bar stays ten seconds with Undo on it, and Undo puts the
   thing back as it was.

     undoToast('Post removed.', async () => { ...put it back... },
               { onExpire: () => { ...the final tidy-up, e.g. files... } });

   One at a time: a second removal settles the first (its onExpire runs). */
let current = null;

function ensureStyle() {
  if (document.getElementById('tmke-undo-css')) return;
  const st = document.createElement('style');
  st.id = 'tmke-undo-css';
  st.textContent = `
    .tmke-undo { position: fixed; left: 50%; bottom: 22px; z-index: 9999; transform: translate(-50%, 12px); opacity: 0;
      display: flex; align-items: center; gap: 18px; max-width: calc(100vw - 32px); box-sizing: border-box;
      padding: 10px 10px 10px 16px; border-radius: 4px; background: var(--violet-deep, #371e28); color: #fff;
      font-family: var(--sans, sans-serif); font-size: 14px; box-shadow: 0 14px 34px -14px rgba(28,29,34,0.55);
      transition: opacity 0.2s, transform 0.2s; }
    .tmke-undo.is-on { opacity: 1; transform: translate(-50%, 0); }
    .tmke-undo-btn { appearance: none; height: 26px; padding: 0 13px; border: 1px solid #fff; border-radius: 4px;
      background: #fff; color: var(--violet-deep, #371e28); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700;
      letter-spacing: 0.04em; text-transform: uppercase; }
    .tmke-undo-btn:hover { background: transparent; color: #fff; }
    .tmke-undo-btn[disabled] { opacity: 0.6; cursor: default; }
    @media (prefers-reduced-motion: reduce) { .tmke-undo { transition: none; } }`;
  document.head.appendChild(st);
}

function settle(t) {
  if (!t || t.done) return;
  t.done = true;
  clearTimeout(t.timer);
  t.el.classList.remove('is-on');
  setTimeout(() => t.el.remove(), 250);
  if (current === t) current = null;
}

export function undoToast(message, onUndo, opts = {}) {
  if (typeof document === 'undefined') return;
  ensureStyle();
  if (current) { const prev = current; settle(prev); try { prev.onExpire && prev.onExpire(); } catch (_) {} }
  const el = document.createElement('div');
  el.className = 'tmke-undo';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="tmke-undo-tx"></span><button type="button" class="tmke-undo-btn">Undo</button>`;
  el.querySelector('.tmke-undo-tx').textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('is-on'), 20);
  const t = { el, done: false, onExpire: opts.onExpire };
  current = t;
  t.timer = setTimeout(() => { settle(t); try { t.onExpire && t.onExpire(); } catch (_) {} }, opts.ms || 10000);
  const btn = el.querySelector('.tmke-undo-btn');
  btn.addEventListener('click', async () => {
    if (t.done) return;
    btn.disabled = true; btn.textContent = 'Undoing…';
    clearTimeout(t.timer);
    try {
      await onUndo();
      settle(t);
    } catch (err) {
      el.querySelector('.tmke-undo-tx').textContent = (err && err.message) || "Couldn't put it back.";
      btn.hidden = true;
      t.timer = setTimeout(() => settle(t), 5000);
    }
  });
}
