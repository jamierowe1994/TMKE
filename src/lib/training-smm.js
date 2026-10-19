/* The training account as a social media client (Danielle, 19 Oct 2026).
 *
 * Alex Mercer of Rimberio Homes (src/data/demo-brand.js), managed on
 * Instagram, Facebook and LinkedIn, with August and September 2026 reports,
 * so the training account shows what a real three-platform client sees: the
 * plan on Socials, the report slides and the PDF. Lives here, never in the
 * database: no client row, no reports, nothing for the admin to tidy up.
 * Used whenever isTrainingDemo() is on (src/lib/demo.js).
 *
 * The shape is what the Worker's /smm/mine returns: { client, visibility,
 * reports[] } with each report { id, platform, month (0-based), year, data }.
 */

const pic = (name) => encodeURI(`/assets/${name}`);

// ---- August 2026 -------------------------------------------------------------
const AUG = {
  platforms: ["instagram", "facebook", "linkedin"],
  summary: "- Reach grew 12% on July, carried by two reels about homes on the coast path.\n- Interactions rose with it, so the extra reach was the right people.\n- Posts held steady; reels did the heavy lifting.\n- 41 new followers, most of them local.",
  profile: { followers: 2384, newFollowers: 41, reach: 6120, reachChange: 12.4, views: 18450, viewsChange: 9.8, interactions: 612, interactionsChange: 7.1, interactionRate: 10.0, linkTaps: 38, ukFollowers: 2210 },
  reach: { nonFollower: 4890, follower: 2410 },
  posts: { published: 9, reach: 3100, views: 7400, interactions: 268, interactionRate: 8.6, likes: 214, comments: 22, saves: 19, shares: 13 },
  reels: { published: 5, reach: 4200, views: 11050, interactions: 344, interactionRate: 8.2, likes: 270, comments: 31, saves: 25, shares: 18 },
  content: [
    { title: "Walking the coast path to a glass house above Thurlestone", type: "Reel", date: "2026-08-14", reach: 1680, views: 4320, interactions: 141, thumb: pic("Home-window.jpg") },
    { title: "Behind the scenes on a Salcombe shoot", type: "Reel", date: "2026-08-06", reach: 1120, views: 2950, interactions: 92, thumb: pic("home video.jpg") },
    { title: "Just listed: a stone cottage with a south-west terrace", type: "Post", date: "2026-08-20", reach: 890, views: 1960, interactions: 77, thumb: pic("cosy home.jpg") },
    { title: "The kitchen that sold the house", type: "Post", date: "2026-08-27", reach: 640, views: 1410, interactions: 58, thumb: pic("home kitchen.jpg") },
    { title: "Five minutes with our valuer, Kate", type: "Reel", date: "2026-08-22", reach: 610, views: 1730, interactions: 51, thumb: pic("home chair.jpg") },
    { title: "What sold in South Hams this summer", type: "Post", date: "2026-08-10", reach: 520, views: 1180, interactions: 39, thumb: pic("home forest.jpg") },
  ],
  demographics: {
    age: [
      { range: "18-24", male: 2, female: 3, unspecified: 0 }, { range: "25-34", male: 9, female: 14, unspecified: 1 },
      { range: "35-44", male: 12, female: 17, unspecified: 1 }, { range: "45-54", male: 10, female: 13, unspecified: 0 },
      { range: "55-64", male: 6, female: 8, unspecified: 0 }, { range: "65+", male: 2, female: 2, unspecified: 0 },
    ],
    topCities: [{ city: "Exeter", count: 412 }, { city: "Plymouth", count: 287 }, { city: "Salcombe", count: 241 }, { city: "Kingsbridge", count: 198 }, { city: "Totnes", count: 156 }, { city: "London", count: 121 }],
    topCountries: [{ country: "United Kingdom", count: 2210 }, { country: "Spain", count: 34 }, { country: "France", count: 22 }, { country: "United States", count: 19 }],
  },
  facebook: {
    summary: "- Page reach up 14%, helped by the open house event post.\n- Engagement up 18%, mostly reactions and shares from local groups.\n- Video plays climbing as we post more short clips.",
    pageLikes: 1840, newFans: 22, newFansChange: 10, pageReach: 9800, pageReachChange: 14, pageViews: 420, pageViewsChange: 6,
    posts: { published: 12, publishedChange: 9, views: 11200, viewsChange: 12, engagement: 386, engagementChange: 18, reactions: 301, comments: 41, shares: 44, videoPlays: 1250, videoPlaysChange: 22, images: 9, videos: 3, text: 0, links: 0 },
    medianByType: [{ type: "Image", reach: 640, engagement: 21 }, { type: "Video", reach: 910, engagement: 34 }],
    topCountries: [{ country: "United Kingdom", count: 1712 }, { country: "Spain", count: 28 }, { country: "France", count: 17 }],
    topCities: [{ city: "Exeter", count: 386 }, { city: "Plymouth", count: 241 }, { city: "Kingsbridge", count: 172 }, { city: "Salcombe", count: 160 }, { city: "Totnes", count: 118 }],
    content: [
      { title: "Open house this Saturday in Hope Cove, 10am to 1pm", date: "2026-08-19", reach: 2140, engagementRate: 6.1, reactions: 88, shares: 19, thumb: pic("home window.jpg") },
      { title: "Coast path to front door: a short film", date: "2026-08-14", reach: 1730, engagementRate: 5.2, reactions: 64, shares: 9, videoViews: 690, thumb: pic("Home-window.jpg") },
      { title: "Sold in eight days: thank you to the Hendersons", date: "2026-08-25", reach: 1310, engagementRate: 7.4, reactions: 71, shares: 6, thumb: pic("home deer.jpg") },
      { title: "Just listed: stone cottage, south-west terrace", date: "2026-08-20", reach: 980, engagementRate: 3.8, reactions: 29, shares: 4, thumb: pic("cosy home.jpg") },
      { title: "August in the South Hams market", date: "2026-08-10", reach: 720, engagementRate: 2.9, reactions: 18, shares: 3, thumb: pic("home forest.jpg") },
    ],
  },
  linkedin: {
    summary: "- Impressions up 11%, mostly from the market update document.\n- Alex's own posts outperform the company's two to one.\n- Engagement rate steady at 3.8%.",
    period: "Aug 01, 2026 to Aug 31, 2026",
    followers: 612, followerGrowth: 18, followerGrowthChange: 20, connections: 845, impressions: 3400, impressionsChange: 11,
    posts: { published: 6, publishedChange: 20, impressions: 3100, impressionsChange: 11, reach: 1980, reachChange: 9, reactions: 96, reactionsChange: 12, comments: 21, commentsChange: 5, engagement: 117, engagementChange: 14, engagementRate: 3.8, engagementRateChange: 2, text: 2, image: 2, video: 1, article: 0, document: 1, others: 0 },
    videos: { published: 1, reach: 310, engagement: 22, views: 420, watchTime: 34 },
    byWeekday: [{ day: "Monday", impressions: 380, engagement: 12 }, { day: "Tuesday", impressions: 690, engagement: 27 }, { day: "Wednesday", impressions: 610, engagement: 24 }, { day: "Thursday", impressions: 540, engagement: 19 }, { day: "Friday", impressions: 420, engagement: 15 }, { day: "Saturday", impressions: 160, engagement: 5 }, { day: "Sunday", impressions: 300, engagement: 9 }],
    content: [
      { title: "Devon's second-home market, August: what changed", date: "2026-08-12", reach: 720, engagement: 41, reactions: 33, comments: 8, thumb: pic("home forest.jpg") },
      { title: "Why we film every listing now", date: "2026-08-19", reach: 430, engagement: 26, reactions: 20, comments: 6, thumb: pic("home video.jpg") },
      { title: "Welcoming Kate to the valuations team", date: "2026-08-05", reach: 360, engagement: 22, reactions: 19, comments: 3, thumb: pic("home chair.jpg") },
      { title: "Three questions every seller should ask their agent", date: "2026-08-26", reach: 280, engagement: 15, reactions: 12, comments: 3 },
      { title: "A good week in Salcombe", date: "2026-08-28", reach: 190, engagement: 13, reactions: 12, comments: 1 },
    ],
  },
  trendSummary: "Instagram:\n- Reach and interactions both up on July, led by reels.\n- Follower growth steady at around 40 a month.\n\nFacebook:\n- Reach up for a second month, on event and sold posts.\n\nLinkedIn:\n- Impressions up 11%; documents travel furthest.",
  priorities: [
    { platform: "instagram", type: "go", title: "More coast reels", text: "Two reels a week built around the walk to the house, as those reached furthest this month." },
    { platform: "instagram", type: "caution", title: "Stronger first frame", text: "Open each reel on the view, not the front door, so more people stay past three seconds." },
    { platform: "facebook", type: "go", title: "Every open house", text: "An event post for every open house, shared to local groups the Monday before." },
    { platform: "linkedin", type: "go", title: "Monthly market note", text: "A short market note as a document on the first Tuesday of each month, from Alex." },
  ],
  goals: [
    { platform: "instagram", goal: "Grow followers", measure: "2,600 by 31 December" },
    { platform: "facebook", goal: "Page reach", measure: "Above 10,000 a month by November" },
    { platform: "linkedin", goal: "Engagement rate", measure: "4% or more each month" },
  ],
  comingSoon: ["Open house film: Hope Cove", "September market note", "Meet the team: Kate"],
  client: {
    // One combined figure, then one from each platform; each insight rests on one.
    headline: ["all_reach", "reach", "fb_pageReach", "li_impressions"],
    insights: [
      { platform: "instagram", category: "working", headline: "Coast path reels travelled furthest", analysis: "Your two reels that start on the coast path reached more people than any post this year, most of them not yet following you. We'll build more around the walk to the house.", evidence: ["Coast path reel: 1,680 reached", "Reels: 4,200 reached in all"], confidence: "strong" },
      { platform: "facebook", category: "working", headline: "Open house posts bring people in", analysis: "The Hope Cove open house was your best Facebook post, shared into local groups. Event posts give people a reason to act, so we'll post one for every open house.", evidence: ["Open house post: 2,140 reached", "19 shares"], confidence: "strong" },
      { platform: "linkedin", category: "learning", headline: "Your market notes get read", analysis: "The August market document reached more people than anything else on LinkedIn, and drew the most comments. Agents and buyers value the numbers, so we'll make it monthly.", evidence: ["Market note: 720 reached", "8 comments"], confidence: "emerging" },
    ],
    priorities: [
      { platform: "instagram", title: "More coast reels", text: "Into September we'll post two reels a week that start on the walk to the house, because those reached the most new people." },
      { platform: "facebook", title: "Every open house", text: "We'll post every open house as an event and share it with local groups, as the Hope Cove post did so well." },
      { platform: "linkedin", title: "A monthly market note", text: "We'll publish a short market note from you on the first Tuesday of each month." },
    ],
  },
};

