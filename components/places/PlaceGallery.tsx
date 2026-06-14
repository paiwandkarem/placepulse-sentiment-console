"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { PlaceImage } from "@/components/ui/PlaceImage";
import { cn } from "@/lib/ui/sentiment";

// A click-to-maximise gallery for a place's imagery. The provider holds the ordered image list and a
// single lightbox; any GalleryImage rendered inside it becomes a button that opens the lightbox at
// its own position, so the hero photo and the photo strip drive one shared, browsable viewer. The
// lightbox supports prev/next, the arrow keys and Escape, and closes on a backdrop click.

type GalleryContextValue = {
  images: string[];
  openAt: (src: string) => void;
};

const GalleryContext = createContext<GalleryContextValue | null>(null);

export function PlaceGalleryProvider({
  images,
  name,
  children,
}: {
  images: string[];
  name: string;
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const isOpen = index !== null;

  const openAt = useCallback(
    (src: string) => {
      const at = images.indexOf(src);
      if (at >= 0) setIndex(at);
    },
    [images],
  );

  const close = useCallback(() => setIndex(null), []);
  const next = useCallback(
    () => setIndex((value) => (value === null ? value : (value + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () => setIndex((value) => (value === null ? value : (value - 1 + images.length) % images.length)),
    [images.length],
  );

  // While the lightbox is open, the arrow keys page through it, Escape closes it, and the page
  // behind it is scroll-locked so a swipe moves the photo, not the document.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, next, prev]);

  return (
    <GalleryContext.Provider value={{ images, openAt }}>
      {children}
      {isOpen && index !== null && (
        <Lightbox
          src={images[index]}
          alt={`${name} photo ${index + 1} of ${images.length}`}
          index={index}
          total={images.length}
          onClose={close}
          onNext={next}
          onPrev={prev}
        />
      )}
    </GalleryContext.Provider>
  );
}

// A thumbnail that opens the shared lightbox at its own image. It fills the positioned container the
// caller provides (the same contract as PlaceImage). A missing or unlisted image is not clickable
// and falls back to the plain tile, so the broken-image and no-image cases stay graceful.
export function GalleryImage({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  const ctx = useContext(GalleryContext);
  const clickable = Boolean(src) && Boolean(ctx) && ctx!.images.includes(src as string);

  if (!clickable) {
    return <PlaceImage src={src} alt={alt} sizes={sizes} priority={priority} />;
  }

  return (
    <button
      type="button"
      onClick={() => ctx!.openAt(src as string)}
      aria-label={`Open ${alt} full size`}
      className="group absolute inset-0 cursor-zoom-in"
    >
      <PlaceImage
        src={src}
        alt={alt}
        sizes={sizes}
        priority={priority}
        className="transition-transform duration-200 group-hover:scale-105"
      />
    </button>
  );
}

function Lightbox({
  src,
  alt,
  index,
  total,
  onClose,
  onNext,
  onPrev,
}: {
  src: string;
  alt: string;
  index: number;
  total: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  // Track which src failed rather than a boolean, so moving to another image derives a fresh state
  // with no effect: one broken photo never blanks out the rest of the gallery.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  const hasMany = total > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        autoFocus
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close image viewer"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {hasMany && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPrev();
          }}
          aria-label="Previous image"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:left-6"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <div className="relative h-[82vh] w-[90vw] max-w-5xl" onClick={(event) => event.stopPropagation()}>
        {failed ? (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/5 text-white/60">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="90vw"
            className="object-contain"
            onError={() => setFailedSrc(src)}
          />
        )}
      </div>

      {hasMany && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          aria-label="Next image"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:right-6"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {hasMany && (
        <p className={cn("absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white")}>
          {index + 1} / {total}
        </p>
      )}
    </div>
  );
}
