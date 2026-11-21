import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import ToastProvider from "./components/ToastProvider";
import ChatBubble from "./components/ChatBubble";
import RegistrarServiceWorker from "./components/RegistrarServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "GymLogic - Tu Coach Digital",
  description: "Genera tu rutina de ejercicios personalizada con IA",
  manifest: "/manifest.json",
  // Sin esto iOS usa una captura de pantalla como ícono del acceso directo.
  // El PNG es RGB sin alpha a propósito: iOS rellena de negro lo transparente.
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "GymLogic",
    statusBarStyle: "default",
  },
};

// themeColor va literal: el navegador pinta la barra de estado antes de que
// exista CSS. Es el --background de app/globals.css; si cambia, moverlo a mano
// (y también background_color/theme_color de public/manifest.json).
export const viewport: Viewport = {
  themeColor: "#f1f5f9",
  // "cover" hace que iOS informe el margen del indicador de inicio en
  // env(safe-area-inset-bottom). Sin esto vale 0 y las barras de abajo quedan
  // metidas debajo de la rayita del iPhone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
      >
        {children}
        <ToastProvider />
        <ChatBubble />
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
