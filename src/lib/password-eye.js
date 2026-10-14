/* Show / hide password: the eye inside the right-hand end of a password box.
 * Dani, 14 Oct: "you click it, and it shows you what you've typed, so it's
 * not just the stars". On every sign-in page, member and admin.
 *
 * Call addPasswordEyes() once the page's form is in place. Each password box
 * gets a button; pressing it switches the box between dots and plain text.
 * The box goes back to dots when the form is sent, so a browser's password
 * manager still recognises it as a password. */
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const CSS = `
.pw-eye-wrap { position: relative; display: block; }
.pw-eye-wrap > input { width: 100%; padding-right: 46px !important; box-sizing: border-box; }
.pw-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 34px; height: 34px; padding: 0; border: 0; border-radius: 6px; background: transparent;
  display: grid; place-items: center; cursor: pointer; opacity: 0.55; transition: opacity 0.15s; }
.pw-eye:hover { opacity: 0.9; }
.pw-eye:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 0.9; }
`;

export function addPasswordEyes(root = document) {
  if (!document.getElementById('pw-eye-css')) {
    const st = document.createElement('style');
    st.id = 'pw-eye-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  root.querySelectorAll('input[type="password"]:not([data-eye])').forEach((input) => {
    input.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-eye-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    btn.innerHTML = EYE;
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('aria-pressed', 'false');
    // The same colour as the words typed in the box, light page or dark.
    try { btn.style.color = getComputedStyle(input).color; } catch (_) {}
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      input.focus();
      try { const n = input.value.length; input.setSelectionRange(n, n); } catch (_) {}
    });
    wrap.appendChild(btn);

    const form = input.closest('form');
    if (form) form.addEventListener('submit', () => {
      input.type = 'password';
      btn.innerHTML = EYE;
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('aria-pressed', 'false');
    }, true);
  });
}
