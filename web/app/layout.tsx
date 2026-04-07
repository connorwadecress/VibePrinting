import type { Metadata } from "next";
import "../styles/globals.css";

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
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
