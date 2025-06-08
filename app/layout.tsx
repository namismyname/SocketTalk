import type { Metadata } from 'next';
import './globals.css';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'SocketTalk',
  description: 'Real-time chat application built with Next.js and Socket.IO.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SocketProvider>
          {children}
        </SocketProvider>
        <Toaster />
      </body>
    </html>
  );
}
