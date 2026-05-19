import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import ReactQueryProvider from '@/contexts/ReactQueryProvider';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light">
          <ReactQueryProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