// ---- September 2026 ----------------------------------------------------------
const SEP = {
  platforms: ["instagram", "facebook", "linkedin"],
  summary: "- Reach up 18% on August, the best month so far, with reels doing most of it.\n- Interaction rate up to 10.6% as reels opened on the view.\n- 58 new followers, the most in a month.\n- Posts dipped slightly as we shifted time to reels.",
  profile: { followers: 2442, newFollowers: 58, reach: 7220, reachChange: 18.0, views: 21900, viewsChange: 18.7, interactions: 765, interactionsChange: 25.0, interactionRate: 10.6, linkTaps: 51, ukFollowers: 2268 },
  reach: { nonFollower: 5980, follower: 2560 },
  posts: { published: 7, reach: 2780, views: 6600, interactions: 241, interactionRate: 8.7, likes: 193, comments: 20, saves: 17, shares: 11 },
  reels: { published: 8, reach: 5760, views: 15300, interactions: 524, interactionRate: 9.1, likes: 401, comments: 47, saves: 44, shares: 32 },
  content: [
    { title: "From the coast path: a barn conversion above Bigbury", type: "Reel", date: "2026-09-09", reach: 2240, views: 5810, interactions: 198, thumb: pic("home forest.jpg") },
    { title: "Open house film: Hope Cove", type: "Reel", date: "2026-09-02", reach: 1510, views: 3920, interactions: 127, thumb: pic("home window.jpg") },
    { title: "Morning light in the kitchen at Bolt Head", type: "Reel", date: "2026-09-17", reach: 1090, views: 2860, interactions: 96, thumb: pic("home kitchen.jpg") },
    { title: "Sold: the stone cottage with the south-west terrace", type: "Post", date: "2026-09-12", reach: 820, views: 1800, interactions: 74, thumb: pic("cosy home.jpg") },
    { title: "Meet the team: Kate, valuations", type: "Post", date: "2026-09-23", reach: 610, views: 1320, interactions: 55, thumb: pic("home chair.jpg") },
    { title: "Five things that sell a house in autumn", type: "Reel", date: "2026-09-26", reach: 580, views: 1500, interactions: 49, thumb: pic("home ginger.jpg") },
  ],
  demographics: {
    age: [
      { range: "18-24", male: 2, female: 3, unspecified: 0 }, { range: "25-34", male: 9, female: 15, unspecified: 1 },
      { range: "35-44", male: 12, female: 18, unspecified: 1 }, { range: "45-54", male: 10, female: 12, unspecified: 0 },
      { range: "55-64", male: 6, female: 7, unspecified: 0 }, { range: "65+", male: 2, female: 2, unspecified: 0 },
    ],
    topCities: [{ city: "Exeter", count: 421 }, { city: "Plymouth", count: 296 }, { city: "Salcombe", count: 252 }, { city: "Kingsbridge", count: 207 }, { city: "Totnes", count: 161 }, { city: "London", count: 128 }],
    topCountries: [{ country: "United Kingdom", count: 2268 }, { country: "Spain", count: 35 }, { country: "France", count: 23 }, { country: "United States", count: 20 }],
  },
  facebook: {
    summary: "- Page reach up 11% to 10,880, past the 10,000 goal a month early.\n- The open house film was the most-watched video yet.\n- Shares down slightly; reactions and comments up.",
    pageLikes: 1873, newFans: 33, newFansChange: 50, pageReach: 10880, pageReachChange: 11, pageViews: 465, pageViewsChange: 11,
    posts: { published: 13, publishedChange: 8, views: 12900, viewsChange: 15, engagement: 452, engagementChange: 17, reactions: 362, comments: 52, shares: 38, videoPlays: 1840, videoPlaysChange: 47, images: 8, videos: 4, text: 0, links: 1 },
    medianByType: [{ type: "Image", reach: 610, engagement: 19 }, { type: "Video", reach: 1180, engagement: 41 }, { type: "Link", reach: 240, engagement: 4 }],
    topCountries: [{ country: "United Kingdom", count: 1744 }, { country: "Spain", count: 29 }, { country: "France", count: 17 }],
    topCities: [{ city: "Exeter", count: 391 }, { city: "Plymouth", count: 248 }, { city: "Kingsbridge", count: 179 }, { city: "Salcombe", count: 166 }, { city: "Totnes", count: 121 }],
    content: [
      { title: "Open house film: Hope Cove", date: "2026-09-02", reach: 2610, engagementRate: 6.8, reactions: 112, shares: 14, videoViews: 1120, thumb: pic("home window.jpg") },
      { title: "Open house this Saturday at Bigbury, 10am to 1pm", date: "2026-09-16", reach: 1880, engagementRate: 5.9, reactions: 79, shares: 12, thumb: pic("home forest.jpg") },
      { title: "Sold: the stone cottage with the south-west terrace", date: "2026-09-12", reach: 1420, engagementRate: 7.1, reactions: 83, shares: 5, thumb: pic("cosy home.jpg") },
      { title: "Morning light at Bolt Head", date: "2026-09-17", reach: 960, engagementRate: 4.2, reactions: 33, shares: 4, videoViews: 410, thumb: pic("home kitchen.jpg") },
      { title: "September in the South Hams market", date: "2026-09-08", reach: 740, engagementRate: 3.1, reactions: 20, shares: 3, thumb: pic("home deer.jpg") },
    ],
  },
  linkedin: {
    summary: "- Impressions up 14% with the first monthly market note.\n- Engagement rate up to 4.1%, past the 4% goal.\n- Tuesday is now clearly the best day.",
    period: "Sep 01, 2026 to Sep 30, 2026",
    followers: 641, followerGrowth: 29, followerGrowthChange: 61, connections: 868, impressions: 3880, impressionsChange: 14,
    posts: { published: 7, publishedChange: 17, impressions: 3560, impressionsChange: 15, reach: 2240, reachChange: 13, reactions: 118, reactionsChange: 23, comments: 27, commentsChange: 29, engagement: 145, engagementChange: 24, engagementRate: 4.1, engagementRateChange: 8, text: 2, image: 2, video: 1, article: 0, document: 2, others: 0 },
    videos: { published: 1, reach: 380, engagement: 29, views: 510, watchTime: 41 },
    byWeekday: [{ day: "Monday", impressions: 410, engagement: 14 }, { day: "Tuesday", impressions: 920, engagement: 38 }, { day: "Wednesday", impressions: 640, engagement: 26 }, { day: "Thursday", impressions: 580, engagement: 22 }, { day: "Friday", impressions: 470, engagement: 17 }, { day: "Saturday", impressions: 190, engagement: 6 }, { day: "Sunday", impressions: 340, engagement: 11 }],
    content: [
      { title: "Market note, September: Devon's coastal prices in one page", date: "2026-09-01", reach: 860, engagement: 52, reactions: 41, comments: 11, thumb: pic("home forest.jpg") },
      { title: "What a coast-path film does for a listing", date: "2026-09-15", reach: 510, engagement: 31, reactions: 24, comments: 7, thumb: pic("home video.jpg") },
      { title: "Autumn: the quiet season that isn't", date: "2026-09-22", reach: 330, engagement: 19, reactions: 16, comments: 3, thumb: pic("home ginger.jpg") },
      { title: "Why we price to the market, not the hope", date: "2026-09-08", reach: 300, engagement: 24, reactions: 18, comments: 6 },
      { title: "Thank you, Bigbury", date: "2026-09-26", reach: 240, engagement: 19, reactions: 19, comments: 0 },
    ],
  },
  trendSummary: "Instagram:\n- Reach up two months running; September the best yet.\n- Reels now carry two thirds of reach, posts the rest.\n- Followers up 99 across the two months.\n\nFacebook:\n- Reach past 10,000, the goal set in August.\n- Video plays up 47% as films replace photos.\n\nLinkedIn:\n- Impressions and engagement up on August; the market note leads both.",
  priorities: [
    { platform: "instagram", type: "go", title: "Keep the coast reels", text: "Two reels a week again, each opening on the view." },
    { platform: "instagram", type: "caution", title: "Lift the posts", text: "Carousels for sold homes, as single images slipped this month." },
    { platform: "facebook", type: "go", title: "Films over photos", text: "A short film for every new listing, as video reached twice as far as images." },
    { platform: "linkedin", type: "go", title: "Post on Tuesdays", text: "Move Alex's posts to Tuesday mornings, the busiest day by some way." },
  ],
  goals: [
    { platform: "instagram", goal: "Grow followers", measure: "2,600 by 31 December" },
    { platform: "facebook", goal: "Page reach", measure: "Above 10,000 a month (met in September)" },
    { platform: "linkedin", goal: "Engagement rate", measure: "4% or more each month" },
  ],
  comingSoon: ["October market note", "Bigbury barn film", "Autumn buyers' guide"],
  client: {
    headline: ["all_newFollowers", "reach", "fb_videoPlays", "li_engagementRate"],
    insights: [
      { platform: "instagram", category: "working", headline: "Your best month for reach yet", analysis: "More people saw your Instagram in September than any month so far, and most of them weren't following you yet. Reels that open on the view did most of it, so we'll keep that going.", evidence: ["7,220 reached, up 18%", "Bigbury reel: 2,240 reached"], confidence: "strong" },
      { platform: "facebook", category: "previous", headline: "Open house posts did their job", analysis: "We said we'd post every open house as an event in August. Both September open houses were in your top two Facebook posts, and the Hope Cove film was your most-watched video.", evidence: ["Hope Cove film: 2,610 reached", "Video plays up 47%"], confidence: "strong" },
      { platform: "linkedin", category: "working", headline: "Tuesdays are your day", analysis: "Your LinkedIn posts are seen most on a Tuesday, and that's when people engage most too. We'll move your posts to Tuesday mornings.", evidence: ["Tuesday: 920 impressions", "Engagement rate 4.1%"], confidence: "emerging" },
      { platform: "all", category: "working", headline: "120 new followers in a month", analysis: "Across Instagram, Facebook and LinkedIn, 120 people started following you in September, the most in any month so far. Most found you through reels and films of the coast.", evidence: ["Instagram 58", "Facebook 33", "LinkedIn 29"], confidence: "strong" },
    ],
    priorities: [
      { platform: "instagram", title: "More of the coast reels", text: "Into October we'll keep two reels a week that open on the view, as they brought most of your new followers." },
      { platform: "facebook", title: "A film for every listing", text: "We'll make a short film for each new listing, because your videos reached twice as many people as photos." },
      { platform: "linkedin", title: "Tuesday mornings", text: "We'll post your LinkedIn updates on Tuesday mornings, when your network is most active." },
    ],
  },
};

