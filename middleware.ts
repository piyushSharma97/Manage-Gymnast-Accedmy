import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Next.js middleware for route protection and multi-tenant handling
 * This middleware runs in the Edge Runtime, so we use JWT tokens instead of sessions
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes that don't need protection
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/signin') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Handle role-based redirects for root path and role base paths
  if (pathname === '/' || pathname === '/manager' || pathname === '/admin'||pathname==='/coach'||pathname==='/parent') {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      
      if (token?.roleSlug) {
        const userRole = token.roleSlug as string;
        
        // Redirect /parent to /parent (layout/page will redirect to children or dashboard)
        if (pathname === '/parent') {
          return NextResponse.next();
        }
        // Redirect /manager to /manager/dashboard
        if (pathname === '/manager') {
          return NextResponse.redirect(new URL('/manager/dashboard', request.url));
        }
                // Redirect /coach to /coach/gymnast-management/students
        if (pathname === '/coach') {
          return NextResponse.redirect(new URL('/coach/gymnast-management/students', request.url));
        }
        // Redirect /admin to dashboard or to create location if academy has none
        if (pathname === '/admin') {
          const tenantHasLocations = token.tenantHasLocations !== false;
          if (token.roleSlug === 'admin' && !tenantHasLocations) {
            return NextResponse.redirect(new URL('/admin/location', request.url));
          }
          return NextResponse.redirect(new URL('/admin/dashboard/batch', request.url));
        }
        
        // Redirect root path based on role
        if (pathname === '/') {
          // Redirect parents to parent area (page will redirect to children or dashboard)
          if (userRole === 'parent' || userRole === 'guardian') {
            return NextResponse.redirect(new URL('/parent', request.url));
          }
          // Redirect managers to their dashboard
          if (userRole === 'manager') {
            return NextResponse.redirect(new URL('/manager/dashboard', request.url));
          }
          // Redirect admins to dashboard or to create location if academy has none
          if (userRole === 'admin') {
            const tenantHasLocations = token.tenantHasLocations !== false;
            if (!tenantHasLocations) {
              return NextResponse.redirect(new URL('/admin/location', request.url));
            }
            return NextResponse.redirect(new URL('/admin/dashboard/batch', request.url));
          }
              // Redirect coaches to students page
          if (userRole === 'coach') {
            return NextResponse.redirect(new URL('/coach/gymnast-management/students', request.url));
          }
          // Redirect owners to their page
          if (userRole === 'owner') {
            return NextResponse.redirect(new URL('/owner', request.url));
          }
        }
      } else {
        // If not authenticated and trying to access role base paths, redirect to signin
        if (pathname === '/manager' || pathname === '/admin' || pathname === '/parent') {
          return NextResponse.redirect(new URL('/signin', request.url));
        }
      }
    } catch (error) {
      console.error('Middleware error checking root redirect:', error);
    }
  }

  // Check if route requires protection based on path patterns
  const requiresAuth = isProtectedRoute(pathname);
  // console.log(`Middleware: ${pathname} requiresAuth=${requiresAuth}`);
  if (!requiresAuth) {
    // No protection required
    return NextResponse.next();
  }
  //  console.log('Middleware protecting route:', pathname);

  try {
    // Get token from request (works in Edge Runtime)
    // Use cache to avoid repeated token verification for same request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
// console.log('Middleware token:', token);
    if (!token) {
      // Redirect to signin for protected routes
      if (pathname.startsWith('/owner/') || 
          pathname.startsWith('/admin/') || 
          pathname.startsWith('/manager/')||
          pathname.startsWith('/coach/') ||
          pathname.startsWith('/parent/')) {
        return NextResponse.redirect(new URL('/signin', request.url));
      }
      return NextResponse.next();
    }

    // Check role-based access
    const userRole = token.roleSlug as string;
    const hasAccess = checkRoleAccess(pathname, userRole);
    // console.log(`Middleware access check: role=${userRole}, hasAccess=${hasAccess}`);
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Academy admin must have at least one location before accessing any admin page other than /admin/location
    if (
      userRole === 'admin' &&
      pathname.startsWith('/admin/') &&
      !pathname.startsWith('/admin/location') &&
      token.tenantHasLocations === false
    ) {
      return NextResponse.redirect(new URL('/admin/location', request.url));
    }

    // Add user context to headers for API routes
    const response = NextResponse.next();
    response.headers.set('x-user-id', token.id as string);
    response.headers.set('x-user-role', userRole);
    response.headers.set('x-tenant-id', token.tenantId?.toString() || '');
    response.headers.set('x-location-id', token.locationId?.toString() || '');
    
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

/**
 * Check if a route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/owner/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/manager/') ||
    pathname.startsWith('/coach/') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/api/owner/') ||
    pathname.startsWith('/api/user-management/') ||
    pathname.startsWith('/api/dashboard/') ||
    pathname.startsWith('/api/gymnast-management/') ||
    pathname.startsWith('/api/event-management/') ||
    pathname.startsWith('/api/skills-assessment/') ||
    pathname.startsWith('/api/fitness-assessment/') ||
    pathname.startsWith('/api/parent/') ||
    pathname.startsWith('/api/feedback') ||
    pathname === '/api/me' ||
    pathname.startsWith('/api/me/')
  );
}

/**
 * Check if user role has access to the route
 */
function checkRoleAccess(pathname: string, userRole: string): boolean {
  // Owner can access everything
  if (userRole === 'owner') return true;

  // Authenticated user's own profile API (all tenant roles)
  if (pathname === '/api/me' || pathname.startsWith('/api/me/')) {
    return true;
  }

  // Admin can access admin and manager routes, but not owner pages or owner APIs
  if (userRole === 'admin') {
    return (
      !pathname.startsWith('/owner/') &&
      !pathname.startsWith('/api/owner/')
    );
  }

  // Manager can access manager routes and APIs used by manager UI (skills-assessment, event-management, skill-level)
  if (userRole === 'manager') {
    return (
      pathname.startsWith('/manager/') ||
      pathname.startsWith('/api/event-management/') ||
      pathname.startsWith('/api/skills-assessment/') ||
      pathname.startsWith('/api/fitness-assessment/') ||
      pathname.startsWith('/api/skill-level/') ||
      pathname.startsWith('/api/feedback')
    );
  }
  // Coach can access coach pages and APIs used by coach UI (e.g. skills-assessment, event-management, skill-level)
  if (userRole === 'coach') {
    return (
      pathname.startsWith('/coach/') ||
      pathname.startsWith('/api/event-management/') ||
      pathname.startsWith('/api/skills-assessment/') ||
      pathname.startsWith('/api/fitness-assessment/') ||
      pathname.startsWith('/api/skill-level/') ||
      pathname.startsWith('/api/feedback')
    );
  }
  // Parent/guardian can access parent pages and parent API only
  if (userRole === 'parent' || userRole === 'guardian') {
    return (
      pathname.startsWith('/parent') ||
      pathname.startsWith('/api/parent/') ||
      pathname.startsWith('/api/feedback')
    );
  }
  return false;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
