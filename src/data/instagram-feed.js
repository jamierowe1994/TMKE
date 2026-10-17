/* Our latest Instagram posts, in a row along the foot of the hub's Contact
   page (src/components/account/InstagramStrip.astro; Dani, 17 Oct).

   The easy way, and it keeps itself up to date: a Behold JSON feed.
     1. behold.so -> sign up, connect the TMKE Instagram account.
     2. Create a feed, type "JSON".
     3. Paste its link below, e.g. "https://feeds.behold.so/AbCdEf123".
   The link isn't a secret: it only reads the public posts.

   Or list posts by hand, newest first (the feed link wins if both are set):
     { image: "https://assets.tmke.co.uk/instagram/2026-10-14.webp",
       href: "https://www.instagram.com/p/XXXXXXXX/" },

   With neither, the row isn't shown. */

export const INSTAGRAM_HANDLE = "";      // e.g. "themarketingexperts", for "Follow along on Instagram @..."
export const INSTAGRAM_FEED_URL = "";
export const INSTAGRAM_POSTS = [];
