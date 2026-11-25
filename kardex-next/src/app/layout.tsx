import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  title: 'Jabil Kardex | Adapter Validation',
  description: 'Jabil Kardex Put and Pick Inventory Validation System',
  icons: {
    icon: '/assets/images/images.png',
    shortcut: '/assets/images/images.png',
    apple: '/assets/images/images.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/assets/images/images.png" />
        <link rel="shortcut icon" type="image/png" href="/assets/images/images.png" />
        <link rel="apple-touch-icon" href="/assets/images/images.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
