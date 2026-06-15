import type { ReactNode } from "react";

// The Places layout renders the explorer (children) plus the @modal parallel slot. The slot is empty
// (its default returns null) until an intercepted place route fills it with the slide-over. Props are
// typed explicitly (children plus the modal slot) rather than via Next's generated LayoutProps, so
// typecheck never depends on the generated route types existing: in CI, typecheck runs before the
// build that would generate them, which is why the generated global was not found there.
export default function PlacesLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
