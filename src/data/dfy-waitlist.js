/* The Done For You waitlist page (src/pages/waitlist/done-for-you.astro).
   Everything it says lives here. Prices are in PRICES only: change them there
   and every place on the page follows. Stand-ins until Danielle agrees prices
   (12 Nov 2026). */

export const PRICES = {
  subscription: { rrp: "£—", teg: "£—", per: "a month" },
  addOn: { rrp: "£—", teg: "£—", per: "a month you add" },
};

export const DFY = {
  title: "Done For You Waitlist — TMKE",
  description: "Done For You launches in January with only 10 spaces. Every month, our team brands ten of your Content Calendar posts for you. Join the waitlist now.",
  og: "/assets/signup/1.webp",
  hero: { src: "/assets/signup/1.webp", alt: "The Marketing Experts bag" },

  eyebrow: "Coming in January",
  board: "Done For You",
  boardLink: "Join the waitlist",

  featureLabel: "Only 10 Spaces",
  heading: "Ten Posts a Month, Done For You",
  meta: "Launching January",
  featureBody: "You already have the Content Calendar through your brand. With Done For You, you don't have to brand the posts yourself. Every month, our team takes ten posts from that month's calendar, applies your branding, personalises them and puts them in your calendar. You can then approve them or ask for changes. It launches in January with only 10 spaces, because our team can only do so many, so we're opening a waitlist first.",
  button: "Join the waitlist",

  brands: ["The Property Experts", "Prestige Property Experts"],

  panel: {
    heading: "Join the Done For You Waitlist",
    sub: "Tell us who you are and which option you're interested in. We'll email you from hello@tmke.co.uk to confirm your place.",
    brand: "Your brand",
    option: "Which option are you interested in?",
    submit: "Join the waitlist",
    privacy: "We'll only use your details to manage the waitlist and contact you about Done For You.",
  },

  messages: {
    left: "{place} of {spaces} spaces left",
    full: "Reserve list open",
    chooseBrand: "Choose your brand.",
    sending: "Joining…",
    offline: "That didn't go through. Please try again.",
    closed: "The waitlist isn't open yet, so please check back soon.",
    space: { heading: "You're in the First 10", line: "You're number {place} on the waitlist, and we've sent you a confirmation email from hello@tmke.co.uk." },
    reserve: { heading: "You're on the Reserve List", line: "The first 10 spaces have gone, so you're number {place} on the reserve list, which we keep in order. We've sent you a confirmation email from hello@tmke.co.uk." },
    already: { heading: "You're Already on the List", line: "That email is already on the waitlist, at number {place}." },
  },

  options: {
    label: "Your Options",
    heading: "Two Ways to Have It",
    intro: "You can have Done For You as part of a monthly subscription that also includes scheduling, training and more. Or you can add it to a month when that month's calendar is released. Each option shows the RRP and your price through your brand.",
  },

  subscription: {
    label: "Done For You subscription",
    name: "Done For You subscription",
    summary: "You get ten branded posts every month, plus everything in Content Calendar + Scheduling. On top of that, you get advanced training, the full content library and a few extras.",
    includes: [
      "Ten branded, personalised posts every month",
      "Schedule and publish to Instagram and Facebook",
      "The full library of past content",
      "Advanced training courses and masterclasses",
      "Free seasonal Edit packs",
      "Discounted tickets to affiliated estate agency events",
    ],
  },

  addOn: {
    label: "Monthly add-on",
    name: "Monthly add-on",
    summary: "Add Done For You to a month when that month's calendar is released. Our team will brand and personalise that month's ten posts for you.",
    includes: [
      "Ten branded, personalised posts for that month",
      "Placed in your calendar for you to approve",
    ],
    excludes: "Scheduling, the content library, advanced training and the other extras aren't included unless you're also on Content Calendar + Scheduling.",
  },

  more: {
    label: "And There's More",
    heading: "Your Posts, and Everything Around Them",
    intro: "The Done For You subscription includes everything in Content Calendar + Scheduling, so you can schedule and publish to Instagram and Facebook straight from the Hub. It also gives you the full library of past content, advanced training courses and masterclasses, free seasonal Edit packs and discounted tickets to affiliated estate agency events.",
    button: "Join the waitlist",
    tiles: [
      { key: "Brand", line: "Ten posts branded for you.", img: "/assets/signup/2.webp" },
      { key: "Review", line: "Approve them, or ask for changes.", img: "/assets/signup/3.webp" },
      { key: "Schedule", line: "Publish to Instagram and Facebook.", img: "/assets/signup/4.webp" },
      { key: "Library", line: "The full library of past content.", img: "/assets/signup/5.webp" },
      { key: "Learn", line: "Advanced courses and masterclasses.", img: "/assets/signup/6.webp" },
      { key: "Shop", line: "Free seasonal Edit packs.", img: "/assets/signup/7.webp" },
      { key: "Events", line: "Discounted tickets to affiliated events.", img: "/assets/signup/8.webp" },
      { key: "Hub", line: "All in the Member Hub you already use.", img: "/assets/signup/9.webp" },
    ],
  },
};
