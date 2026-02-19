import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow access to public routes
  if (pathname.startsWith('/login') || 
      pathname.startsWith('/signup') || 
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/public')) {
    return NextResponse.next()
  }
  
  // Check if this is an API route or a page route
  const isApiRoute = pathname.startsWith('/api/')
  
  // Protect dashboard and authenticated API routes
  if (pathname.startsWith('/dashboard') || isApiRoute) {
    // Try to get token from cookie first (more secure for SSR)
    let token = request.cookies.get('auth-token')?.value
    
    // Fallback to Authorization header (for API calls)
    if (!token) {
      const authHeader = request.headers.get('authorization')
      token = authHeader?.replace('Bearer ', '')
    }
    
    if (!token) {
      // No token found
      if (isApiRoute) {
        // Return 401 for API routes
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        )
      } else {
        // Redirect to login for page routes
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
    
    try {
      // Verify the JWT token using jose (Edge Runtime compatible)
      const { payload } = await jwtVerify(token, JWT_SECRET)
      return NextResponse.next()
    } catch (error) {
      // Invalid token
      if (isApiRoute) {
        // Return 401 for API routes
        return NextResponse.json(
          { error: 'Unauthorized - Invalid or expired token' },
          { status: 401 }
        )
      } else {
        // Redirect to login for page routes
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        loginUrl.searchParams.set('error', 'session-expired')
        return NextResponse.redirect(loginUrl)
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|api/public|login|signup|_next/static|_next/image|favicon.ico).*)',
  ],
}
