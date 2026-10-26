/* Seasonal landing pages (Dani, 26 Oct): a promotion turned into a one-page
   sign-up, for a social post to link to. Each lives at /seasonal/<slug>, and
   /seasonal itself goes to whichever is `current`, so a link in a bio can
   stay the same from one season to the next.

   To add the next one, copy the Halloween entry, change it, and move
   `current` across. Pictures go in public/images/seasonal/<slug>/.

   endsAt  after this the page sends people to /join instead, so an old post
           never promises something that has gone.
   next    where a new member lands once signed up: the pack in the Studio.
           ?pack=free is whichever members pack is free right now, so this
           needn't change when the pack does; a slug or an id works too. */
export const SEASONAL = [
  {
    slug: "halloween",
    current: true,
    title: "Free Halloween Templates — TMKE",
    description: "Four Halloween templates from The Autumn Edit, free to TMKE members for one week. Create your free account and they're waiting in the Studio.",
    endsAt: "2026-11-01T00:00:00Z",   // the end of 31 October, UK time
    og: "/images/seasonal/halloween/og.jpg",   // the link preview, 1200 x 630
    hero: { src: "/images/seasonal/halloween/hero.webp", alt: "Someone in a Halloween mask holding up a TMKE Happy Halloween sign on a zebra crossing" },
    eyebrow: "Halloween at TMKE",
    board: "Happy Halloween",                 // pressed into the board
    boardLink: "Get your free templates",
    featureLabel: "Your Freebies",
    featureBody: "You've probably had enough marketing nightmares this year, so we're giving you something a little nicer. For one week only, four Halloween templates from The Autumn Edit, our paid autumn pack, are free to TMKE members. You'll need an account to get them, but it's free to create. Once you've joined, they'll be waiting in the Studio, ready to edit. But be quick, they won't be haunting it for long.",
    templatesLabel: "Waiting in the Studio",
    chapter: "Free for Halloween",
    heading: "No Tricks, Just Free Templates",
    body: [
      "You've probably had enough marketing nightmares this year, so we thought we'd give you something a little nicer. For one week only, we're unlocking four Halloween templates from The Autumn Edit, our paid autumn pack, and making them free to TMKE members.",
      "To get them, you'll need a TMKE account, and it's free to create. Once you've joined, all four designs will be waiting for you in the Studio, our members' design tool. They're made for estate agents and ready to edit.",
      "But be quick. They won't be haunting the Studio for long.",
    ],
    button: "Create your free account",
    memberButton: "Discover your free Halloween templates",
    endsNote: "Ends on 31st October",
    templates: [
      { name: "It's Pumpkin Picking Season", img: "/images/seasonal/halloween/t1.webp" },
      { name: "Love at First Fright", img: "/images/seasonal/halloween/t2.webp" },
      { name: "Property Nightmares", img: "/images/seasonal/halloween/t3.webp" },
      { name: "The Scariest Thing About Selling", img: "/images/seasonal/halloween/t4.webp" },
    ],
    panel: {
      chapter: "Your Free Templates",
      heading: "Four Treats, Ready to Edit",
      sub: "Create your free TMKE account and the four Halloween templates from The Autumn Edit will be waiting for you in the Studio.",
    },
    // "And there's more": the rest of the hub, its tiles as /join's.
    more: {
      label: "And There's More",
      heading: "Your Marketing, All in One Place",
      intro: "The Studio is where you'll edit your Halloween templates, with tools and your brand kit ready to go. It's part of the TMKE Member Hub, where you can also map out your month, browse ready-made template packs in The Edit, sharpen your marketing with guides and mini-courses, and book a videography shoot or discovery call. Your orders, services and bookings are kept together too, so you can see everything at a glance.",
      button: "Join the Studio",
      memberButton: "Go to the Studio",
      tiles: [
        { key: "Design",   a: "Create scroll-stopping content.", img: "/assets/signup/2.webp" },
        { key: "Plan",     a: "Map out your month in one view.",                 img: "/assets/signup/7.webp" },
        { key: "Shop",     a: "Browse The Edit.",                                img: "/assets/signup/9.webp" },
        { key: "Learn",    a: "Guides and mini-courses.",                        img: "/assets/signup/3.webp" },
        { key: "Book",     a: "Discover our property packages.",              img: "/assets/signup/4.webp" },
        { key: "Trends",   a: "See what's working on social.",                     img: "/assets/signup/5.webp" },
        { key: "Manage",   a: "Everything in one place.",                        img: "/assets/signup/8.webp" },
        { key: "Discover", a: "Explore what's possible.",                        img: "/assets/signup/6.webp" },
      ],
    },
    next: "/account/editor?pack=free",
  },
];

export const currentSeasonal = () => SEASONAL.find((s) => s.current) || null;
