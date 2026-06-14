import { SignIn } from "@clerk/nextjs";

// Clerk's drop-in sign-in form, rendered without the app shell (AppShell skips its chrome on the
// auth routes). The optional catch-all segment lets Clerk own its own sub-routes (verification,
// SSO callbacks) under this path.
export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <SignIn />
    </div>
  );
}
