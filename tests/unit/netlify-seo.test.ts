import { afterEach, describe, expect, it, vi } from 'vitest';
import seo from '../../netlify/edge-functions/seo';

afterEach(() => vi.unstubAllGlobals());
const html = '<html><head><title>Old</title><meta property="og:image" content="old"><link rel="canonical" href="https://www.chon.love/"></head><body>App</body></html>';
const context = () => ({ next: async () => new Response(html, { headers: { 'content-type': 'text/html', 'content-length': String(html.length) } }) });

describe('Netlify SEO response', () => {
  it('serves one canonical on the live primary domain and the true thumbnail dimensions', async () => {
    const response = await seo(new Request('https://chon.love/?utm_source=fixture'), context());
    const output = await response.text();
    expect(response.status).toBe(200);
    expect(output).toContain('<link rel="canonical" href="https://chon.love/">');
    expect(output.match(/rel="canonical"/gu)).toHaveLength(1);
    expect(output.match(/property="og:image"/gu)).toHaveLength(1);
    expect(output).toContain('https://chon.love/seo/chonlove-homepage-thumbnail.jpg');
    expect(output).toContain('property="og:image:width" content="480"');
    expect(output).toContain('property="og:image:height" content="360"');
    expect(output).not.toContain('www.chon.love');
    expect(output).not.toContain('utm_source');
    expect(response.headers.has('content-length')).toBe(false);
  });

  it('uses a matching member avatar and escapes member-controlled metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ public_profile_code: 'abc123', display_name: '<Member "Test">', avatar_url: 'https://media.example/approved.jpg' })));
    const response = await seo(new Request('https://chon.love/thanh-vien/id-abc123'), context());
    const output = await response.text();
    expect(output).toContain('https://chon.love/thanh-vien/id-abc123');
    expect(output).toContain('https://media.example/approved.jpg');
    expect(output).toContain('&lt;Member &quot;Test&quot;&gt;');
    expect(output).not.toContain('chonlove-homepage-thumbnail.jpg');
  });

  it('redirects a member without an approved avatar before rendering public metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ public_profile_code: 'abc123', display_name: 'Member', avatar_url: null })));
    const next = vi.fn();
    const response = await seo(new Request('https://chon.love/thanh-vien/id-abc123'), { next });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://chon.love/');
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps legacy username routes non-public', async () => {
    const response = await seo(new Request('https://chon.love/profile/private-username'), context());
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://chon.love/');
  });

  it('preserves non-HTML response bodies and headers', async () => {
    const nextResponse = new Response('plain response', { headers: { 'content-type': 'text/plain' } });
    const response = await seo(new Request('https://chon.love/'), { next: async () => nextResponse });
    expect(response).toBe(nextResponse);
    expect(await response.text()).toBe('plain response');
  });
});
