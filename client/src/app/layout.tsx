import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const themeBoot = `(function(){try{var t=localStorage.getItem("claimsure-theme")==="light"?"light":"dark";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;r.classList.toggle("light",t==="light");r.classList.toggle("dark",t==="dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

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
    default: "Claimsure",
    template: "%s · Claimsure",
  },
  description:
    "AI prior authorization and denial recovery for patients and healthcare teams.",
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
