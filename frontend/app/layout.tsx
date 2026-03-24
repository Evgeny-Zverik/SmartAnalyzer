import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ReauthModal } from "@/components/auth/ReauthModal";
import { Header } from "@/components/layout/Header";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "SmartAnalyzer",
  description: "Анализ документов и данных для бизнеса",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Header />
        {children}
        <ReauthModal />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
