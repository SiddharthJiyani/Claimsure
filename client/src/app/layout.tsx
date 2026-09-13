import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const themeBoot = `(function(){try{var t=localStorage.getItem("claimsure-theme")==="light"?"light":"dark";var r=document.documentElement;var light=t==="light";r.setAttribute("data-theme",t);r.style.colorScheme=t;r.style.backgroundColor=light?"#f3f6fb":"#070b12";r.style.setProperty("--cs-bg",light?"#f3f6fb":"#070b12");r.style.setProperty("--cs-fg",light?"#102033":"#f3f6fb");r.style.setProperty("--cs-surface",light?"#ffffff":"#0e1522");r.style.setProperty("--cs-surface-2",light?"#e8eef6":"#151d2d");r.style.setProperty("--cs-sidebar",light?"#ffffff":"#0b1220");r.style.setProperty("--cs-border",light?"#d0dae8":"#243247");r.style.setProperty("--cs-muted",light?"#4b5d73":"#9aabc2");r.classList.toggle("light",light);r.classList.toggle("dark",!light);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Claimsure AI",
    template: "%s · Claimsure AI",
  },
  description:
    "Auditable AI for prior authorization and denial recovery. Patients and healthcare teams share one case workflow: parse the denial, retrieve policy, close the evidence gap, and verify the appeal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#070b12" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
