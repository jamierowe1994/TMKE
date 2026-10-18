/**
 * The Studio office (/studio-tour): the things on the desk and the wall, and
 * what each one says when it's clicked.
 *
 * `spot` is where the object sits on the picture, in percent of its width and
 * height (x, y = top-left corner). Swapping the placeholder for the real
 * illustration means re-measuring these and nothing else.
 *
 * `steps` is one panel or several; every object uses the same format, so a
 * one-panel object and a three-panel one look and behave alike. A step can
 * carry `points` (a short list), `img` (a picture, path in /public) and `cta`
 * ({ label, href }) — all optional.
 */
export const OFFICE_IMAGE = {
  src: "/studio-office/placeholder.svg",
  width: 2400,
  height: 1500,
  alt: "The TMKE studio office: a desk with an open laptop and a phone, a mood board and a calendar on the wall, training files on a shelf, a camera on a tripod and a TMKE bag in the corner.",
};

export const OFFICE_SPOTS = [
  {
    id: "laptop",
    object: "The laptop",
    name: "Design Studio",
    spot: { x: 38.3, y: 39.3, w: 18.8, h: 21.3 },
    steps: [
      {
        title: "Your Design Studio.",
        body: "Open a template made for UK property, or start from a blank canvas. Everything you need to make something ready to post, without a design degree.",
      },
      {
        title: "Make it yours.",
        body: "One click swaps a template's colours and fonts for your brand's. Change the words, drop in your own photos, add your contact details.",
        points: ["Your colours, fonts and logo", "Photo search built in", "Remove a background in one click"],
      },
      {
        title: "Ready for every feed.",
        body: "Resize one design for a post, a Story, a Reel or print, check it against the safe zones, then download it or plan it in.",
        cta: { label: "Try the Studio", href: "/demo" },
      },
    ],
  },
  {
    id: "board",
    object: "The mood board",
    name: "Brand Kit",
    spot: { x: 31.7, y: 13.3, w: 20.8, h: 28 },
    steps: [
      {
        title: "Your brand, saved once.",
        body: "Your logo, colours, fonts and contact details live in your Brand Kit, so every template you open already looks like you.",
      },
      {
        title: "Your tone of voice, too.",
        body: "Tell us how you sound and the caption writer writes like you. Work for an agency we already know? Ask for its kit ready-made.",
      },
    ],
  },
  {
    id: "calendar",
    object: "The calendar",
    name: "Marketing Planner",
    spot: { x: 57.5, y: 14.7, w: 13.3, h: 28 },
    steps: [
      {
        title: "A month you can see.",
        body: "Plan your posts on the days they go out and keep your marketing consistent, week after week.",
      },
      {
        title: "Never a blank day.",
        body: "Property post ideas and key dates are already on the calendar. Pick one and the Studio opens with the brief written for you.",
      },
    ],
  },
  {
    id: "phone",
    object: "The phone",
    name: "Posting reminders",
    spot: { x: 60.4, y: 46, w: 5, h: 13.3 },
    steps: [
      {
        title: "It's time to post.",
        body: "On the day, your finished post arrives at 8am with the caption and the image, ready to share from your phone. Tap “I've posted it” and it's ticked off.",
      },
    ],
  },
  {
    id: "lamp",
    object: "The desk lamp",
    name: "Inspiration",
    spot: { x: 23.3, y: 40, w: 12.9, h: 20.3 },
    steps: [
      {
        title: "Stuck for an idea?",
        body: "Every month, five formats that are working for estate agents right now: what they are, why they work, and how to make your own.",
      },
      {
        title: "Your designer, on tap.",
        body: "Ask the Creative Assistant what to post this week, or let it write your caption. It knows property, and it knows your brand.",
      },
    ],
  },
  {
    id: "files",
    object: "The training files",
    name: "Learn",
    spot: { x: 75.8, y: 21.3, w: 18.3, h: 14.7 },
    steps: [
      {
        title: "Learn. Apply. Grow.",
        body: "Short courses that start at the beginning: finding your way round, setting up your brand, your first design, and planning and posting.",
      },
      {
        title: "Show me, don't tell me.",
        body: "Every course has a “Show me” walkthrough that takes you round the real Studio, one step at a time.",
      },
    ],
  },
  {
    id: "bag",
    object: "The TMKE bag",
    name: "The Edit",
    spot: { x: 82.9, y: 72, w: 12.5, h: 24.7 },
    steps: [
      {
        title: "The Edit.",
        body: "Our shop of template packs made for the UK property sector: listings, community, seasonal moments and more.",
      },
      {
        title: "Your first three are free.",
        body: "Every member starts with the Demo Pack, three templates to open, make yours and post.",
        cta: { label: "Browse The Edit", href: "/edit" },
      },
    ],
  },
  {
    id: "camera",
    object: "The camera",
    name: "Property media",
    spot: { x: 7.1, y: 53.3, w: 10.8, h: 43.3 },
    steps: [
      {
        title: "Shoots, booked and tracked.",
        body: "Book photography, video or a session in our studio, then follow it from booking to finished gallery, all in one place.",
        cta: { label: "See property media", href: "/videography" },
      },
    ],
  },
];
