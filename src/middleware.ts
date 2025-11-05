import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

const SIGN_IN_PATH = '/auth/sign-in'
const PROTECTED_SEGMENTS = ['/admin', '/account', '/organization'] as const
const AUTH_SEGMENTS = ['/auth', '/api/auth'] as const

const shouldProtectPathname = (pathname: string) =>
  PROTECTED_SEGMENTS.some((segment) => pathname === segment || pathname.startsWith(`${segment}/`))

const isAuthPath = (pathname: string) =>
  AUTH_SEGMENTS.some((segment) => pathname === segment || pathname.startsWith(`${segment}/`))

const isSafeRedirect = (redirectPath: string) => {
  // Prevent redirect loops by disallowing redirects to:
  // 1. Protected routes (would redirect back to sign-in)
  // 2. Auth routes (would cause redirect loops)
  // 3. Error pages
  // 4. External URLs (open redirect vulnerability)
  if (!redirectPath || redirectPath === '/') {
    return true
  }

  // Prevent open redirect attacks - only allow relative paths
  if (
    redirectPath.startsWith('http://') ||
    redirectPath.startsWith('https://') ||
    redirectPath.startsWith('//')
  ) {
    return false
  }

  // Ensure it starts with / for safety
  if (!redirectPath.startsWith('/')) {
    return false
  }

  // Remove query params for pathname check
  const pathname = redirectPath.split('?')[0]

  return !shouldProtectPathname(pathname) && !isAuthPath(pathname) && !pathname.startsWith('/error')
}

const buildRedirectUrl = (req: NextRequest) => {
  const signInUrl = new URL(SIGN_IN_PATH, req.nextUrl.origin)
  const redirectTarget = `${req.nextUrl.pathname}${req.nextUrl.search}`

  // Only add redirect param if it's a safe redirect target
  if (redirectTarget && redirectTarget !== '/' && isSafeRedirect(redirectTarget)) {
    signInUrl.searchParams.set('redirect', redirectTarget)
  }

  return signInUrl
}

const middleware = (req: NextRequest): Response | void => {
  const sessionCookie = getSessionCookie(req)

  // /admin/login
  if (req.nextUrl.pathname === '/admin/login') {
    return NextResponse.redirect(buildRedirectUrl(req))
  }

  // /api/auth/error
  if (req.nextUrl.pathname === '/api/auth/error') {
    const code = req.nextUrl.searchParams.get('error') ?? ''
    const redirectParam = req.nextUrl.searchParams.get('redirect') ?? ''

    const newUrl = new URL('/error', req.nextUrl.origin)

    if (code) {
      newUrl.searchParams.set('code', code)
    }

    // Only pass through safe redirect params
    if (redirectParam && isSafeRedirect(redirectParam)) {
      newUrl.searchParams.set('redirect', redirectParam)
    }

    return NextResponse.redirect(newUrl)
  }

  if (!sessionCookie && shouldProtectPathname(req.nextUrl.pathname)) {
    return NextResponse.redirect(buildRedirectUrl(req))
  }

  return NextResponse.next()
}

export default middleware

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/organization/:path*', '/api/auth/error'],
}
