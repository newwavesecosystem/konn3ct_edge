import * as React from "react"
import { cn } from "../../lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false)

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted",
          className
        )}
        {...props}
      >
        {src && !imgError ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt || "Avatar"}
              className="aspect-square h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium text-sm">
            {fallback || alt?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"
