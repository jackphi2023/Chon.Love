export type ChonBrandIconName =
  | 'connect'
  | 'favorite'
  | 'message'
  | 'gift'
  | 'profile'
  | 'location'
  | 'recent';

const GOLD = '#F2B51D';
const GOLD_DARK = '#D79B00';

function svgUri(body: string, viewBox = '0 0 48 48'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const stroke = `stroke="${GOLD_DARK}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"`;

export const CHON_BRAND_ICON_URIS: Record<ChonBrandIconName, string> = {
  connect: svgUri(`
    <circle cx="20" cy="20" r="13.5" ${stroke}/>
    <path d="M29.5 29.5 40 40" ${stroke}/>
    <circle cx="15.5" cy="16" r="3.2" ${stroke}/>
    <path d="M10.8 24.1c.8-3.4 2.5-5.1 4.7-5.1s3.9 1.7 4.7 5.1" ${stroke}/>
    <circle cx="24.5" cy="16" r="3.2" ${stroke}/>
    <path d="M19.8 24.1c.8-3.4 2.5-5.1 4.7-5.1s3.9 1.7 4.7 5.1" ${stroke}/>
  `),
  favorite: svgUri(`
    <path d="M24 40.1 7.8 24.4C2 18.8 5.5 8.9 14.2 8.9c4.2 0 7.3 2.4 9.8 5.5 2.5-3.1 5.6-5.5 9.8-5.5 8.7 0 12.2 9.9 6.4 15.5L24 40.1Z" ${stroke}/>
  `),
  message: svgUri(`
    <path d="M6.5 9.5h25c4 0 7 3 7 7v9c0 4-3 7-7 7H17l-7.8 6.2 1.5-6.2H6.5c-4 0-7-3-7-7v-9c0-4 3-7 7-7Z" ${stroke} transform="translate(2 0)"/>
    <path d="M18 35.2h12.6l7 5.3-1.2-5.3h1.1c3.6 0 6.5-2.9 6.5-6.5v-7.2c0-3-2-5.5-4.8-6.3" ${stroke}/>
    <path d="M14 19.6h16M14 24.6h12" ${stroke}/>
  `),
  gift: svgUri(`
    <rect x="6" y="18" width="29" height="20" rx="1.8" ${stroke}/>
    <path d="M4.5 18h32v-6.2H4.5V18ZM20.5 11.8V38" ${stroke}/>
    <path d="M20.5 11.8c-2.3-5.5-6.1-8.2-9-6.2-2.8 1.9-.7 6.2 2.4 6.2h6.6ZM20.5 11.8c2.3-5.5 6.1-8.2 9-6.2 2.8 1.9.7 6.2-2.4 6.2h-6.6Z" ${stroke}/>
    <rect x="31" y="24" width="13" height="18" rx="1.8" fill="#fff" ${stroke}/>
    <path d="m34.2 29.5 1.7 1.7 3-3M34.2 34.5l1.7 1.7 3-3" ${stroke}/>
  `),
  profile: svgUri(`
    <circle cx="24" cy="24" r="19" ${stroke}/>
    <circle cx="24" cy="18" r="6.2" ${stroke}/>
    <path d="M12.5 38c1.7-7 5.6-10.5 11.5-10.5S33.8 31 35.5 38" ${stroke}/>
  `),
  location: svgUri(`
    <path d="M24 42c8-9.1 13-15.2 13-22A13 13 0 1 0 11 20c0 6.8 5 12.9 13 22Z" ${stroke}/>
    <path d="M24 27.1c-5-3.3-7.1-5.7-7.1-8.4 0-2.5 1.8-4.3 4.1-4.3 1.4 0 2.4.7 3 1.7.6-1 1.6-1.7 3-1.7 2.3 0 4.1 1.8 4.1 4.3 0 2.7-2.1 5.1-7.1 8.4Z" ${stroke}/>
    <ellipse cx="24" cy="44" rx="10" ry="2.2" ${stroke}/>
  `),
  recent: svgUri(`
    <path d="M39 17A16.5 16.5 0 1 0 37 34" ${stroke}/>
    <path d="m39 9 .2 8-7.8-.2" ${stroke}/>
    <circle cx="22.5" cy="24" r="9.2" ${stroke}/>
    <path d="M22.5 18.7V24l4.4 3.4" ${stroke}/>
  `),
};

export const CHON_USER_AVATAR_URI = svgUri(`
  <circle cx="24" cy="24" r="20" fill="#FFFDF7" stroke="${GOLD_DARK}" stroke-width="2.2"/>
  <circle cx="24" cy="18" r="6.6" fill="${GOLD}"/>
  <path d="M11.8 40c1.9-8 6-12 12.2-12s10.3 4 12.2 12" fill="${GOLD}"/>
`);