import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'NEXUS — AI Knowledge Workspace',
  description: 'Where Documents Become Intelligence. Chat with any document. Get instant insights.',
  keywords: ['AI', 'document', 'RAG', 'knowledge', 'chat', 'PDF'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
