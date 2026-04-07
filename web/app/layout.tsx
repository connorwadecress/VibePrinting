import type { Metadata } from "next";
import "../styles/globals.css";

/**
 * Root HTML shell. Individual layouts (e.g. app/(app)/layout.tsx)
 * decide whether to render the sidebar nav. Keeping the root layout
 * thin lets /login render full-screen without a nav.
 */
export const metadata: Metadata = {
  title: "VibePrinting Admin",
  description: "Brand editor, manual triggers, scheduler, and upload history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dracula-bg font-sans text-dracula-fg antialiased">
        {children}
      </body>
    </html>
  );
}
