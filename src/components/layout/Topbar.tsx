'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Bell, User, ChevronRight, ShieldAlert, FileText, CheckCircle2,
  LogOut, Bot, Activity, ArrowRight, X, ExternalLink, Clock
} from 'lucide-react';

interface BackgroundScanItem {
  auditId: string;
  companyId: string;
  companyName: string;
  deviceId: string;
  deviceName: string;
  hostname: string;
  fileName: string;
  vendor: string;
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  progress: number;
  currentBlock?: string;
  totalBlocks: number;
  completedBlocks: number;
  findingsCount: number;
  score?: number;
  grade?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  read?: boolean;
}

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeScans, setActiveScans] = useState<BackgroundScanItem[]>([]);
  const [completedScans, setCompletedScans] = useState<BackgroundScanItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastScan, setToastScan] = useState<BackgroundScanItem | null>(null);

  const activeScansRef = useRef<BackgroundScanItem[]>([]);

  const isLogin = pathname === '/';

  // ── Poll background audit status every 3.5 seconds ───────────────────────
  useEffect(() => {
    if (isLogin) return;

    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await fetch('/api/audit/active');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const currentActive: BackgroundScanItem[] = data.active || [];
        const currentCompleted: BackgroundScanItem[] = data.completed || [];
        const prevActive = activeScansRef.current;

        setActiveScans(currentActive);
        setCompletedScans(currentCompleted);
        setUnreadCount(currentCompleted.filter(c => !c.read).length);

        // Check if any active scan transitioned to completed!
        for (const prev of prevActive) {
          const finished = currentCompleted.find(c => c.auditId === prev.auditId && c.status === 'done');
          if (finished) {
            setToastScan(finished);
            // Auto dismiss toast after 9 seconds
            setTimeout(() => {
              setToastScan(curr => (curr?.auditId === finished.auditId ? null : curr));
            }, 9000);
          }
        }

        activeScansRef.current = currentActive;
      } catch {
        // network error, ignore
      }
    }

    pollStatus();
    const interval = setInterval(pollStatus, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLogin]);

  if (isLogin) return null;

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/audit/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setCompletedScans(prev => prev.map(s => ({ ...s, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return { title: 'Security Dashboard', crumb: 'Cross-company posture and audit overview' };
    if (pathname.startsWith('/companies/') && pathname.length > 11) return { title: 'Company Details & Inventory', crumb: 'Companies › Client Profile & Devices' };
    if (pathname.startsWith('/companies')) return { title: 'Managed Companies', crumb: 'Client inventory and overall security scoring' };
    if (pathname.startsWith('/devices')) return { title: 'Firewall Device Inventory', crumb: 'All monitored firewall hardware and firmware status' };
    if (pathname.startsWith('/upload')) return { title: 'Upload Configuration Backup', crumb: 'Start offline configuration audit without direct device access' };
    if (pathname.startsWith('/audit/progress')) return { title: 'Executing Audit Analysis', crumb: 'Normalizing configuration and evaluating rule sets' };
    if (pathname.startsWith('/audit/results')) return { title: 'Audit Results Overview', crumb: 'Latest configuration audits and security grades' };
    if (pathname.startsWith('/audit/')) return { title: 'Detailed Audit Assessment', crumb: 'Audit Results › Security Score Breakdown and Findings' };
    if (pathname.startsWith('/findings/')) return { title: 'Finding Remediation Details', crumb: 'Audit Result › Evidence Snippet and Compliance Mapping' };
    if (pathname.startsWith('/reports/viewer/')) return { title: 'Report Viewer & Export', crumb: 'Reports › Generated Immutable Snapshot' };
    if (pathname.startsWith('/reports')) return { title: 'Audit Reports History', crumb: 'Stored executive and technical compliance reports' };
    if (pathname.startsWith('/settings')) return { title: 'System Settings', crumb: 'User roles, vendor parser registry, and scoring weights' };
    return { title: 'Firewall Audit Analyzer', crumb: 'System administration' };
  };

  const { title, crumb } = getPageTitle();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/audit/results?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{title}</h1>
          <div className="topbar-crumb">{crumb}</div>
        </div>

        <div className="topbar-right">
          <form onSubmit={handleSearch} className="search-box">
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search company, device, report..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* ── Indicator 1: AI Scan Masih Berjalan (In Progress) ────────── */}
          {activeScans.length > 0 && (
            <div style={{ position: 'relative' }}>
              <div 
                className="ai-scan-active-pill animate-fade-in"
                onClick={() => setShowScanDropdown(!showScanDropdown)}
                title="Click to view live background scan details"
              >
                <span className="ai-pulse-dot" />
                <Bot size={15} className="animate-spin text-cyan-500" />
                <span className="ai-scan-text">
                  AI Scan: <strong>{activeScans[0].hostname || activeScans[0].fileName}</strong>
                </span>
                <span className="ai-scan-pct">{activeScans[0].progress}%</span>
              </div>

              {showScanDropdown && (
                <div className="ai-scan-dropdown animate-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bot size={16} color="var(--indigo)" />
                      <b style={{ fontSize: 13, color: 'var(--navy)' }}>Active AI Scans ({activeScans.length})</b>
                    </div>
                    <span className="pill pill-info" style={{ fontSize: 10 }}>Running in Background</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {activeScans.map((scan) => (
                      <div key={scan.auditId} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div>
                            <b style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>{scan.hostname}</b>
                            <small style={{ fontSize: 11, color: 'var(--muted)' }}>{scan.companyName} • {scan.vendor}</small>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--cyan-d)' }}>{scan.progress}%</span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ background: 'var(--line2)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{
                            width: `${scan.progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--cyan), var(--indigo))',
                            borderRadius: 4,
                            transition: 'width 0.4s ease'
                          }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Activity size={12} className="animate-pulse text-amber-500" />
                            {scan.currentBlock || 'Evaluating rulebase...'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => {
                              setShowScanDropdown(false);
                              router.push(`/audit/progress?auditId=${scan.auditId}`);
                            }}
                          >
                            Live Telemetry
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notifications Bell & Menu (Shows Completed Scans) ───────── */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              className="icon-button"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--green)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 0 0 2px #fff',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '360px',
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-lg)',
                padding: '16px',
                zIndex: 200
              }} className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: 13, color: 'var(--navy)' }}>System Notifications</b>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        style={{ fontSize: 11, color: 'var(--cyan-d)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mark all read
                      </button>
                    )}
                    <span className="pill pill-info" style={{ fontSize: 10 }}>{completedScans.length} Audits</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
                  {completedScans.map((scan) => (
                    <div
                      key={scan.auditId}
                      style={{
                        padding: '10px 12px',
                        background: scan.read ? 'var(--bg)' : 'rgba(22, 163, 74, 0.05)',
                        border: scan.read ? '1px solid var(--line)' : '1px solid rgba(22, 163, 74, 0.25)',
                        borderRadius: 10,
                        transition: 'var(--transition)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={16} color="var(--green)" />
                          <b style={{ fontSize: 12.5, color: 'var(--navy)' }}>{scan.hostname}</b>
                        </div>
                        <span className={`grade-badge grade-${scan.grade ? scan.grade.toLowerCase() : 'b'}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                          Grade {scan.grade} ({scan.score})
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '4px 0 8px 24px' }}>
                        {scan.companyName} • Audit finished with {scan.findingsCount ?? 0} finding(s)
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => {
                            setShowNotifications(false);
                            router.push(`/audit/${scan.auditId}`);
                          }}
                        >
                          Inspect Report <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {completedScans.length === 0 && (
                    <div style={{ fontSize: 12, padding: '24px 0', textAlign: 'center', color: 'var(--muted)' }}>
                      No recent audit notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-badge" onClick={() => router.push('/settings')} title="Account Settings">
            <div className="avatar">AD</div>
            <div style={{ lineHeight: 1.2 }}>
              <b style={{ fontSize: 13, display: 'block' }}>Adhitya</b>
              <small style={{ fontSize: 11, color: 'var(--muted)' }}>Administrator</small>
            </div>
          </div>

          <button 
            type="button" 
            className="icon-button"
            onClick={() => router.push('/')}
            title="Sign Out"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Indicator 2: Floating Completion Toast ────────────────────── */}
      {toastScan && (
        <div className="ai-toast-notification">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--green), #059669)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <b style={{ fontSize: 13, color: 'var(--navy)' }}>AI Security Scan Completed</b>
              <button 
                type="button" 
                onClick={() => setToastScan(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--slate)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
              <strong>{toastScan.hostname}</strong> ({toastScan.vendor}) scored <strong>{toastScan.score}/100</strong> with Grade <strong>{toastScan.grade}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 11.5, padding: '5px 12px' }}
                onClick={() => {
                  setToastScan(null);
                  router.push(`/audit/${toastScan.auditId}`);
                }}
              >
                Inspect Assessment <ArrowRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 11.5, padding: '5px 10px' }}
                onClick={() => setToastScan(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
