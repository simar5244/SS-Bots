import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Since we're using localStorage for tokens (client-side), 
  // we can't check auth in middleware (server-side)
  // Auth checks are done in the page components instead
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
