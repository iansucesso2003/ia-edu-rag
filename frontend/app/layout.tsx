import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrusquetaIA",
  description: "Multi-Agent RAG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
