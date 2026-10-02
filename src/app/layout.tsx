import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Metas",
    default: "Metas",
  },
  description: "Objetivos, metas semanais e tarefas do dia.",
};

// Matches `--background` in globals.css so the browser chrome blends in.
export const viewport: Viewport = {
  themeColor: "#121214",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <Sidebar />
        <div
          id="conteudo"
          tabIndex={-1}
          className="pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] outline-none md:pb-0 md:pl-14"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
