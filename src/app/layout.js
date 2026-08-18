import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from '@/shared/design-system/components/AppShell';
import NextTopLoader from 'nextjs-toploader';
import { ComposeProvider } from '@/app/context/ComposeContext';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { AuthProvider } from '@/shared/context/AuthContext';
import { Toaster } from 'sonner';
import ClientModals from '@/shared/design-system/components/ClientModals';
import { brand } from '@/config/brand.config';

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

import { SWRProvider } from '@/shared/context/SWRProvider';

export const metadata = {
  title: brand.meta.defaultTitle,
  description: brand.description,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${jetbrains.variable} antialiased`}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <SWRProvider>
              <ComposeProvider>
                <NextTopLoader
                  color={brand.theme.colors.primary}
                  initialPosition={0.08}
                  crawlSpeed={200}
                  height={3}
                  crawl={true}
                  showSpinner={false}
                  easing="ease"
                  speed={200}
                  shadow={`0 0 10px ${brand.theme.colors.primary},0 0 5px ${brand.theme.colors.primary}`}
                  zIndex={1600}
                  showAtBottom={false}
                />
                <AppShell>
                  {children}
                </AppShell>
                <ClientModals />
                <Toaster 
                  position="bottom-right" 
                  theme="dark"
                  toastOptions={{
                    className: 'rounded-none border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
                    style: {
                      borderRadius: '0',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                    },
                    actionButtonStyle: {
                      borderRadius: '0',
                      background: 'var(--text-primary)',
                      color: 'var(--bg-base)',
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      padding: '8px 16px',
                    }
                  }}
                />
              </ComposeProvider>
            </SWRProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
