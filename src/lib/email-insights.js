// ============================================================================
// Email insights: the counting behind the funnel audit and a campaign's
// Insights step, in one place so the two always show the same figures.
//
// Moved here unchanged from src/pages/admin/automations/audit.astro (25 Nov
// 2026), where the reasoning for every rule was worked out against real sends
// with Danielle. The headline numbers are Resend's: everyone who opened or
// clicked, each once, a click counting as an open. How many of those look
// like a work email security scanner is counted beside them, not taken out.
// ============================================================================

// The hidden link every marketing email has carried since this day. Sends
// before it can't be checked that way, so more of their opens and clicks may
// be scanners than are marked.
export const TRAP_SINCE = "2026-11-10";

// Every event of one funnel, a thousand at a time (Supabase hands back 1,000
// rows at most per request). node_id arrives with a migration; before it has
// run, ask without it.
export async function readFunnelEvents(supabase, automationId) {
  const readAll = async (cols) => {
    const out = [];
    for (let from = 0; from < 50000; from += 1000) {
      const r = await supabase.from("email_events").select(cols)
        .eq("automation_id", automationId).order("occurred_at", { ascending: true }).order("id", { ascending: true }).range(from, from + 999);
      if (r.error) return { error: r.error };
      out.push(...(r.data || []));
      if ((r.data || []).length < 1000) break;
    }
    return { data: out };
  };
  let res = await readAll("event, contact_id, email, node_id, subject, message_id, provider, detail, occurred_at, raw");
  if (res.error) res = await readAll("event, contact_id, email, subject, message_id, provider, detail, occurred_at");
  return res.data || [];
}

// Which email each event belongs to. Our own "sent" row knows the step (and
// the subject); the provider's delivered/opened/clicked reports are tied back
// to it through the message id. Returns keyOf(event) -> "n:<step id>",
// "s:<subject>" or "".
export function stepKeyer(ev) {
  const byMsg = new Map();
  ev.filter((e) => e.event === "sent" && e.message_id).forEach((e) => byMsg.set(e.message_id, e));
  const keyOf = (e) => {
    if (e.node_id) return "n:" + e.node_id;
    const s = e.message_id && byMsg.get(e.message_id);
    if (s && s.node_id) return "n:" + s.node_id;
    const subj = (s && s.subject) || e.subject;
    return subj ? "s:" + subj : "";
  };
  return keyOf;
}

