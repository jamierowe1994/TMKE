/* The test plan for the Marketing Calendar (Dani, 16 Oct 2026).

   Every feature, as the steps a person would take and what should happen.
   The tests (calendar.spec.mjs) run these steps in a real browser, in the
   training account, and the report page (report.mjs) shows each one as
   passed, failed or skipped. Add a feature here first, then its test.

   Everything a test makes is marked [TEST] and removed at the end. */

export const PLAN = [
  // ---- The page ----
  { id: "page", area: "The calendar", name: "The calendar opens", steps: [
    "Open the Marketing Calendar in the training account",
    "The title, the month and the days are there, with no errors",
    "The arrows move a month either way and Today comes back",
  ] },
  { id: "views", area: "The calendar", name: "Everything, Posts and Activities", steps: [
    "Choose Posts: activities and their key go, post ideas stay",
    "Choose Activities: post ideas go, the six categories show in the key",
    "Reload the page: the last choice is remembered",
    "Choose Everything again",
  ] },
  { id: "chooser", area: "The calendar", name: "Add activity to this day", steps: [
    "Open a day and press Add activity to this day",
    "Content & Social, Property Marketing, Campaigns, Print & Canvassing and Business & Community are there, with Something Else under Content & Social",
    "The Content Studio Session shows (training sees what an Experts Group agent sees)",
  ] },
  { id: "timepicker", area: "The calendar", name: "The time picker", steps: [
    "Open a time box: hours, and minutes in quarter hours only",
    "Pick 14:30 and the box says 14:30",
    "An optional time can be cleared back to All day",
  ] },

  // ---- Content & Social ----
  { id: "content_planning", area: "Content & Social", name: "Content Planning", steps: [
    "Fill in the date, a time, notes and two checklist items; tick one",
    "Save: it shows on its day",
    "Open it again: the time, notes and checklist (1 of 2 done) are as saved",
    "Change the notes and save; remove it",
  ] },
  { id: "content_studio", area: "Content & Social", name: "Content Studio Session", steps: [
    "Two cards: Book with TMKE, and Booked or arranged it yourself?",
    "Discover our studio opens the studio page",
    "Download the brochure opens the brochure (a PDF)",
    "Book now in training says training doesn't book anything",
    "Add a studio booking: a date and time, save, it shows on its day",
  ] },
  { id: "agent_filming", area: "Content & Social", name: "Agent Filming Day", steps: [
    "Discover videography packages opens the agent videography page",
    "Add a filming day with a location; save; open it again",
  ] },
  { id: "social_choice", area: "Content & Social", name: "Social Media Post: three ways", steps: [
    "Social Media Post offers Use one of your designs, Design from a template and Upload a post",
    "Design from a template goes to your packs in the Studio, and a pack opened from there keeps the day",
    "Use one of your designs opens your designs; plan one with a caption (when training has a design)",
  ] },
  { id: "social_upload", area: "Content & Social", name: "Social Media Post: upload", steps: [
    "Continue without anything says to upload or add a link",
    "Upload a PNG, a JPEG and a PDF, and add a link",
    "Plan it with a title, date, time and caption",
    "Open the post: its three files and the link are listed and open",
    "Email it to me now sends it to danielle@tmke.co.uk",
  ] },
  { id: "email_newsletter", area: "Content & Social", name: "Email / Newsletter", steps: [
    "Saving without a subject asks for one",
    "Upload the copy (a PDF) and add a link to it",
    "Write the audience, and upload an audience file",
    "Save; open it again: both files, the link and the audience are there",
    "Open the copy: it opens in a new tab",
    "Remove one file and save; remove the entry: its files go too",
  ] },
  { id: "paid_ads", area: "Content & Social", name: "Paid Advertising", steps: [
    "Platform, campaign name, budget and an end date four days on",
    "Save: it runs across every day to the end date",
  ] },

  // ---- Print & Canvassing ----
  { id: "print", area: "Print & Canvassing", name: "Print design, ordering and canvassing", steps: [
    "Create Print Design asks what it's for and links to the Studio",
    "Order Print Marketing: materials and quantity; save",
    "Canvassing / Leaflet Drop: the area; save",
  ] },

  // ---- Property Marketing ----
  { id: "property_shoot", area: "Property Marketing", name: "Property Photography or Filming", steps: [
    "Book with TMKE has Book property filming and Book property photography",
    "Discover our property packages opens the property page",
    "Booked or arranged it yourself? has Photography shoot and Property videography",
    "Photography shoot: the form says Photography Shoot; save with an address",
    "The day shows it as Photography",
  ] },
  { id: "open_house", area: "Property Marketing", name: "Open House / Property Event", steps: [
    "It starts with no checklist and needs a time",
    "Start and end time; save; open it again",
  ] },

  // ---- Campaigns ----
  { id: "campaigns", area: "Campaigns", name: "The four campaigns", steps: [
    "Story of the Sale starts with its 7 steps, above the designs and notes",
    "New Listing Campaign has its 9 steps; Open House Campaign its 8; Seasonal Campaign its 6",
    "Seasonal Campaign needs the season or occasion",
    "Save a campaign with an end date: it runs across its days",
  ] },
  { id: "plan_posts", area: "Campaigns", name: "Plan these posts", steps: [
    "Link designs to a campaign: Plan these posts appears",
    "Each design in turn: date, time and caption, then Plan post & next",
    "Every design is planned as its own post",
  ] },

  // ---- Business & Community ----
  { id: "business", area: "Business & Community", name: "Events, testimonials and follow-ups", steps: [
    "Local Event / Networking: event name, location, a document and a link; save",
    "Request a Testimonial: the client; save",
    "Marketing Follow-Up has a contact (name, address, phone or email) and no checklist; save",
  ] },
  { id: "other", area: "Something Else", name: "Something Else", steps: [
    "Saving without a title asks for one",
    "A title, a file and a link; save; open it again",
  ] },

  // ---- Emails and your own calendar ----
  { id: "reminders", area: "Emails", name: "The 8am reminders", steps: [
    "A new post, property shoot, studio session and filming day have Remind me ticked; the rest don't",
    "The reminder email for an activity is sent to danielle@tmke.co.uk",
  ] },
  { id: "mycal", area: "Your own calendar", name: "Add to my calendar", steps: [
    "A saved entry has Add to my calendar, with Apple, Outlook, Outlook on the web and Google",
    "Apple or Outlook: the calendar file has the entry, its time and its address",
    "Google: the link has the entry's title and dates",
  ] },
  { id: "sync", area: "Your own calendar", name: "Sync to my calendar", steps: [
    "Sync to my calendar gives a private link and the four calendars",
    "Each calendar's link says which calendar it is for",
    "The link's calendar file has the test entries in it",
  ] },
];
