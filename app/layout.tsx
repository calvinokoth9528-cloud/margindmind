import './globals.css';
import { Inter } from 'next/font/google';
import SessionProvider from '@/components/SessionProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MarginMind - E-commerce Profit Analytics',
  description: 'Track your true profit margins across Shopify, Amazon, and more. Know exactly how much you\'re making on every sale.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
