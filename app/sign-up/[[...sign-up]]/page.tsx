import { SignUp } from "@clerk/nextjs";

// Clerk's drop-in sign-up form, mirroring the sign-in route. The catch-all segment lets Clerk own
// its verification sub-routes under this path.
export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <SignUp />
    </div>
  );
}
