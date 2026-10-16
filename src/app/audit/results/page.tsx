'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, FileText, ArrowRight, Upload, ShieldCheck, Filter, Bot, Activity } from 'lucide-react';
import { getAudits, getCompanies } from '@/app/actions/data';
import { AuditResult, Company } from '@/lib/types/audit';

function AuditResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeScans, setActiveScans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  const loadData = async () => {
    try {
      const a = await getAudits();
      const c = await getCompanies();
      setAudits(a);
      setCompanies(c);

      const activeRes = await fetch('/api/audit/active');
      if (activeRes.ok) {
        const d = await activeRes.json();
        setActiveScans(d.active || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  const grades = ['ALL', 'A', 'B', 'C', 'D', 'F'];
  const getCompanyById = (id: string) => companies.find(c => c.id === id);

  const filtered = audits.filter(a => {
    const comp = getCompanyById(a.company_id);
    const matchSearch = (a.config_file_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (comp?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (a.vendor || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchGrade = gradeFilter === 'ALL' || a.grade === gradeFilter;
    return matchSearch && matchGrade;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <div className="flex-row">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>Configuration Audit Results</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Comprehensive record of all evaluated firewall backups, security posture scores, and compliance grades</p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => router.push('/upload')}
        >
          <Upload size={16} /> New Configuration Audit
        </button>
      </div>

      {/* Active Scan Banner */}
      {activeScans.length > 0 && (
        <div className="card animate-fade-in" style={{ padding: '14px 20px', background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(79,70,229,0.08))', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bot size={22} className="text-cyan-600 animate-spin" />
            <div>
              <b style={{ fontSize: 13.5, color: 'var(--navy)', display: 'block' }}>
                AI Background Audit Running: {activeScans[0].hostname} ({activeScans[0].progress}%)
              </b>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {activeScans[0].currentBlock || 'Evaluating rulebase'} — table will automatically update when completed.
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => router.push(`/audit/progress?auditId=${activeScans[0].auditId}`)}
          >
            <Activity size={13} className="animate-pulse" /> Live Telemetry
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ width: '300px' }}>
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by client, filename, vendor..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={13} /> Grade:
            </span>
            {grades.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: gradeFilter === g ? 'var(--navy)' : 'transparent',
                  color: gradeFilter === g ? '#fff' : 'var(--slate)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                {g === 'ALL' ? 'All Grades' : `Grade ${g}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <b>{filtered.length}</b> of <b>{audits.length}</b> audits
        </div>
      </div>

      {/* Audits Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Client Company</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Config Backup</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Engine</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Score</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Grade</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((audit, idx) => {
                const comp = getCompanyById(audit.company_id);
                const findings = audit.findings || [];
                const openCount = findings.filter(f => f.status === 'open').length;
                const critCount = findings.filter(f => f.status === 'open' && f.severity === 'Critical').length;
                const isInProgress = audit.status === 'in_progress' || (audit.status as string) === 'parsing';
                
                return (
                  <tr key={audit.id} style={{ borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--line)', transition: 'background 0.15s ease' }} className="table-row-hover">
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                          {comp?.avatar_initials || 'FW'}
                        </div>
                        <div>
                          <b style={{ fontSize: 13, color: 'var(--navy)', display: 'block', marginBottom: 2, whiteSpace: 'nowrap' }}>{comp?.name || 'Unknown Client'}</b>
                          <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 500 }}>{comp?.industry || 'Enterprise'}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                      <b style={{ fontSize: 13, color: 'var(--navy)', display: 'block', marginBottom: 2 }}>{(audit.config_file_name || 'backup.conf').split('_')[0]}</b>
                      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, wordBreak: 'break-all', display: 'block', lineHeight: 1.4 }}>{audit.config_file_name}</span>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span className="pill" style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', border: '1px solid rgba(79,70,229,0.2)', padding: '4px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {audit.vendor}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <b style={{ fontSize: 12.5, color: 'var(--txt)', display: 'block', marginBottom: 2 }}>{new Date(audit.created_at).toLocaleDateString()}</b>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{new Date(audit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {isInProgress ? (
                        <span style={{ fontSize: 12, color: 'var(--cyan-d)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <Activity size={13} className="animate-pulse" /> Evaluating...
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="bar-track" style={{ width: 60, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.06)' }}>
                            <div className="bar-fill" style={{ 
                              width: `${audit.score}%`, 
                              background: audit.score >= 80 ? 'var(--green)' : audit.score >= 60 ? 'var(--amber)' : 'var(--red)',
                              borderRadius: 4,
                              height: '100%'
                            }} />
                          </div>
                          <b style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', minWidth: 24 }}>{audit.score}</b>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {isInProgress ? (
                        <span className="grade-badge grade-scanning animate-pulse" style={{ padding: '4px 10px', fontSize: 12 }}>
                          Scanning
                        </span>
                      ) : (
                        <span className={`grade-badge grade-${(audit.grade || 'F').toLowerCase()}`} style={{ padding: '4px 12px', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {audit.grade}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {isInProgress ? (
                        <span className="pill pill-info animate-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', fontSize: 11 }}>
                          <Bot size={13} className="animate-spin text-cyan-600" /> AI Analyzing
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {critCount > 0 && (
                            <span className="pill pill-crit" style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {critCount} Critical
                            </span>
                          )}
                          <span className="pill pill-info" style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {openCount} Open
                          </span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', minWidth: 100 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                        {isInProgress ? (
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '6px 10px', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            onClick={() => router.push(`/audit/progress?auditId=${audit.id}`)}
                          >
                            <Activity size={13} className="animate-pulse" /> Live Telemetry
                          </button>
                        ) : (
                          <>
                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              style={{ width: '100%', padding: '6px 10px', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                              onClick={() => router.push(`/audit/${audit.id}`)}
                            >
                              <Search size={13} /> Inspect
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-ghost" 
                              style={{ width: '100%', padding: '6px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid var(--line)' }}
                              onClick={() => router.push(`/reports?new=${audit.id}`)}
                              title="View Report"
                            >
                              <FileText size={13} /> Report
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: 14 }}>
                    No audit assessments match your search criteria.
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

export default function AuditResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading audit results directory...</div>}>
      <AuditResultsContent />
    </Suspense>
  );
}
