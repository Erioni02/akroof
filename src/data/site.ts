export const site = {
  name: 'AK Roofing & Gutters',
  shortName: 'AK',
  descriptor: 'Roofing, gutters and exterior contractor',
  city: 'Oakbrook Terrace',
  state: 'Illinois',
  stateAbbr: 'IL',
  license: '104-019993',
  address: {
    street: '17W300 22nd St',
    locality: 'Oakbrook Terrace, IL 60181',
  },
  phone: '(708) 575-4500',
  phoneHref: 'tel:+17085754500',
  hours: 'Monday – Saturday · 7:00 AM – 6:00 PM',
  quoteUrl:
    'https://app.gethearth.com/requests/32511b49-083b-4c6b-8e3a-24cbcaa58857',
  financingUrl:
    'https://app.gethearth.com/financing/52968/93476/prequalify?utm_campaign=52968&utm_content=white&utm_medium=contractor-website&utm_source=contractor&utm_term=93476',
  social: {
    facebook: 'https://www.facebook.com/akroofingandgutters',
    instagram: 'https://www.instagram.com/ak_roofing_gutters/',
    linkedin: 'https://www.linkedin.com/company/ak-roofing-and-gutters/',
  },
} as const

export const services = [
  { n: '01', name: 'Roofing' },
  { n: '02', name: 'Gutters' },
  { n: '03', name: 'Soffit & Fascia' },
  { n: '04', name: 'Siding' },
  { n: '05', name: 'Skylight' },
  { n: '06', name: 'Windows' },
] as const

export const standards = [
  'Licensed',
  'Insured',
  'Bonded',
  '100% Guarantee',
  'BBB A+ Rated',
] as const

/**
 * Manufacturer credentials.
 *
 * `scale` is optical, not mathematical: a square badge set to the same height
 * as a wide wordmark reads as far bigger than it is, so each mark is sized by
 * eye against the others rather than by its bounding box.
 *
 * The Mule-Hide and Brava files are reverse (knockout) versions — their
 * wordmarks are near-black in the originals and would be invisible here. Only
 * the dark neutral pixels were lifted; every brand colour is untouched.
 */
export const credentials = [
  {
    name: 'ShingleMaster',
    qualifier: 'Premier Credentialed',
    src: '/credentials/shinglemaster.png',
    scale: 1.4,
  },
  {
    name: 'Mule-Hide',
    qualifier: 'Certified',
    src: '/credentials/mule-hide.png',
    scale: 0.82,
  },
  {
    name: 'DaVinci Roofscapes',
    qualifier: 'Authorized & Certified',
    src: '/credentials/davinci.png',
    scale: 1.1,
  },
  {
    name: 'Brava',
    qualifier: 'Authorized & Certified',
    src: '/credentials/brava.png',
    scale: 0.95,
  },
] as const

/** The two marks that speak for the company itself rather than a manufacturer. */
export const seals = [
  {
    name: 'Licensed, insured and bonded — 100% guarantee',
    src: '/credentials/guarantee.png',
    scale: 1.15,
  },
  {
    name: 'BBB A+ rated, accredited business',
    src: '/credentials/bbb-a-plus.png',
    scale: 0.9,
  },
] as const

/** Google Maps place listing for the Oakbrook Terrace office. */
export const map = {
  href: 'https://www.google.com/maps/place/AK+Roofing+%26+Gutters/@41.8469758,-87.9657545,17z/data=!3m1!1e3!4m6!3m5!1s0x8aa436689fd43e47:0x9d35a470428a09c0!8m2!3d41.8469758!4d-87.9657545!16s%2Fg%2F11v0r5s6dq',
  embed:
    'https://www.google.com/maps?q=AK+Roofing+%26+Gutters,+17W300+22nd+St,+Oakbrook+Terrace,+IL+60181&z=15&output=embed',
} as const