// Which opens and clicks look like a machine, and why. Returns
// { machineWhy(event) -> reason or "", isMachine(event), linkOf(event) }.
export function scannerJudge(ev) {
  /* Opens and clicks are not all people.
     Microsoft Defender, Mimecast and the rest fetch every link in every
     message before anyone sees it, and load the tracking pixel while
     they are at it. Resend records each as a click or an open, from a
     real IP with an ordinary Chrome user agent, so a campaign can report
     80 clicks and the website see two visits.

     Two tells, both from the data itself rather than a list of known
     bots — lists go stale, behaviour doesn't:
       · one IP acting for more than one recipient. A person has one
         inbox; a scanner works through the queue.
       · a click landing within 30 seconds of delivery. Nobody reads an
         email and follows a link that fast.

     What is left is reported as the number, because that is the number
     you would plan against. The machines are still counted, and still
     shown, just not mistaken for interest. */
  const ipOf = (e) => {
    const d = e.raw && e.raw.data;
    return (d && ((d.click && d.click.ipAddress) || (d.open && d.open.ipAddress))) || null;
  };
  const deliveredAt = new Map();
  ev.filter((e) => e.event === "delivered").forEach((e) => {
    const k = e.email || e.contact_id;
    if (k && (!deliveredAt.has(k) || e.occurred_at < deliveredAt.get(k))) deliveredAt.set(k, e.occurred_at);
  });
  const T = (e) => new Date(e.occurred_at).getTime();
  // Every open and click an address made, and for whom, so "one
  // address, several people's post" can be judged moment by moment.
  const ipHits = new Map();
  ev.forEach((e) => {
    if (e.event !== "clicked" && e.event !== "opened") return;
    const ip = ipOf(e);
    if (!ip) return;
    if (!ipHits.has(ip)) ipHits.set(ip, []);
    ipHits.get(ip).push({ t: T(e), r: e.email || e.contact_id });
  });
  /* Two recipients on one IP is not proof: a whole office can share one
     address on the way out. Three or more, within the hour of delivery,
     is — that is a queue being worked through, not a team all reading
     their post at once. */
  const SCANNER_RANGES = [/^172\.186\./, /^85\.210\./];
  const knownScanner = (ip) => !!ip && SCANNER_RANGES.some((re) => re.test(ip));

  const uaOf = (e) => {
    const d = e.raw && e.raw.data;
    return (d && ((d.click && d.click.userAgent) || (d.open && d.open.userAgent))) || null;
  };
  const linkOf = (e) => {
    const d = e.raw && e.raw.data;
    return (d && d.click && d.click.link) || null;
  };
  /* A mail client rendering the message, rather than a browser.
     Apple Mail's agent stops dead at "(KHTML, like Gecko)" — no product,
     no version. A scanner presents itself as a browser, because it is
     pretending to be one. So this is a positive sign of a person, not a
     machine, and it is the signature on every open we have confirmed
     was real. */
  const isMailClient = (ua) => /\(KHTML, like Gecko\)\s*$/.test(ua || "");

  /* THE MACHINE PASS.

     Timing from delivery was the old test and it cannot work: mail held
     in quarantine is scanned when it is RELEASED, which for The Autumn
     Edit was two days later. Everything after that looked late and human
     and was neither.

     What a scan actually looks like, from the payloads:

       09:51:45  open   Chrome 109.0.0.0
       09:52:08  click  Chrome 142.0.7444.163
       09:53:01  click  Chrome 142.0.7444.162

     One IP, 76 seconds, three different Chrome builds. A browser cannot
     change version between clicks. And elsewhere: three distinct links
     fetched in a third of a second, which no hand can do.

     So we judge an IP by how it behaved for THIS message and THIS
     recipient, and anything that IP did is the machine's:
       · two or more different links within seconds, or
       · its user agent changing at all.
     Everything outside those addresses is a person. */
  /* Five, not twenty. The scans we have actually watched fetched three
     links in three tenths of a second; a person going back to the email
     for a second link cannot beat five, so this catches the machine
     without ever calling somebody keen a robot. */
  const BURST_SECONDS = 5;
  const msgKey = (e) => (e.message_id || e.subject || "") + "|" + (e.email || e.contact_id || "");
  /* Every rule is judged in the minutes around what tripped it, not for
     the whole day. A scanner checking the email at 07:06 said nothing
     about the person who opened it at 07:17 and clicked at 07:18 from
     the same office connection, and that is how Julian Smith was left
     out (30 Sep 2026). Each exclusion keeps its reason, shown in the
     pop-outs. */
  const PAD = 120e3;                    // two minutes either side
  const machineWin = new Map();         // "<message>|<recipient>|<ip>" -> [{ from, to, why }]
  (function findMachinePasses() {
    const byKeyIp = new Map();
    ev.forEach((e) => {
      if (e.event !== "clicked" && e.event !== "opened") return;
      const ip = ipOf(e);
      if (!ip) return;
      const k = msgKey(e) + "|" + ip;
      if (!byKeyIp.has(k)) byKeyIp.set(k, []);
      byKeyIp.get(k).push(e);
    });
    const mark = (k, a, b, why) => { if (!machineWin.has(k)) machineWin.set(k, []); machineWin.get(k).push({ from: T(a), to: T(b), why }); };
    byKeyIp.forEach((list, k) => {
      list.sort((a, b) => T(a) - T(b));
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const gap = (T(list[b]) - T(list[a])) / 1000;
          if (gap > 120) break;
          // Its browser changed within two minutes: not one browser.
          const ua = uaOf(list[a]), ub = uaOf(list[b]);
          if (ua && ub && ua !== ub) mark(k, list[a], list[b], "Its browser changed within two minutes, which one person's browser can't do");
          // Two different links within seconds: not one pair of hands.
          const la = linkOf(list[a]), lb = linkOf(list[b]);
          if (gap <= BURST_SECONDS && la && lb && la !== lb) mark(k, list[a], list[b], `Opened two different links ${gap < 1 ? "in under a second" : `within ${Math.round(gap)} seconds`}`);
        }
      }
    });
  })();

  /* ONE ADDRESS, SEVERAL PEOPLE'S POST.
     135.232.20.144 clicked for six different agents inside two and a
     half minutes: a queue being worked through. Judged within three
     minutes, so an office whose people read their post across a
     morning on one shared connection isn't mistaken for one. */
  const MACHINE_IP_REACH = 3, REACH_WINDOW = 3 * 60e3;
  const reachAt = (ip, t) => new Set((ipHits.get(ip) || []).filter((h) => Math.abs(h.t - t) <= REACH_WINDOW).map((h) => h.r)).size;
  /* AT THE DOOR (Dani, 10 Nov 2026: Kerry Robinson delivered, opened and
     clicked all at 1:01). Microsoft's Safe Links checks every link the
     moment mail lands, whoever sent it and whatever the quarantine
     settings. No one can open, read and click within seconds of an email
     arriving, so a click that soon is the check. This adds to the rules
     below; it doesn't replace them, because the second scan, when mail
     is released from quarantine, comes much later. */
  /* THE TRAP. Every marketing email carries a hidden link to /link-check
     that no person can see. Whatever clicks it is a machine, and so is
     anything that same recipient's copy did within 60 seconds of it:
     the checker opens every link in one pass, in seconds, and someone
     reading the moment it lands still counts (Dani, 10 Nov 2026). */
  const TRAP_WINDOW = 60e3;
  const isTrap = (e) => /\/link-check(\?|#|$)/.test(String(linkOf(e) || e.url || ""));
  const trapAt = new Map();
  ev.forEach((e) => { if (e.event === "clicked" && isTrap(e)) { const k = msgKey(e) + "|" + (e.contact_id || e.email); (trapAt.get(k) || trapAt.set(k, []).get(k)).push(T(e)); } });
  const AT_DOOR = 30e3;
  const doorDelivered = new Map();
  ev.forEach((e) => { if (e.event === "delivered") { const k = msgKey(e) + "|" + (e.contact_id || e.email); const t = T(e); if (!doorDelivered.has(k) || t < doorDelivered.get(k)) doorDelivered.set(k, t); } });
  const clickedAtDoor = new Set();
  ev.forEach((e) => { if (e.event !== "clicked") return; const k = msgKey(e) + "|" + (e.contact_id || e.email); const d = doorDelivered.get(k); if (d != null && T(e) - d >= -5e3 && T(e) - d <= AT_DOOR) clickedAtDoor.add(k); });
  function machineWhy(e) {
    if (e.event !== "clicked" && e.event !== "opened") return "";
    const ip = ipOf(e);
    if (knownScanner(ip)) return "A known email-security scanner address";
    {
      const tk = msgKey(e) + "|" + (e.contact_id || e.email), ts = trapAt.get(tk);
      if (isTrap(e)) return "Clicked the hidden link that no person can see";
      if (ts && ts.some((t) => Math.abs(T(e) - t) <= TRAP_WINDOW)) return "Within a minute of clicking the hidden link that no person can see";
    }
    // The open that comes with that check, within the same seconds, goes with it.
    const dk = msgKey(e) + "|" + (e.contact_id || e.email), d = doorDelivered.get(dk);
    if (clickedAtDoor.has(dk) && d != null && T(e) - d <= AT_DOOR) return "Opened and clicked within seconds of arriving, before anyone could have read it: Microsoft's link check";
    if (ip) {
      const n = reachAt(ip, T(e));
      if (n >= MACHINE_IP_REACH) return `The same internet address acted for ${n} different people within three minutes`;
      const w = (machineWin.get(msgKey(e) + "|" + ip) || []).find((x) => T(e) >= x.from - PAD && T(e) <= x.to + PAD);
      if (w) return w.why;
    }
    return "";
  }
  const isMachine = (e) => !!machineWhy(e);
  return { machineWhy, isMachine, linkOf };
}

