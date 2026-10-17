/* Custom pictures for the two cards in the pull-out menu (Dani, 17 Oct).
   Without one, a card uses the pack's own cover or the update's picture.

   The card is a strip 369 x 77 on screen, so make them 1500 x 312 px
   (about 4.8 : 1; twice the size, for sharp screens), with anything that
   matters in the middle: the edges can crop on narrow screens.

     packs: { "autumn-edit": "https://assets.tmke.co.uk/menu/autumn-edit.webp" },
     news:  "https://assets.tmke.co.uk/menu/whats-new.webp",

   A pack is named by its address in The Edit (/edit/<this>). */
export const MENU_CARDS = {
  packs: {},
  news: "",
};
