import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { setTheme } from "@/lib/actions/theme";
import { getTheme } from "@/lib/theme";
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

// Mirrors `--background` for each theme in globals.css. A CSS variable can't
// be used here, because the value ends up in a <meta> tag.
const BROWSER_CHROME = { dark: "rgb(13 15 19)", light: "rgb(236 238 242)" } as const;

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
        <Sidebar theme={theme} onThemeChange={setTheme} />
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
