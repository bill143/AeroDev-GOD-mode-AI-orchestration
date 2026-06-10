import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena — Mission Control",
  description:
    "Arena desktop shell: a live window onto the orchestration backend's single source of truth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
