/* The print materials guide's content, one entry per brand (Danielle, 30 Oct
   2026). A stand-in for the table the admin Design Studio will manage: the
   same fields, so the guide's layout can be judged now and fed from the
   database later. Taken from the live templates on 30 Oct; summaries and
   "when to use" are drafts for Dani to rewrite (docs/print-materials). */
const T = "https://tqqezhvjakohraiverei.supabase.co/storage/v1/object/public/calendar-assets/d1fb7525-4f2b-4ac4-86f8-47a03704dd38/templates/";
const pic = (f) => `${T}${f}.jpg`;

export const PRINT_MATERIALS = {
  tpe: {
    brand: "The Property Experts",
    short: "TPE",
    updated: "30 October 2026",
    packs: [
      {
        key: "canvassing-cards",
        type: "Canvassing Cards",
        packId: "422cadb3-0e74-4f54-89aa-150e115e052f",
        line: "Double-sided cards to post through doors in your area, whether you're introducing yourself, promoting a listing or inviting a valuation.",
        format: "A5 landscape",
        sides: "Front and back",
        items: [
          { title: "Valuation Invitation", front: pic("1ipjg0b-4zkz"), back: pic("1rxnftw-47fn"),
            summary: "Invites homeowners to book a free, no-obligation valuation, with your details and a QR code on the back.",
            when: "When canvassing an area where you'd like more instructions, or following up a sale nearby." },
          { title: "Sorry I Missed You", front: pic("19807nw-3fkb"), back: pic("z4ivsb-3e0b"),
            summary: "A friendly note for when you've called and nobody was home, inviting them to get in touch.",
            when: "Through the door after an unanswered knock, while door-knocking or calling by." },
          { title: "New To Market", front: pic("cqkvsa-83rn"), back: pic("1oxqsq7-4quf"),
            summary: "Announces a property you've just listed, with its photos, key details and guide price.",
            when: "Around a new listing, to find buyers and show neighbours you're active in their area." },
          { title: "Open House Invitation", front: pic("tb8fnz-4lrj"), back: pic("1niwaul-5s1v"),
            summary: "Invites people to an open house, with the date, time and the property's details.",
            when: "In the week or two before an open house, delivered around the property." },
          { title: "Recently Sold", front: pic("107tcje-74d7"), back: pic("17jpl4s-4usr"),
            summary: "Shares a recent sale and tells nearby homeowners you have buyers looking for similar homes.",
            when: "Once a sale is agreed or completes, delivered to the streets around it." },
        ],
      },
      {
        key: "brochures",
        type: "Brochures",
        packId: "77e2bf1a-a3cf-424c-98d1-d315434049e2",
        line: "Longer reads to leave with homeowners: how to sell well, and why to choose The Property Experts.",
        format: null,          // each brochure says its own
        sides: "4 pages",
        items: [
          { title: "10 Ways To Attract More Buyers", format: "A5 portrait", front: pic("1x1828g-5a93"), back: pic("13iauhj-aktj"),
            summary: "A practical guide for sellers: ten ways to attract more buyers, from photography and staging to video and targeted adverts.",
            when: "For homeowners whose property hasn't sold, or to leave behind after a valuation." },
          { title: "20 Reasons To Choose The Property Experts", format: "A4 portrait", front: pic("11pap97-76j7"), back: pic("1gofbcu-ai5v"),
            summary: "Twenty reasons to choose The Property Experts, from one agent start to finish to marketing that reaches more buyers.",
            when: "At or after a valuation appointment, or alongside a pitch for an instruction." },
        ],
      },
    ],
  },
};
