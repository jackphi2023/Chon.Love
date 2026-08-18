import type { CSSProperties } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

export type ChonVerificationIconType = 'selfie' | 'identity' | 'linkedin';

type Props = {
  type: ChonVerificationIconType;
  verified: boolean;
  /** Backward-compatible height alias. Width follows the icon's native ratio. */
  size?: number;
  height?: number;
  width?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
};

const VERIFIED_GREEN = '#10B940';
const UNVERIFIED_GRAY = '#858585';
const WHITE = '#FFFFFF';
const DEFAULT_ICON_HEIGHT = 28;

const ICON_ASPECT_RATIOS: Record<ChonVerificationIconType, number> = {
  selfie: 1,
  identity: 76 / 64,
  linkedin: 1,
};

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function checkBadge(color: string, cx = 50, cy = 50): string {
  return `
    <circle cx="${cx}" cy="${cy}" r="12" fill="${color}"/>
    <path d="M${cx - 6} ${cy + 0.5}l4 4 8-9" fill="none" stroke="${WHITE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function selfieSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="6" y="6" width="47" height="47" rx="9" fill="none" stroke="${color}" stroke-width="4"/>
      <path d="M13 20v-7h7M39 13h7v7M13 39v7h7" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 26c0-7 4.5-12 10-12s10 5 10 12v4c0 7.2-4.6 13-10 13s-10-5.8-10-13z" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M23 25c2-1 3.5-3 4.5-5 3 2.2 6.8 2.8 12 1.8" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="28" cy="29" r="1.8" fill="${color}"/>
      <circle cx="36" cy="29" r="1.8" fill="${color}"/>
      <path d="M28.5 35c2.3 2 4.7 2 7 0" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      ${checkBadge(color)}
    </svg>
  `;
}

function identitySvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 64">
      <rect x="4" y="11" width="58" height="38" rx="7" fill="none" stroke="${color}" stroke-width="4"/>
      <circle cx="20" cy="27" r="8" fill="none" stroke="${color}" stroke-width="3.5"/>
      <circle cx="20" cy="25" r="3" fill="none" stroke="${color}" stroke-width="2.7"/>
      <path d="M14.5 33c1.8-3.5 4-5 5.5-5s3.7 1.5 5.5 5" fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round"/>
      <path d="M34 23h19M34 31h15" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
      ${checkBadge(color, 64)}
    </svg>
  `;
}

function linkedinSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="7" width="44" height="44" rx="7" fill="none" stroke="${color}" stroke-width="4"/>
      <circle cx="22" cy="21" r="3.2" fill="${color}"/>
      <rect x="19" y="27" width="6" height="15" rx="1" fill="${color}"/>
      <path d="M30 27h5.7v2.2c1.5-1.8 3.7-2.8 6.2-2.8 5.2 0 7.1 3.2 7.1 8.3V42h-6v-6.5c0-2.7-.6-4.3-2.8-4.3-2.5 0-3.5 1.8-3.5 5V42H30z" fill="${color}"/>
      ${checkBadge(color)}
    </svg>
  `;
}

function iconUri(type: ChonVerificationIconType, verified: boolean): string {
  const color = verified ? VERIFIED_GREEN : UNVERIFIED_GRAY;
  const svg = type === 'selfie'
    ? selfieSvg(color)
    : type === 'identity'
      ? identitySvg(color)
      : linkedinSvg(color);
  return svgDataUri(svg);
}

export function ChonVerificationIcon({
  type,
  verified,
  size,
  height,
  width,
  style,
  testID,
}: Props) {
  const resolvedHeight = height ?? size ?? DEFAULT_ICON_HEIGHT;
  const resolvedWidth = width ?? resolvedHeight * ICON_ASPECT_RATIOS[type];
  const flattened = StyleSheet.flatten(style) as CSSProperties | undefined;

  return (
    <img
      alt=""
      aria-hidden="true"
      data-testid={testID}
      src={iconUri(type, verified)}
      style={{
        display: 'block',
        height: resolvedHeight,
        objectFit: 'contain',
        width: resolvedWidth,
        ...flattened,
      }}
    />
  );
}
