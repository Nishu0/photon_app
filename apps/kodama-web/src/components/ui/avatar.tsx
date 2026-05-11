import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  className,
  src,
  alt,
  fallback,
}: {
  className?: string;
  src?: string | null;
  alt?: string;
  fallback: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? fallback} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center uppercase">
          {fallback}
        </span>
      )}
    </span>
  );
}
