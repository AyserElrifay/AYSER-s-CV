import { NextResponse } from 'next/server';
import { LOCALE_COOKIE } from '@/server/locale';

/**
 * Switching language is a full document navigation, on purpose.
 *
 * Changing the locale changes `dir` on the root element, and patching that
 * during a client-side update races the content: for a frame or two the Arabic
 * text lays out left-to-right. Serving a fresh document means the direction is
 * correct from the first byte, which is the only way RTL is genuinely
 * first-class rather than mostly-first-class.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (locale !== 'en' && locale !== 'ar') {
    return NextResponse.json({ error: 'Unknown locale' }, { status: 404 });
  }

  const requested = new URL(request.url).searchParams.get('next') ?? '/app';
  // Same-origin paths only. `//evil.example` is a perfectly valid URL to a
  // browser, and `/\evil.example` is treated as one by some of them.
  const destination =
    requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/\\')
      ? requested
      : '/app';

  // A relative Location, not NextResponse.redirect. That helper resolves
  // against `request.url`, whose host is whatever the server sees internally —
  // "localhost" here, the upstream origin behind a proxy. Redirecting there
  // moves the browser to a different origin from the one this Set-Cookie
  // applies to, and the cookie is silently dropped. Relative is what keeps the
  // viewer where they already were.
  const response = new NextResponse(null, {
    status: 303,
    headers: { location: destination },
  });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}
