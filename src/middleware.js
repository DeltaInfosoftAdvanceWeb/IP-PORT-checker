import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = ['/login', '/api/login',"/signup"];

async function verifyToken(token) {
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET));
    return true;
  } catch (err) {
    console.error("Token verification failed:", err);
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("authToken")?.value;

  

  if (PUBLIC_ROUTES.includes(pathname)) {
    if (pathname === '/login' && token && await verifyToken(token)) {

      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (token && await verifyToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  if (!token) {
    return NextResponse.redirect(loginUrl);
  }

  loginUrl.searchParams.set('from', pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("authToken");

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/api/login",
  ],
};