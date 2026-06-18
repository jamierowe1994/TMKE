// The Letting Experts — concept property data. Shared by the homepage bento,
// the search-results page and the per-property detail pages. Garland Road uses
// real photography; the rest fall back to stock imagery for the concept.

const U = (id, w = 1800, h = 1100) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const GARLAND = "https://assets.tmke.co.uk/TLE/TLE%20properties";

/**
 * @typedef {Object} TleProperty
 * @property {string}  slug
 * @property {string}  address    street line
 * @property {string}  locality   town + postcode
 * @property {string}  area       combined street + locality (used on cards)
 * @property {string}  type       Flat | House | Apartment
 * @property {number}  beds
 * @property {number}  baths
 * @property {string}  size       e.g. "520 sq ft"
 * @property {string}  pcm        e.g. "£725 pcm"
 * @property {string}  status     tag, e.g. "To let" | "Let agreed"
 * @property {boolean} available
 * @property {string[]} images
 */

/** @type {TleProperty[]} */
export const PROPERTIES = [
  {
    slug: "garland",
    address: "Garland Road",
    locality: "Poole, BH15",
    area: "Garland Road, Poole, BH15",
    type: "Flat", beds: 1, baths: 1, size: "520 sq ft",
    pcm: "£725 pcm", status: "Let agreed", available: false,
    images: [
      `${GARLAND}/garland.jpg`,
      `${GARLAND}/garland%201.jpg`,
      `${GARLAND}/jpeg-optimizer-p1671_55c1-1f36-30ce-09f3-f5ea-1637-a546-628f_20260615020005.jpg`,
    ],
  },
  {
    slug: "glenfield",
    address: "Glenfield Road",
    locality: "Leicester, LE3",
    area: "Glenfield Road, Leicester, LE3",
    type: "Flat", beds: 1, baths: 1, size: "500 sq ft",
    pcm: "£715 pcm", status: "To let", available: true,
    images: [U("1568605114967-8130f3a36994"), U("1570129477492-45c003edd2be")],
  },
  {
    slug: "douglas",
    address: "Douglas Gardens Mews",
    locality: "Edinburgh, EH4",
    area: "Douglas Gardens Mews, Edinburgh, EH4",
    type: "House", beds: 3, baths: 2, size: "1,250 sq ft",
    pcm: "£2,600 pcm", status: "To let", available: true,
    images: [U("1580587771525-78b9dba3b914"), U("1576941089067-2de3c901e126")],
  },
  {
    slug: "chapter",
    address: "Chapter Road",
    locality: "London, NW2",
    area: "Chapter Road, London, NW2",
    type: "Flat", beds: 3, baths: 1, size: "1,050 sq ft",
    pcm: "£2,400 pcm", status: "To let", available: true,
    images: [U("1502672260266-1c1ef2d93688"), U("1493809842364-78817add7ffb")],
  },
  {
    slug: "mill-lane",
    address: "Mill Lane",
    locality: "Bristol, BS3",
    area: "Mill Lane, Bristol, BS3",
    type: "House", beds: 2, baths: 1, size: "820 sq ft",
    pcm: "£1,350 pcm", status: "To let", available: true,
    images: [U("1564013799919-ab600027ffc6"), U("1583608205776-bfd35f0d9f83")],
  },
  {
    slug: "queens-road",
    address: "Queens Road",
    locality: "Birmingham, B16",
    area: "Queens Road, Birmingham, B16",
    type: "Apartment", beds: 2, baths: 2, size: "740 sq ft",
    pcm: "£1,150 pcm", status: "To let", available: true,
    images: [U("1545324418-cc1a3fa10c00"), U("1502005229762-cf1b2da7c5d6")],
  },
  {
    slug: "park-view",
    address: "Park View",
    locality: "Milton Keynes, MK9",
    area: "Park View, Milton Keynes, MK9",
    type: "Flat", beds: 1, baths: 1, size: "560 sq ft",
    pcm: "£950 pcm", status: "To let", available: true,
    images: [U("1512918728675-ed5a9ecdebfd"), U("1484154218962-a197022b5858")],
  },
  {
    slug: "high-street",
    address: "High Street",
    locality: "Oxford, OX1",
    area: "High Street, Oxford, OX1",
    type: "House", beds: 4, baths: 2, size: "1,680 sq ft",
    pcm: "£2,950 pcm", status: "To let", available: true,
    images: [U("1599809275671-b5942cabc7a2"), U("1576013551627-0cc20b96c2a7")],
  },
];

export function getProperty(slug) {
  return PROPERTIES.find((p) => p.slug === slug);
}
