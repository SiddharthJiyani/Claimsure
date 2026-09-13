import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const themeBoot = `(function(){try{var t=localStorage.getItem("claimsure-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

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
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} h-full antialiased`}
    >
      <head>
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
