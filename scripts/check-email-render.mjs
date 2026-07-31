// Verifies the mobile-spacing fixes against the real renderer.
import { EMAIL_STYLE_DEFAULTS, emailStyleStrings, styleEmailContent } from '../src/lib/email-styles.js';
import { renderTemplate, effectiveBlock, resolveMargin, resolvePad,
         headingInlineStyle, textInlineStyle, buttonInlineStyle } from '../src/lib/email-render.js';

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}`);
  if (!ok) console.log(`      want: ${want}\n      got:  ${got}`);
};

console.log('\n1. Blank inherits desktop (was falling back to the type default)');
{
  const b = { type: 'text', id: 'x1', margin: { t: 5, b: 40 }, mobile: { margin: { t: 10 } } };
  const m = resolveMargin(effectiveBlock(b, 'mobile'));
  check('mobile top overrides', m.t, 10);
  check('desktop bottom inherited (was 16, the default)', m.b, 40);
}

console.log('\n2. A cleared field must not clobber desktop');
{
  const b = { type: 'text', id: 'x2', margin: { b: 40 }, mobile: { margin: { b: undefined } } };
  const m = resolveMargin(effectiveBlock(b, 'mobile'));
  check('undefined ignored, desktop kept', m.b, 40);
}

console.log('\n3. Partial mobile padding merges with desktop (was zeroing the rest)');
{
  const b = { type: 'text', id: 'x3', pad: { t: 8, r: 16, b: 8, l: 16 }, mobile: { pad: { t: 20 } } };
  const p = resolvePad(effectiveBlock(b, 'mobile'));
  check('top overridden', p.t, 20);
  check('right inherited', p.r, 16);
  check('left inherited', p.l, 16);
}

const css = (blocks) => {
  const out = renderTemplate({ mode: 'blocks', blocks, subject: 't' });
  return typeof out === 'string' ? out : (out.html || '');
};

console.log('\n4. All-zero mobile padding must still emit a rule');
{
  const html = css([{ type: 'text', id: 'z1', html: 'hi', pad: { t: 30, b: 30 }, mobile: { pad: { t: 0, r: 0, b: 0, l: 0 } } }]);
  check('emits padding:0', /\.eb-b-z1\{[^}]*padding:0px 0px 0px 0px !important/.test(html), true);
}

console.log('\n5. Social block honours mobile padding');
{
  const html = css([{ type: 'social', id: 's1', align: 'center', show: { website: true }, pad: { t: 10 }, mobile: { pad: { t: 40 } } }]);
  check('emits .eb-social-s1 padding', /\.eb-social-s1\{[^}]*padding:40px/.test(html), true);
}

console.log('\n6. Columns block keeps its OWN mobile margin (was discarded)');
{
  const html = css([{ type: 'columns', id: 'c1', layout: 'two', cols: [[{ type: 'text', id: 'c1a', html: 'a' }], [{ type: 'text', id: 'c1b', html: 'b' }]], margin: { b: 40 }, mobile: { margin: { t: 24 } } }]);
  check('emits .eb-mw-c1 rule', /\.eb-mw-c1\{[^}]*padding:24px/.test(html), true);
  check('and keeps desktop bottom 40', /\.eb-mw-c1\{[^}]*padding:24px 0px 40px 0px/.test(html), true);
}

console.log('\n7. No mobile overrides → no mobile CSS (no regression)');
{
  const html = css([{ type: 'text', id: 'n1', html: 'hi', pad: { t: 10 } }]);
  check('no .eb-b-n1 rule emitted', /\.eb-b-n1\{/.test(html), false);
}

console.log('\n8. Typography cascades from the base — block wins over base wins over built-in');
{
  const brand = { headingSize: 34, headingColor: '#aa0000', bodySize: 18, bodyColor: '#333333', buttonSize: 20, buttonRadius: 24 };
  check('base heading size used when block is silent', /font-size:34px/.test(headingInlineStyle({}, brand)), true);
  check('block heading size still wins', /font-size:22px/.test(headingInlineStyle({ size: 22 }, brand)), true);
  check('base heading colour used', /color:#aa0000/.test(headingInlineStyle({}, brand)), true);
  check('block colour still wins', /color:#00ff00/.test(headingInlineStyle({ color: '#00ff00' }, brand)), true);
  check('base body size used', /font-size:18px/.test(textInlineStyle({}, brand)), true);
  check('base button size + radius used', /font-size:20px/.test(buttonInlineStyle({}, brand)) && /border-radius:24px/.test(buttonInlineStyle({}, brand)), true);
}

console.log('\n9. No base typography → the built-in defaults (existing templates must not shift)');
{
  check('heading stays 28px', /font-size:28px/.test(headingInlineStyle({}, {})), true);
  check('body stays 15px', /font-size:15px/.test(textInlineStyle({}, {})), true);
  check('button stays 14px', /font-size:14px/.test(buttonInlineStyle({}, {})), true);
}

console.log('\n10. A blank size must fall back, not render 0px');
{
  check('empty string size falls back to base', /font-size:34px/.test(headingInlineStyle({ size: '' }, { headingSize: 34 })), true);
  check('empty string with no base falls back to built-in', /font-size:28px/.test(headingInlineStyle({ size: '' }, {})), true);
}

console.log('\n11. Automated-email house style rewrites correctly');
{
  const D = EMAIL_STYLE_DEFAULTS;
  const canonical = `<h1 style="${emailStyleStrings(D).h1}">Hi</h1>`
    + `<p style="${emailStyleStrings(D).p}">Body</p>`
    + `<a style="${emailStyleStrings(D).btn}">Go</a>`
    + `<p style="font-family:${D.font};font-size:${D.smallSize}px;color:${D.dark}">Small print</p>`;

  check('defaults in = byte-identical out', styleEmailContent(canonical, D) === canonical, true);

  const out = styleEmailContent(canonical, { ...D, font: 'Arial, Helvetica, sans-serif', headingSize: 30, bodySize: 16, smallSize: 11, dark: '#111111', headingWeight: 700, buttonRadius: 20 });
  check('font swapped everywhere', !/Verdana/.test(out), true);
  check('heading size applied', /font-size:30px/.test(out), true);
  check('body size applied', /font-size:16px/.test(out), true);
  check('small print size applied', /font-size:11px/.test(out), true);
  check('dark colour applied', !/#371e28/.test(out), true);
  check('heading weight applied (whole-string swap)', /font-weight:700/.test(out), true);
  check('button radius applied (whole-string swap)', /border-radius:20px/.test(out), true);

  const off = styleEmailContent(`<div style="${emailStyleStrings(D).quote}">Q</div>`, { ...D, quoteEnabled: false });
  check('quote box off drops the panel', !/border-left/.test(off) && !/background:/.test(off), true);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
