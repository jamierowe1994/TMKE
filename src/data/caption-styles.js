// House caption styles for the video captions tool (Admin › Videography ›
// Video captions; Dani, 3 Nov 2026).
//
// A style is two things that must agree: the rules Claude follows when it
// plans an edit (`rules`, sent as text with every plan), and the numbers the
// page draws with (`look`). Change one, check the other.
//
// Fine & Country's rules came out of Dani's chat with Claude on Terry's
// Porsche video (docs: CAPTION_RULES.md, 3 Nov). The reference answers for
// that video are deliberately left out of `rules`, so Claude decides each
// video on its own merits.

export const CAPTION_STYLES = {
  "fc-luxury": {
    name: "Fine & Country, luxury",
    rules: `Fine & Country — stylised captions for short vertical (9:16) talking-head videos. Captions should feel like part of the video rather than subtitles along the bottom: classy and luxury, with a modern twist.

BRAND
- Big statement words: Didot capitals. Emphasis words in captions: Didot italic.
- Caption text: Montserrat SemiBold, all caps.
- Palette: Black #000000, Grey #b3b5b8, Gold #a78f51, White #ffffff.
- Gold must never sit over the car or anything yellow or warm-coloured. Only in the sky or neutral areas, e.g. the small labels above statement words.
- No bright accent colours, highlight boxes or bouncy "TikTok" styling. Understated.

CAPTION STYLING
- White caps with a soft shadow. One to two key emotional or important words in most phrases switch to Didot italic, lower case, larger. Emphasis comes from the font change, never colour.
- Words fade in as they are spoken.

CAPTION LAYOUT
- Line 1 sits at a fixed height. A one-line caption sits on line 1. Line 2 is a fixed, tight distance below.
- Max line width is about 22 capital letters; an italic word takes about 1.5x the room of a caps word.

PHRASE GROUPING
- Break phrases at punctuation and natural pauses, usually 3–6 words.
- Never end a phrase on a weak word (I, the, a, an, at, it's, and, to, of, in, my, with, that, every, when, on, is, was).
- Don't leave one or two orphan words before a full stop; pull them into the current phrase if it fits.
- When the speaker talks fast, use longer phrases rather than flashing new ones several times a second.
- Phrases never overlap and never run across an edit point.

STATEMENT WORDS (shown huge behind the subject's head)
- Pick 5–8 big moments: numbers, emotive words. Usually a single word or number, short enough to fill the width in huge capitals (up to about 8 letters).
- Each shows while the speaker says it, for about 1.5–3 seconds, never overlapping another.
- Optional small gold label above it, a few words that complete the thought (e.g. "PORSCHE" above "911", "A LEAP OF FAITH" above "2015").
- Don't put figures on screen that misrepresent the agent's market (a luxury agent's video never highlights a cheap price).

EDITING AND TRIMMING
- Trim for the seller or client audience. Cut sections that sound like the agent explaining strategy to other estate agents.
- Only cut inside natural pauses. Small linking words lost at a cut (e.g. "but") are acceptable.
- Leave about 0.1–0.3s of air at the very start and end.`,
    look: {
      fonts: [
        { family: "Bodoni Moda", weight: 500, style: "normal" },
        { family: "Bodoni Moda", weight: 500, style: "italic" },
        { family: "Montserrat", weight: 600, style: "normal" },
      ],
      googleFonts: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;1,500&family=Montserrat:wght@600&display=swap",
      caption: {
        plain: { font: "600 56px Montserrat", tracking: "0.05em", upper: true },
        serif: { font: "italic 500 102px 'Bodoni Moda'", tracking: "0em", upper: false },
        color: "#ffffff",
        shadow: { color: "rgba(0,0,0,0.66)", blur: 18, y: 5 },
        line1: 1555, pitch: 86, maxWidth: 900, gap: 22,
        fadeIn: 0.12, fadeOut: 0.1, hold: 0.6,
      },
      hero: { font: "500 {size}px 'Bodoni Moda'", color: "#000000", maxSize: 470, widthShare: 0.94, fadeIn: 0.5, fadeOut: 0.4, settleFrom: 1.06 },
      label: { font: "600 34px Montserrat", tracking: "0.32em", color: "#a78f51", rule: 70, gap: 22 },
      gradient: { from: 1100, alpha: 0.62, curve: 1.4 },
      zoom: { hook: 1.06, punch: 1.12, anchorY: 0.36 },
    },
  },
};

export const DEFAULT_CAPTION_STYLE = "fc-luxury";
