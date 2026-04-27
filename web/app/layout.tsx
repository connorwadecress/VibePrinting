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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@700&family=Montserrat:wght@700&family=Oswald:wght@700&family=Poppins:wght@700&family=Roboto:wght@700&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
