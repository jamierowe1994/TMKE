/* Asking a client for a testimonial: three tones, each as an email and a
   WhatsApp message (Dani's wording, 16 Oct 2026). Shown on the Marketing
   Calendar's Request a Testimonial entry, filled in from the member's brand
   kit and copied with one button.

   Placeholders filled from the brand kit:
     [Agent Name]    their name (about.name); in a WhatsApp message their
                     first name only, as people sign off a message
     [Agency Name]   their business (company)
     [Review Link]   their review link (about.review)
   [First Name] is the client's, which only they know, so it stays for them
   to fill. Anything the kit doesn't have yet stays in its brackets.
   No emojis. */

export const TESTIMONIAL_TONES = [
  {
    key: "friendly", label: "Friendly and personal",
    note: "Warm, conversational and suitable for most agents.",
    email: {
      subject: "A little favour, [First Name]?",
      body: `Hi [First Name],

It's been a pleasure working with you, and I hope you're settling into your next chapter!

I have a small favour to ask. If you've got a couple of minutes, I'd really appreciate you sharing your experience of working with me.

Reviews make a huge difference to my business, and hearing from people like you helps others feel confident about who they're choosing to work with.

You can leave a review here: [Review Link]

Thanks again for trusting me to help you. It really does mean a lot!

[Agent Name]`,
    },
    whatsapp: `Hi [First Name]! Hope you're doing well!

Just wanted to ask a little favour. If you've got a couple of minutes, I'd really appreciate you leaving me a review about your experience working with me.

It makes a huge difference to my business and helps others looking for an estate agent.

Here's the link: [Review Link]

Thanks so much!`,
  },
  {
    key: "professional", label: "Professional and appreciative",
    note: "A slightly more polished approach, without sounding corporate.",
    email: {
      subject: "Thank you for choosing [Agency Name]",
      body: `Hi [First Name],

Thank you for choosing me to help with your property journey. It's been a pleasure working with you.

I'm always looking for ways to improve the service I provide, and feedback from my clients is incredibly valuable. If you could spare a couple of minutes to share your experience, I'd be very grateful.

Leave your review here: [Review Link]

Your feedback not only helps me continue improving but also helps other people make informed decisions when choosing an estate agent.

Thank you again, and I wish you all the best for the future.

Kind regards,
[Agent Name]
[Agency Name]`,
    },
    whatsapp: `Hi [First Name],

It's been a pleasure helping you with your property journey.

If you have a couple of minutes, I'd really appreciate you sharing your experience by leaving a review. Your feedback is incredibly valuable and helps others when choosing an estate agent.

You can leave a review here: [Review Link]

Thanks again for choosing to work with me!

[Agent Name]`,
  },
  {
    key: "short", label: "Short and direct",
    note: "For a client you already know well, without overcomplicating it.",
    email: {
      subject: "Could you spare two minutes?",
      body: `Hi [First Name],

I hope you're doing well!

I just wanted to say thanks again for choosing to work with me.

If you have a couple of minutes, I'd love to hear your feedback. Reviews really help my business and make it easier for others to find an agent they can trust.

Leave a review: [Review Link]

Thanks so much, I really appreciate it!

[Agent Name]`,
    },
    whatsapp: `Hi [First Name]! Hope you're well!

Quick favour, would you mind leaving me a review about your experience working with me?

It only takes a couple of minutes and really helps my business.

Here's the link: [Review Link]

Thanks, I really appreciate it!`,
  },
];

/* The text with what the brand kit knows filled in. `channel` is "email" or
   "whatsapp". */
export function fillTestimonial(text, channel, kit) {
  const about = (kit && kit.about) || {};
  const name = String(about.name || "").trim();
  const first = name.split(/\s+/)[0] || "";
  const agency = String((kit && kit.company) || "").trim();
  const link = String(about.review || "").trim();
  return String(text || "")
    .replace(/\[Agent Name\]/g, (channel === "whatsapp" ? first : name) || "[Agent Name]")
    .replace(/\[Agency Name\]/g, agency || "[Agency Name]")
    .replace(/\[Review Link\]/g, link || "[Review Link]");
}
