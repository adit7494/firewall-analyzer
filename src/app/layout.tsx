import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { AuthProvider } from '@/components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'Firewall Audit Analyzer — Offline Configuration Review Platform',
  description: 'Deep multi-vendor firewall configuration audit, rule review, and security posture scoring based on uploaded backup files.',
  icons: {
    icon: '/favicon.gif',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-container">
            <Sidebar />
            <div className="main-content">
              <Topbar />
              <main className="content-area">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