export const TRAINING_SMM = {
  client: {
    business: "Rimberio Homes",
    full_name: "Alex Mercer",
    email: "alex@rimberiohomes.co.uk",
    phone: "01295 123456",
    social_media_manager: "Abbie",
    package_name: "Growth",
    price: "£750 / month",
    start_date: "2026-07-01",
    platforms: ["Instagram", "Facebook", "LinkedIn"],
    instagram_url: "instagram.com/rimberiohomes",
    facebook_url: "facebook.com/rimberiohomes",
    linkedin_url: "linkedin.com/company/rimberio-homes",
  },
  visibility: null,
  // The invoices chapter: two paid, the latest outstanding. No PDFs behind
  // them; the page says so when one is asked for.
  invoices: [
    { id: "training-inv-1043", number: "TMKE-1043", total_pence: 90000, status: "sent", due_date: "2026-10-31" },
    { id: "training-inv-1021", number: "TMKE-1021", total_pence: 90000, status: "paid", due_date: "2026-09-30", paid_date: "2026-09-26" },
    { id: "training-inv-1002", number: "TMKE-1002", total_pence: 90000, status: "paid", due_date: "2026-08-31", paid_date: "2026-08-29" },
  ],
  // Newest first, as /smm/mine returns them.
  reports: [
    { id: "training-2026-09", platform: "Instagram", month: 8, year: 2026, data: SEP },
    { id: "training-2026-08", platform: "Instagram", month: 7, year: 2026, data: AUG },
  ],
};
