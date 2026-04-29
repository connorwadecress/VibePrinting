import Link from "next/link";

/**
 * Mobile-friendly back link rendered as a chip-shaped button. Tap target
 * is at least 40px tall on mobile so it's easy to hit, with a clear
 * arrow icon and the destination label in a readable size.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-muted transition-colors " +
        "hover:border-border-strong hover:bg-surface-2 hover:text-fg " +
        "sm:min-h-0 sm:bg-transparent sm:px-2 sm:py-1 sm:text-xs sm:hover:bg-surface-2"
      }
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10 4L6 8l4 4" />
      </svg>
      <span>{children}</span>
    </Link>
  );
}