// The figures for a list of events: one email to one person counts once.
export function statsFor(list, keyOf, isMachine) {
  const who = (e) => e.contact_id || e.email || Math.random();
  const sendKey = (x) => keyOf(x) + "|" + who(x);
  const uniq = (l, name) => new Set(l.filter((x) => x.event === name).map(sendKey)).size;
  const gateReason = /opt-?in|unsubscribed|do-not-contact|suppressed/i;
  const stats = (list) => {
    const sent = uniq(list, "sent");
    // A send that failed and then went out on a resend isn't a problem
    // any more; only the ones still not sent count as failed.
    const wentOut = new Set(list.filter((x) => x.event === "sent").map(sendKey));
    const stillBlocked = (re, want) => new Set(list.filter((x) => x.event === "blocked" && re.test(x.detail || "") === want && !wentOut.has(sendKey(x))).map(sendKey)).size;
    const delivered = uniq(list, "delivered");
    const people = list.filter((x) => !isMachine(x));
    // Clicking means they opened it, even when the open wasn't recorded
    // (Outlook blocks the image that records an open). Dani, 10 Nov 2026.
    // The headline numbers are Resend's: everyone who opened or clicked,
    // each once, a click counting as an open. How many of those look like
    // a work email scanner is shown beside them, not taken out, because
    // that judgement can be wrong (Dani, 10 Nov 2026, against Resend's export).
    const oc = (l) => new Set(l.filter((x) => x.event === "opened" || x.event === "clicked").map(sendKey));
    const allOpened = oc(list), realOpened = oc(people);
    const allClicked = new Set(list.filter((x) => x.event === "clicked").map(sendKey)), realClicked = new Set(people.filter((x) => x.event === "clicked").map(sendKey));
    return {
      sent, delivered,
      opened: allOpened.size, clicked: allClicked.size,
      botOpened: allOpened.size - realOpened.size,
      botClicked: allClicked.size - realClicked.size,
      unsub: uniq(list, "unsubscribed"),
      bounced: uniq(list, "bounced"), spam: uniq(list, "complained"),
      skipped: stillBlocked(gateReason, true),
      failed: stillBlocked(gateReason, false),
      base: delivered || sent,
    };
  };
  return stats(list);
}
