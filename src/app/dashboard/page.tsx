'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Server, 
  ShieldAlert, 
  TrendingUp, 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Search,
  Activity,
  Bot
} from 'lucide-react';
import { getAudits, getCompanies } from '@/app/actions/data';
import { AuditResult, Company } from '@/lib/types/audit';

export default function DashboardPage() {
  const router = useRouter();
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeScans, setActiveScans] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const auds = await getAudits();
        const comps = await getCompanies();
        setAudits(auds);
        setCompanies(comps);

        const activeRes = await fetch('/api/audit/active');
        if (activeRes.ok) {
          const d = await activeRes.json();
          setActiveScans(d.active || []);
        }
      } catch (e) {
        console.error(e);
      }
      setIsLoaded(true);
    }
    loadData();

    const interval = setInterval(async () => {
      try {
        const activeRes = await fetch('/api/audit/active');
        if (activeRes.ok) {
          const d = await activeRes.json();
          setActiveScans(d.active || []);
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) return <div className="p-8 text-slate-500">Loading security telemetry...</div>;

  const totalCompanies = companies.length;
  const totalDevices = companies.reduce((acc, c) => acc + c.devices_count, 0);
  
  // Only count the latest DONE audit for each device so we don't skew posture score with in-progress scans
  const doneAudits = audits.filter(a => a.status === 'done');
  const latestAudits: typeof audits = [];
  const seenDevices = new Set();
  for (const a of doneAudits) {
    if (!seenDevices.has(a.device_id)) {
      seenDevices.add(a.device_id);
      latestAudits.push(a);
    }
  }

  const avgScore = latestAudits.length > 0 
    ? Math.round(latestAudits.reduce((acc, a) => acc + (a.score || 0), 0) / latestAudits.length)
    : 0;
  
  const totalOpenCrit = latestAudits.reduce(
    (acc, a) => acc + (a.findings || []).filter(f => f.status === 'open' && f.severity === 'Critical').length, 
    0
  );
  const totalOpenHigh = latestAudits.reduce(
    (acc, a) => acc + (a.findings || []).filter(f => f.status === 'open' && f.severity === 'High').length, 
    0
  );
  const totalOpenMed = latestAudits.reduce(
    (acc, a) => acc + (a.findings || []).filter(f => f.status === 'open' && f.severity === 'Medium').length, 
    0
  );
  const totalOpenLow = latestAudits.reduce(
    (acc, a) => acc + (a.findings || []).filter(f => f.status === 'open' && (f.severity === 'Low' || f.severity === 'Info')).length, 
    0
  );

  const getCompanyById = (id: string) => companies.find(c => c.id === id);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner CTA */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, var(--navy), var(--navy2))',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '32px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ maxWidth: '650px' }}>
          <span className="pill" style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--cyan)', marginBottom: 12, border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <Activity size={12} /> Air-Gapped Firewall Audit Engine Ready
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            Elevate Client Network Security Posture
          </h2>
          <p style={{ fontSize: 14, color: 'var(--line2)', lineHeight: 1.6 }}>
            Upload raw FortiGate, SonicWall, or Palo Alto configuration backup files. Our normalized rule engine automatically audits against 26 critical CIS and NIST security checks without requiring live device management credentials.
          </p>
        </div>
        <div>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => router.push('/upload')}
            style={{ padding: '14px 28px', fontSize: 15, boxShadow: '0 8px 24px rgba(6, 182, 212, 0.4)' }}
          >
            <Upload size={18} /> Upload New Backup
          </button>
        </div>
      </div>

      {/* Active Background AI Scans Banner */}
      {activeScans.length > 0 && (
        <div className="card animate-fade-in" style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(79,70,229,0.1))',
          border: '1px solid rgba(6,182,212,0.35)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, var(--cyan), var(--indigo))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              flexShrink: 0
            }}>
              <Bot size={22} className="animate-spin" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 14, color: 'var(--navy)' }}>AI Security Scan Running in Background</b>
                <span className="ai-scan-pct">{activeScans[0].progress}%</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>
                Analyzing <strong>{activeScans[0].hostname}</strong> ({activeScans[0].companyName}) — {activeScans[0].currentBlock || 'Evaluating rulebase'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 12.5, padding: '8px 16px', flexShrink: 0 }}
            onClick={() => router.push(`/audit/progress?auditId=${activeScans[0].auditId}`)}
          >
            <Activity size={14} className="animate-pulse" /> Live Telemetry
          </button>
        </div>
      )}

      {/* 4 Stat Scorecards */}
      <div className="grid-4">
        <div className="card card-hover">
          <div className="card-title">
            <span>Monitored Clients</span>
            <span className="trend-badge trend-up"><TrendingUp size={14} /> +1 New</span>
          </div>
          <div className="flex-row">
            <div>
              <div className="stat-val">{totalCompanies}</div>
              <div className="stat-lbl">Active Enterprise Companies</div>
            </div>
            <div className="stat-icon" style={{ background: 'var(--indigo-light)', color: 'var(--indigo)' }}>
              <Building2 size={24} />
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="card-title">
            <span>Firewall Devices</span>
            <span className="trend-badge trend-neutral">All Vendors</span>
          </div>
          <div className="flex-row">
            <div>
              <div className="stat-val">{totalDevices}</div>
              <div className="stat-lbl">Gateway Appliances</div>
            </div>
            <div className="stat-icon" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)' }}>
              <Server size={24} />
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="card-title">
            <span>Average Posture</span>
            <span className="grade-badge grade-b">Grade B</span>
          </div>
          <div className="flex-row">
            <div>
              <div className="stat-val">{avgScore}<small style={{ fontSize: 16, color: 'var(--muted)' }}>/100</small></div>
              <div className="stat-lbl">Mean Posture Score</div>
            </div>
            <div className="mini-ring" style={{ '--p': avgScore, '--c': avgScore >= 80 ? 'var(--green)' : avgScore >= 60 ? 'var(--amber)' : 'var(--red)' } as React.CSSProperties}>
              <b>{avgScore}</b>
            </div>
          </div>
        </div>

        <div className="card card-hover" style={{ borderColor: totalOpenCrit > 0 ? 'rgba(225, 29, 72, 0.3)' : 'var(--line)' }}>
          <div className="card-title">
            <span>Critical Findings</span>
            <span className="pill pill-crit">{totalOpenCrit + totalOpenHigh} High+</span>
          </div>
          <div className="flex-row">
            <div>
              <div className="stat-val" style={{ color: 'var(--crit)' }}>{totalOpenCrit}</div>
              <div className="stat-lbl">High-Risk Rules</div>
            </div>
            <div className="stat-icon" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>
              <ShieldAlert size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Severity Summary & Posture Trend */}
      <div className="grid-2" style={{ gap: 24 }}>
        {/* Card 1: Open Severity Breakdown */}
        <div className="card">
          <div className="flex-row" style={{ marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Open Severity Breakdown</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Distribution of unresolved security vulnerabilities</p>
            </div>
            <span className="pill pill-crit">{totalOpenCrit + totalOpenHigh} High+ Risk</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div className="flex-row" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: 'var(--crit)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={16} /> Critical Severity
                </span>
                <span style={{ fontWeight: 700 }}>{totalOpenCrit} findings</span>
              </div>
              <div className="bar-track" style={{ height: 8, borderRadius: 4 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, (totalOpenCrit / 20) * 100)}%`, background: 'var(--crit)', borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div className="flex-row" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: 'var(--high)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> High Severity
                </span>
                <span style={{ fontWeight: 700 }}>{totalOpenHigh} findings</span>
              </div>
              <div className="bar-track" style={{ height: 8, borderRadius: 4 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, (totalOpenHigh / 25) * 100)}%`, background: 'var(--high)', borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div className="flex-row" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: 'var(--med)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Medium Severity
                </span>
                <span style={{ fontWeight: 700 }}>{totalOpenMed} findings</span>
              </div>
              <div className="bar-track" style={{ height: 8, borderRadius: 4 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, (totalOpenMed / 30) * 100)}%`, background: 'var(--med)', borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div className="flex-row" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: 'var(--low)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Low / Informational
                </span>
                <span style={{ fontWeight: 700 }}>{totalOpenLow} findings</span>
              </div>
              <div className="bar-track" style={{ height: 8, borderRadius: 4 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, (totalOpenLow / 30) * 100)}%`, background: 'var(--low)', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Security Posture Trend */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Security Posture Trend</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>4-month historical compliance average trajectory</p>
            </div>
            {audits.length > 0 && <span className="pill pill-ok">+26 pts Growth</span>}
          </div>

          {audits.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', borderBottom: '1px solid var(--line)', marginTop: 'auto' }}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>No historical data available</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '150px', padding: '10px 16px 0', borderBottom: '1px solid var(--line)', marginTop: 'auto' }}>
              <div style={{ textAlign: 'center', width: '20%' }}>
                <div style={{ height: '65px', background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px 8px 0 0', width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>52</span>
                </div>
                <small style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 8, fontWeight: 600 }}>April</small>
              </div>

              <div style={{ textAlign: 'center', width: '20%' }}>
                <div style={{ height: '85px', background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px 8px 0 0', width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>64</span>
                </div>
                <small style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 8, fontWeight: 600 }}>May</small>
              </div>

              <div style={{ textAlign: 'center', width: '20%' }}>
                <div style={{ height: '105px', background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px 8px 0 0', width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>71</span>
                </div>
                <small style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 8, fontWeight: 600 }}>June</small>
              </div>

              <div style={{ textAlign: 'center', width: '20%' }}>
                <div style={{ height: '130px', background: 'var(--green-bg)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: '8px 8px 0 0', width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6, boxShadow: '0 -4px 12px rgba(22,163,74,0.15)' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>78</span>
                </div>
                <small style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 700, display: 'block', marginTop: 8 }}>July</small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Width Grid: Recent Configuration Audits Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex-row" style={{ padding: '24px 28px', borderBottom: '1px solid var(--line)', background: 'var(--card-hover)' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>Recent Configuration Audits</h3>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>Latest compliance score evaluations, vendor gateways, and finding remediation statuses</p>
          </div>
          <Link href="/audit/results" className="btn btn-ghost" style={{ fontSize: 13, padding: '10px 18px', fontWeight: 600 }}>
            <span>View All ({audits.length})</span> <ArrowRight size={16} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 28px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company</th>
                <th style={{ padding: '16px 20px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Device Gateway</th>
                <th style={{ padding: '16px 20px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</th>
                <th style={{ padding: '16px 20px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grade</th>
                <th style={{ padding: '16px 20px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Findings</th>
                <th style={{ padding: '16px 28px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit, idx) => {
                const comp = getCompanyById(audit.company_id);
                const openCount = audit.findings.filter(f => f.status === 'open').length;
                const critCount = audit.findings.filter(f => f.status === 'open' && f.severity === 'Critical').length;
                
                return (
                  <tr key={audit.id} style={{ borderBottom: idx === audits.length - 1 ? 'none' : '1px solid var(--line)', transition: 'background 0.15s ease' }} className="table-row-hover">
                    <td style={{ padding: '20px 28px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                          {comp?.avatar_initials || 'FW'}
                        </div>
                        <div>
                          <b style={{ fontSize: 15, color: 'var(--navy)', display: 'block', marginBottom: 2 }}>{comp?.name || 'Unknown Company'}</b>
                          <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 500 }}>{audit.vendor}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '20px 20px' }}>
                      <b className="mono" style={{ fontSize: 14, color: 'var(--txt)', display: 'block', marginBottom: 4 }}>{audit.config_file_name.split('_')[0]}</b>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(audit.created_at).toLocaleDateString()}</span>
                    </td>

                    <td style={{ padding: '20px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="bar-track" style={{ width: 120, height: 10, borderRadius: 5, background: 'rgba(0,0,0,0.06)' }}>
                          <div className="bar-fill" style={{ 
                            width: `${audit.score}%`, 
                            background: audit.score >= 80 ? 'var(--green)' : audit.score >= 60 ? 'var(--amber)' : 'var(--red)',
                            borderRadius: 5,
                            height: '100%'
                          }} />
                        </div>
                        <b style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', minWidth: 28 }}>{audit.score}</b>
                      </div>
                    </td>

                    <td style={{ padding: '20px 20px' }}>
                      <span className={`grade-badge grade-${audit.grade.toLowerCase()}`} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 800 }}>
                        {audit.grade}
                      </span>
                    </td>

                    <td style={{ padding: '20px 20px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {critCount > 0 && (
                          <span className="pill pill-crit" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {critCount} Critical
                          </span>
                        )}
                        <span className="pill pill-info" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                          {openCount} Open
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '20px 28px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button 
                          type="button" 
                          className="btn btn-ghost" 
                          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={() => router.push(`/audit/${audit.id}`)}
                        >
                          <Search size={15} /> Inspect
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-ghost" 
                          style={{ padding: '8px 12px', fontSize: 13 }}
                          onClick={() => router.push(`/reports?new=${audit.id}`)}
                          title="Generate Report"
                        >
                          <FileText size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {audits.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: 14 }}>
                    No recent audits found. Upload a configuration file to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
