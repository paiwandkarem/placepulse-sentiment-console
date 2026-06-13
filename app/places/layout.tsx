// The Places layout renders the explorer (children) plus the @modal parallel slot. The slot is empty
// (its default returns null) until an intercepted place route fills it with the slide-over. The props
// type is the generated LayoutProps, which knows about the modal slot.
export default function PlacesLayout({ children, modal }: LayoutProps<"/places">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
