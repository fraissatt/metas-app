import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { BackgroundProvider } from "@/components/background-provider";
import { BottomNav } from "@/components/bottom-nav";
import { setBackground } from "@/lib/actions/background";
import { setTheme } from "@/lib/actions/theme";
import { getBackground } from "@/lib/background";
import { BROWSER_CHROME, getTheme } from "@/lib/theme";
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
  // iOS ignores the manifest icons, so it needs its own link and title.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Metas" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return { themeColor: BROWSER_CHROME[theme], colorScheme: theme };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();
  const background = await getBackground();

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      className={`${theme === "dark" ? "dark " : ""}${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <BackgroundProvider initial={background} onChange={setBackground}>
          <AppHeader theme={theme} onThemeChange={setTheme} />
          <div
            id="conteudo"
            tabIndex={-1}
            className="pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] outline-none md:pb-0"
          >
            {children}
          </div>
          <BottomNav />
        </BackgroundProvider>
      </body>
    </html>
  );
}
