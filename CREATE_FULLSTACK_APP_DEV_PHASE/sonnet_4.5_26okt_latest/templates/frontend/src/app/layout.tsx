import type { Metadata } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'Fullstack App',
  description: 'Production-ready Next.js + Spring Boot application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
