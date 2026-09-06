import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { REQUEST_ID_HEADER, requestIdFrom } from '@/lib/observability';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  // One id per request, honouring an upstream proxy's if it set one, so a page
  // load and the API calls it makes can be correlated in the platform log.
  // API routes are not matched here (see `config` below — matching them would
  // put a Supabase session lookup in front of every API call, including the
  // webhook and health endpoints); they take their id from the same helper
  // through withObservability.
  const requestId = requestIdFrom(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          // Rebuilt from requestHeaders, not request.headers, so a cookie
          // refresh does not drop the correlation id set above.
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set(REQUEST_ID_HEADER, requestId);
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set(REQUEST_ID_HEADER, requestId);
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // With no credentials every getUser() fails, so a protected route would
  // redirect to /login, which cannot sign anyone in either — a loop with no
  // explanation. Let it through instead; the page renders the setup notice.
  if (!isSupabaseConfigured) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/admin');

  if (isProtected && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', path);
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set(REQUEST_ID_HEADER, requestId);
    return redirect;
  }

  // Admin-only routes: verify role, not just login state.
  if (path.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const redirect = NextResponse.redirect(new URL('/dashboard', request.url));
      redirect.headers.set(REQUEST_ID_HEADER, requestId);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
