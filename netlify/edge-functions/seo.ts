const DESCRIPTION = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';
const TITLE_SUFFIX = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const PRODUCTION_ORIGIN = 'https://www.chon.love';
const PROFILE_SEO_ENDPOINT = 'https://asnydvqsduonyidjyyzq.supabase.co/functions/v1/public-profile-seo';
const STATIC_SOCIAL_IMAGE = `${PRODUCTION_ORIGIN}/seo/chonlove-homepage-thumbnail.jpg`;

export const config = {
  path: ['/', '/auth', '/auth/*', '/legal/*', '/thanh-vien/*', '/profile/*'],
  // SEO is progressive enhancement. A metadata/middleware failure must never
  // replace the customer-facing Chọn.Love app with Netlify's generic error page.
  onError: 'bypass',
};

type SeoMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  type: 'website' | 'profile';
  imageWidth?: number;
  imageHeight?: number;
};

type PublicProfileSeo = {
  public_profile_code?: string;
  display_name?: string;
  avatar_url?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function staticPageName(url: URL): string {
  if (url.pathname === '/') return 'Trang chủ';
  if (url.pathname === '/auth') return url.searchParams.get('mode') === 'login' ? 'Đăng nhập' : 'Đăng ký';
  if (url.pathname === '/auth/forgot-password') return 'Quên mật khẩu';
  if (url.pathname === '/auth/reset-password') return 'Đặt lại mật khẩu';
  if (url.pathname === '/auth/callback') return 'Xác thực tài khoản';
  if (url.pathname === '/legal/terms') return 'Điều khoản';
  if (url.pathname === '/legal/community-standards') return 'Tiêu chuẩn cộng đồng';
  return 'Chọn.love';
}

async function getSeoMetadata(url: URL): Promise<SeoMetadata | null> {
  const profileMatch = /^\/thanh-vien\/id-([0-9a-f]{6})\/?$/u.exec(url.pathname.toLowerCase());
  if (url.pathname.startsWith('/thanh-vien/')) {
    if (!profileMatch) return null;
    const code = profileMatch[1];
    const metadataResponse = await fetch(`${PROFILE_SEO_ENDPOINT}?code=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!metadataResponse.ok) return null;
    const profile = await metadataResponse.json() as PublicProfileSeo;
    if (profile.public_profile_code !== code || !profile.display_name || !profile.avatar_url) return null;
    return {
      title: `Thành viên ${profile.display_name} | ${TITLE_SUFFIX}`,
      description: DESCRIPTION,
      canonicalUrl: `${PRODUCTION_ORIGIN}/thanh-vien/id-${code}`,
      imageUrl: profile.avatar_url,
      type: 'profile',
    };
  }

  return {
    title: `${staticPageName(url)} | ${TITLE_SUFFIX}`,
    description: DESCRIPTION,
    canonicalUrl: `${PRODUCTION_ORIGIN}${url.pathname}`,
    imageUrl: STATIC_SOCIAL_IMAGE,
    type: 'website',
    imageWidth: 480,
    imageHeight: 360,
  };
}

function injectSeo(html: string, metadata: SeoMetadata): string {
  const metaKeys = [
    'description',
    'og:site_name',
    'og:type',
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
  ].join('|');
  // ':' is a literal character in JavaScript regular expressions and must not
  // be escaped under Unicode mode. `\:` with the `u` flag throws SyntaxError at
  // runtime and previously crashed every Netlify Edge SEO invocation.
  const metaPattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["'](?:${metaKeys})["'][^>]*>`, 'giu');
  let cleaned = html
    .replace(metaPattern, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/iu, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/giu, '');

  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}">`,
    '<meta property="og:site_name" content="Chọn.love">',
    `<meta property="og:type" content="${metadata.type}">`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(metadata.imageUrl)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(metadata.title)}">`,
    metadata.imageWidth ? `<meta property="og:image:width" content="${metadata.imageWidth}">` : '',
    metadata.imageHeight ? `<meta property="og:image:height" content="${metadata.imageHeight}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(metadata.imageUrl)}">`,
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">`,
  ].filter(Boolean).join('');

  cleaned = cleaned.replace(/<head(\s[^>]*)?>/iu, (head) => `${head}${tags}`);
  return cleaned;
}

export default async function seo(request: Request, context: { next: () => Promise<Response> }) {
  const url = new URL(request.url);

  // Old username-based profile links are intentionally non-public. Existing
  // in-app navigation canonicalizes them client-side for signed-in members.
  if (url.pathname.startsWith('/profile/')) return Response.redirect(new URL('/', url), 302);

  const metadata = await getSeoMetadata(url);
  if (!metadata) return Response.redirect(new URL('/', url), 302);

  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = injectSeo(await response.text(), metadata);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('X-Robots-Tag', 'index, follow');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
