/* Seasonal landing pages (Dani, 26 Oct): a promotion turned into a one-page
   sign-up, for a social post to link to. Each lives at /seasonal/<slug>, and
   /seasonal itself goes to whichever is `current`, so a link in a bio can
   stay the same from one season to the next.

   To add the next one, copy the Halloween entry, change it, and move
   `current` across. Pictures go in public/images/seasonal/<slug>/.

   endsAt  after this the page sends people to /join instead, so an old post
           never promises something that has gone.
   next    where a new member lands once signed up: the pack in the Studio.
           ?pack= takes a pack's slug or its id. */
export const SEASONAL = [
  {
    slug: "halloween",
    current: true,
    title: "Free Halloween Templates — TMKE",
    description: "Four Halloween templates from The Autumn Edit, free to TMKE members for one week. Create your free account and they're waiting in the Studio.",
    endsAt: "2026-11-01T00:00:00Z",   // the end of 31 October, UK time
    og: "/images/seasonal/halloween/og.jpg",   // the link preview, 1200 x 630
    hero: { src: "/images/seasonal/halloween/hero.webp", alt: "Someone in a Halloween mask holding up a TMKE Happy Halloween sign on a zebra crossing" },
    chapter: "Free for Halloween",
    heading: "No Tricks, Just Free Templates",
    body: [
      "You've probably had enough marketing nightmares this year, so we thought we'd give you something a little nicer. For one week only, we're unlocking four Halloween templates from The Autumn Edit, our paid autumn pack, and making them free to TMKE members.",
      "To get them, you'll need a TMKE account, and it's free to create. Once you've joined, all four designs will be waiting for you in the Studio, our members' design tool. They're made for estate agents and ready to edit.",
      "But be quick. They won't be haunting the Studio for long.",
    ],
    button: "Create your free account",
    memberButton: "Open your Halloween templates",
    endsNote: "The free week ends on 31 October.",
    templatesLine: "Here's what's waiting for you in the Studio.",
    templates: [
      { name: "It's Pumpkin Picking Season", img: "/images/seasonal/halloween/t1.webp" },
      { name: "Love at First Fright", img: "/images/seasonal/halloween/t2.webp" },
      { name: "Property Nightmares", img: "/images/seasonal/halloween/t3.webp" },
      { name: "The Scariest Thing About Selling Your Home", img: "/images/seasonal/halloween/t4.webp" },
    ],
    panel: {
      chapter: "Your Free Templates",
      heading: "Four Treats, Ready to Edit",
      sub: "Create your free TMKE account and the four Halloween templates from The Autumn Edit will be waiting for you in the Studio.",
    },
    next: "/account/editor?pack=happy-halloween",
  },
];

export const currentSeasonal = () => SEASONAL.find((s) => s.current) || null;
