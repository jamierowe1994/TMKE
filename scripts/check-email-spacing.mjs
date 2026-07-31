// Verifies the mobile-spacing fixes against the real renderer.
import { renderTemplate, effectiveBlock, resolveMargin, resolvePad } from '../src/lib/email-render.js';

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

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
