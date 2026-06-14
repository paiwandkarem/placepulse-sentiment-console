import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 renamed the middleware convention to `proxy` (Node.js runtime only, which suits this
// app's Fluid Compute posture). Clerk's request handler runs here on every matched request: it
// protects everything except the public auth pages, so an unauthenticated visitor is redirected
// to sign-in before any data route or Server Component runs. The API routes add their own 401
// guard on top (defence in depth) so a missing session fails closed there too.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static files (so auth never blocks CSS, JS or
    // images), then always run on API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
