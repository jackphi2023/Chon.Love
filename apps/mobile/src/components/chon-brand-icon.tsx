import { Image, type ImageStyle, type StyleProp } from 'react-native';

export type ChonBrandIconName =
  | 'connection'
  | 'favorite'
  | 'message'
  | 'gift'
  | 'profile'
  | 'location'
  | 'recent'
  | 'avatar';

type ChonBrandIconProps = {
  name: ChonBrandIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

const GOLD_LIGHT = '#FFD34D';
const GOLD = '#F5B400';
const GOLD_DARK = '#D79200';

function svg(body: string, filled = false): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="gold" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${GOLD_LIGHT}"/>
        <stop offset="0.42" stop-color="${GOLD}"/>
        <stop offset="1" stop-color="${GOLD_DARK}"/>
      </linearGradient>
    </defs>
    <g fill="${filled ? 'url(#gold)' : 'none'}" stroke="url(#gold)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

const ICONS: Record<ChonBrandIconName, string> = {
  connection: svg(`
    <circle cx="9.1" cy="9.2" r="6.2"/>
    <path d="m13.7 13.8 4.5 4.5"/>
    <circle cx="7.2" cy="7.5" r="1.35"/>
    <circle cx="10.6" cy="7.5" r="1.35"/>
    <path d="M5.35 11.9c.35-1.55 1.15-2.35 1.85-2.35.75 0 1.45.75 1.75 2.35M8.95 11.9c.3-1.55 1.05-2.35 1.7-2.35.7 0 1.45.8 1.8 2.35"/>
  `),
  favorite: svg(`
    <path d="M12 20.3 4.5 13C1.1 9.7 3 4.2 7.2 4.2c2.05 0 3.45 1.15 4.8 2.8 1.35-1.65 2.75-2.8 4.8-2.8 4.2 0 6.1 5.5 2.7 8.8L12 20.3Z"/>
  `),
  message: svg(`
    <path d="M3.2 5.3h11.2a4 4 0 0 1 4 4v2.8a4 4 0 0 1-4 4H9.1l-4.3 3v-3.45a4 4 0 0 1-1.6-3.2V9.3a4 4 0 0 1 4-4Z"/>
    <path d="M8 9.3h5.8M8 12.3h4.1"/>
    <path d="M18.1 9.1a3.65 3.65 0 0 1 2.7 3.55v2.1c0 1.15-.55 2.2-1.45 2.85v2.25l-2.8-1.95h-3.1"/>
  `),
  gift: svg(`
    <path d="M3.2 9.4h13.7v10.2H3.2zM2.4 6.3h15.3v3.2H2.4zM9.9 6.3v13.3"/>
    <path d="M9.9 6.2C8.4 3.7 6.9 2.8 5.7 3.5c-1.2.7-.8 2.6.6 3.1 1.1.4 2.4.15 3.6-.4ZM10.1 6.2c1.5-2.5 3-3.4 4.2-2.7 1.2.7.8 2.6-.6 3.1-1.1.4-2.4.15-3.6-.4Z"/>
    <path d="M18.2 12.4h3.4v8.1h-5.2v-6.3M17.5 14.8l.65.65 1.15-1.25M17.5 17.4l.65.65 1.15-1.25"/>
  `),
  profile: svg(`
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="9" r="2.7"/>
    <path d="M6.8 18c.7-3 2.55-4.55 5.2-4.55S16.5 15 17.2 18"/>
  `),
  location: svg(`
    <path d="M12 21c4.2-4.65 6.25-8.2 6.25-11.1A6.25 6.25 0 0 0 5.75 9.9C5.75 12.8 7.8 16.35 12 21Z"/>
    <path d="M12 13.4 9.6 11.1c-1.2-1.15-.45-3.15 1.05-3.15.65 0 1.05.35 1.35.8.3-.45.7-.8 1.35-.8 1.5 0 2.25 2 1.05 3.15L12 13.4Z"/>
    <path d="M7.8 21h8.4"/>
  `),
  recent: svg(`
    <circle cx="11.3" cy="12" r="7.1"/>
    <path d="M11.3 7.9v4.25l2.75 2.15M18 5.4h2.5v2.5M20.5 5.4l-2.3 2.3M18.4 17.4a8.9 8.9 0 0 1-3.2 2.65M19.9 12a8.7 8.7 0 0 1-.45 2.75"/>
  `),
  avatar: svg(`
    <circle cx="12" cy="12" r="10" fill="none"/>
    <circle cx="12" cy="8.6" r="3.1" stroke="none"/>
    <path d="M5.5 19.1c.8-4.1 3-6.05 6.5-6.05s5.7 1.95 6.5 6.05c-1.8 1.8-4 2.7-6.5 2.7s-4.7-.9-6.5-2.7Z" stroke="none"/>
  `, true),
};

export function ChonBrandIcon({ name, size = 18, style }: ChonBrandIconProps) {
  return (
    <Image
      accessibilityElementsHidden
      accessible={false}
      resizeMode="contain"
      source={{ uri: ICONS[name] }}
      style={[{ height: size, width: size }, style]}
    />
  );
}
