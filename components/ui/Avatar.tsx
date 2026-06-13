"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/ui/sentiment";

// A small reviewer avatar that falls back to the person's initial when there is no photo or the
// image fails to load. Size is set by the caller via className (e.g. "h-7 w-7").
export function Avatar({ src, name, className }: { src?: string | null; name?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500",
          className,
        )}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-full bg-gray-100", className)}>
      <Image
        src={src}
        alt={name ? `${name}'s avatar` : "Reviewer avatar"}
        fill
        sizes="32px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
