'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Building2, 
  Server, 
  Upload, 
  Search, 
  FileText, 
  Settings,
  CheckCircle2,
  LogOut,
  UserCheck,
  Activity
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const isLogin = pathname === '/';
  if (isLogin) return null;

  const [hasActiveScan, setHasActiveScan] = React.useState(false);

  React.useEffect(() => {
    if (isLogin) return;
    let isMounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/audit/active');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setHasActiveScan(data.hasActive || false);
        }
      } catch {}
    };
    check();
    const timer = setInterval(check, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isLogin]);

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="sidebar">
      <Link href="/dashboard" style={{ textDecoration: 'none' }}>
        <div className="brand" style={{ padding: '0 0 16px 0', margin: '0 0 16px 0' }}>
          <div className="brand-logo" style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: 'auto', height: 'auto' }}>
            <img src="/logo.png" alt="FW Audit Analyzer Logo" style={{ width: 140, height: 'auto', objectFit: 'contain' }} />
          </div>
        </div>
      </Link>

      <nav style={{ flex: 1 }}>
        <div className="nav-group-label">Main</div>
        <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </Link>
        <Link href="/companies" className={`nav-link ${isActive('/companies') ? 'active' : ''}`}>
          <Building2 size={18} />
          <span>Companies</span>
        </Link>
        <Link href="/devices" className={`nav-link ${isActive('/devices') ? 'active' : ''}`}>
          <Server size={18} />
          <span>Firewall Devices</span>
        </Link>

        <div className="nav-group-label" style={{ marginTop: 12 }}>Audit</div>
        <Link href="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
          <Upload size={18} />
          <span>Upload Config</span>
        </Link>
        <Link href="/audit/results" className={`nav-link ${isActive('/audit') && !pathname.includes('/progress') ? 'active' : ''}`}>
          <Search size={18} />
          <span>Audit Results</span>
          {hasActiveScan && <span className="sidebar-scan-badge animate-pulse">Scanning</span>}
        </Link>
        <Link href="/reports" className={`nav-link ${isActive('/reports') ? 'active' : ''}`}>
          <FileText size={18} />
          <span>Audit Reports</span>
        </Link>
        <Link href="/diagnostic" className={`nav-link ${isActive('/diagnostic') ? 'active' : ''}`}>
          <Activity size={18} />
          <span>Diagnostic Sandbox</span>
        </Link>

        <div className="nav-group-label" style={{ marginTop: 12 }}>System</div>
        <Link href="/settings" className={`nav-link ${isActive('/settings') && !pathname.includes('/users') ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Settings</span>
        </Link>
        <Link href="/settings/users" className={`nav-link ${isActive('/settings/users') ? 'active' : ''}`}>
          <UserCheck size={18} />
          <span>User Management</span>
        </Link>
        <Link href="/" className="nav-link" style={{ marginTop: 'auto', color: '#f87171', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </Link>
      </nav>

    </aside>
  );
}
