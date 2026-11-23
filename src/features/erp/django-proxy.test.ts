import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(),
  getRequest: () => new Request('https://erp.example.test/auth'),
  setResponseHeader: vi.fn(),
}));

import { djangoRequest } from './django.server';

afterEach(() => vi.unstubAllGlobals());

describe('Django transport boundary', () => {
  it('does not follow redirects that could forward credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', {
      status: 302, headers: { Location: 'https://another.example.test/' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(djangoRequest('auth/token/', { method: 'POST', body: '{}' }, false))
      .rejects.toMatchObject({ status: 302 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('returns service-unavailable rather than a raw fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(djangoRequest('auth/token/', { method: 'POST', body: '{}' }, false))
      .rejects.toMatchObject({ status: 503 });
  });
});