"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// A resilient image for external POI imagery and static maps. It renders through next/image (lazy,
// responsive, format-optimised, no layout shift because the parent reserves the box via `fill`), and
// on any load error falls back to a neutral placeholder tile, so a stale or protected Google URL
// never shows as a broken image. The caller supplies a positioned, sized container.
export function PlaceImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200", className)}
        aria-hidden="true"
      >
        <ImageOff className="h-6 w-6 text-gray-300" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "100vw"}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
