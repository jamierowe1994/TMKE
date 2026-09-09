/* TMKE — phones: scroll the stack.
   The stacks (Social Media #sms, Videography #sms, The Edit #stk) open a
   section when its bar is tapped. This adds the scroll people reach for
   first: on the title screen, one swipe up opens the first section; inside a
   section the body scrolls as normal, and once it is at its foot a further
   swipe up opens the next; at its head, a swipe down goes back one. A single
   gesture moves a single section, and nothing else can change for a moment
   after, so a long flick cannot run through the whole page. */
(function () {
  'use strict';
  var root = document.getElementById('sms') || document.getElementById('stk');
  if (!root) return;
  var sms = root.id === 'sms';
  var PANEL = sms ? '.sms-p' : '.stk-p';
  var BAR = sms ? '.sms-bar' : '.stk-bar';
  var mq = window.matchMedia(sms ? '(max-width: 600px)' : '(max-width: 760px), (hover: none) and (pointer: coarse)');
  var THRESH = 56;        // px of travel past the edge before a section changes
  var HOLD = 900;         // ms before another section may change
  var lastChange = 0;

  function panels() { return Array.prototype.slice.call(root.querySelectorAll(PANEL)); }
  function openIndex() {
    var ps = panels();
    for (var i = 0; i < ps.length; i++) if (ps[i].classList.contains('is-open')) return i;
    return 0;
  }
  // Move by tapping the bars the page already listens to: the open bar again
  // returns to the title, any other bar opens its section.
  function go(i) {
    var ps = panels(), cur = openIndex();
    if (i < 0 || i >= ps.length || i === cur) return false;
    var bar = (i === 0 ? ps[cur] : ps[i]).querySelector(BAR);
    if (!bar) return false;
    bar.click();
    lastChange = Date.now();
    return true;
  }
  // The scrolling box under the finger, if there is one inside the open section.
  function scrollerFrom(el, panel) {
    var n = el;
    while (n && n !== panel && n !== root) {
      var s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
      n = n.parentElement;
    }
    return null;
  }
  function edges(target) {
    var cur = openIndex(), panel = panels()[cur];
    var sc = panel ? scrollerFrom(target, panel) : null;
    return {
      cur: cur,
      top: !sc || sc.scrollTop <= 1,
      bottom: !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1
    };
  }

  // Touch: judged from where the section's scroll was when the finger landed,
  // so a gesture that scrolls the body never also changes the section.
  var sx = 0, sy = 0, edge = null, fired = false;
  root.addEventListener('touchstart', function (e) {
    if (!mq.matches || e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    fired = false;
    edge = edges(e.target);
  }, { passive: true });
  root.addEventListener('touchmove', function (e) {
    if (!mq.matches || fired || !edge || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) return;                  // sideways: the slides' own
    if (Math.abs(dy) < THRESH) return;
    fired = true;
    if (Date.now() - lastChange < HOLD) return;               // one section at a time
    if (dy < 0 && edge.bottom) go(edge.cur + 1);
    else if (dy > 0 && edge.top && edge.cur > 0) go(edge.cur - 1);
  }, { passive: true });
  root.addEventListener('touchend', function () { edge = null; }, { passive: true });

  // A wheel or trackpad, for a touch screen with one attached.
  var acc = 0, accT = 0;
  root.addEventListener('wheel', function (e) {
    if (!mq.matches) return;
    var now = Date.now();
    if (now - accT > 300) acc = 0;
    accT = now;
    if (now - lastChange < HOLD) { acc = 0; return; }
    var ed = edges(e.target);
    acc += e.deltaY;
    if (acc > THRESH && ed.bottom) { acc = 0; go(ed.cur + 1); }
    else if (acc < -THRESH && ed.top && ed.cur > 0) { acc = 0; go(ed.cur - 1); }
  }, { passive: true });
})();
