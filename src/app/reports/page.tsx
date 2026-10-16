'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Search, ArrowRight, ShieldCheck, Plus, Download, Filter, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { getReports, getAudits, getCompanyById, addReport, deleteReport } from '@/app/actions/data';
import { Report, AuditResult } from '@/lib/types/audit';
import { Select } from '@/components/ui/select';

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showNewModal, setShowNewModal] = useState(false);
  
  // New Report Modal State
  const [selectedAuditId, setSelectedAuditId] = useState('');
  const [reportType, setReportType] = useState<'Technical' | 'Executive' | 'Monthly'>('Technical');

  useEffect(() => {
    async function load() {
      const reps = await getReports();
      setReports(reps);
      const auds = await getAudits();
      setAudits(auds);
      
      const newAuditId = searchParams.get('new');
      if (newAuditId && auds.some(a => a.id === newAuditId)) {
        setSelectedAuditId(newAuditId);
        setShowNewModal(true);
      } else if (auds.length > 0) {
        setSelectedAuditId(auds[0].id);
      }
    }
    load();
  }, [searchParams]);

  const types = ['ALL', 'Technical', 'Executive', 'Monthly'];

  const filtered = reports.filter(r => {
    const matchSearch = r.company_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        r.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        r.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = typeFilter === 'ALL' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const aud = audits.find(a => a.id === selectedAuditId);
    if (!aud) return;

    const comp = await getCompanyById(aud.company_id);
    if (!comp) return;

    const newRep: Report = {
      id: `rep-${Date.now().toString().slice(-6)}`,
      audit_id: aud.id,
      company_id: aud.company_id,
      company_name: comp?.name || 'Unknown Client',
      device_name: aud.config_file_name.split('_')[0] || 'Appliance',
      type: reportType,
      score: aud.score,
      grade: aud.grade,
      created_at: new Date().toISOString(),
      finalized: true,
      snapshot: aud
    };

    await addReport(newRep);
    const updatedReps = await getReports();
    setReports(updatedReps);
    setShowNewModal(false);
    router.push(`/reports/viewer/${newRep.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    await deleteReport(id);
    const updatedReps = await getReports();
    setReports(updatedReps);
  };

  return (
    <>
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <div className="flex-row">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>Audit Compliance Reports Directory</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Immutable executive and technical compliance report snapshots generated for client distribution</p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => setShowNewModal(true)}
        >
          <Plus size={16} /> Generate Report Snapshot
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ width: '300px' }}>
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search report ID, client, appliance..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={13} /> Report Format:
            </span>
            {types.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: typeFilter === t ? 'var(--navy)' : 'transparent',
                  color: typeFilter === t ? '#fff' : 'var(--slate)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <b>{filtered.length}</b> of <b>{reports.length}</b> reports
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Report Reference ID</th>
              <th>Client Tenant</th>
              <th>Target Gateway</th>
              <th>Format Type</th>
              <th>Posture Grade</th>
              <th>Generation Timestamp</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(rep => (
              <tr key={rep.id}>
                <td>
                  <div className="flex-start">
                    <div className="stat-icon" style={{ width: 36, height: 36, background: 'var(--cyan-light)', color: 'var(--cyan-d)', borderRadius: 10 }}>
                      <FileText size={18} />
                    </div>
                    <b className="mono" style={{ fontSize: 13, color: 'var(--navy)' }}>{rep.id}</b>
                  </div>
                </td>
                <td>
                  <b style={{ fontSize: 14, display: 'block' }}>{rep.company_name}</b>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 13 }}>{rep.device_name}</span>
                </td>
                <td>
                  <span className="pill" style={{ 
                    background: rep.type === 'Executive' ? 'var(--indigo-light)' : rep.type === 'Technical' ? 'var(--cyan-light)' : 'var(--med-bg)',
                    color: rep.type === 'Executive' ? 'var(--indigo)' : rep.type === 'Technical' ? 'var(--cyan-d)' : '#b45309'
                  }}>
                    {rep.type} Report
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{rep.score}</b>
                    <span className={`grade-badge grade-${rep.grade.toLowerCase()}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                      Grade {rep.grade}
                    </span>
                  </div>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--slate)' }}>
                  {new Date(rep.created_at).toLocaleString()}
                </td>
                <td>
                  {rep.finalized ? (
                    <span className="pill pill-ok" style={{ fontSize: 11 }}>
                      <CheckCircle2 size={12} /> Finalized
                    </span>
                  ) : (
                    <span className="pill pill-high" style={{ fontSize: 11 }}>
                      <AlertCircle size={12} /> Draft
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={() => router.push(`/reports/viewer/${rep.id}`)}
                    >
                      <span>View & Print</span> <ArrowRight size={13} />
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost text-red-600" 
                      style={{ padding: '6px' }}
                      onClick={() => handleDelete(rep.id)}
                      title="Delete Report"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  No reports match your current filter selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </div>

      {showNewModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px'
        }} className="animate-fade-in">
          <div className="card" style={{ width: '100%', maxWidth: '500px', background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Generate Audit Snapshot Report</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Select an existing configuration audit to generate an immutable, export-ready executive or technical report.
            </p>

            <form onSubmit={handleCreateReport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Select Target Audit Evaluation</label>
                <Select
                  value={selectedAuditId}
                  onChange={setSelectedAuditId}
                  options={audits.map(a => ({
                    value: a.id,
                    label: `${a.config_file_name} — Score: ${a.score} (Grade ${a.grade})`
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Report Format & Target Audience</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ padding: '12px', border: `2px solid ${reportType === 'Technical' ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: '10px', background: reportType === 'Technical' ? 'var(--cyan-light)' : '#fff', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="radio" name="reptype" checked={reportType === 'Technical'} onChange={() => setReportType('Technical')} />
                    <div>
                      <b style={{ fontSize: 13.5, display: 'block', color: 'var(--navy)' }}>Technical Compliance Report</b>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Detailed code evidence, rule IDs, and step-by-step CLI remediation guides for network engineers.</small>
                    </div>
                  </label>

                  <label style={{ padding: '12px', border: `2px solid ${reportType === 'Executive' ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: '10px', background: reportType === 'Executive' ? 'var(--cyan-light)' : '#fff', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="radio" name="reptype" checked={reportType === 'Executive'} onChange={() => setReportType('Executive')} />
                    <div>
                      <b style={{ fontSize: 13.5, display: 'block', color: 'var(--navy)' }}>Executive Summary Report</b>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>High-level risk scorecards, domain grades, and business impact summaries for CISOs and management.</small>
                    </div>
                  </label>

                  <label style={{ padding: '12px', border: `2px solid ${reportType === 'Monthly' ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: '10px', background: reportType === 'Monthly' ? 'var(--cyan-light)' : '#fff', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="radio" name="reptype" checked={reportType === 'Monthly'} onChange={() => setReportType('Monthly')} />
                    <div>
                      <b style={{ fontSize: 13.5, display: 'block', color: 'var(--navy)' }}>Monthly Retrospective Snapshot</b>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Progress tracking across consecutive monthly audit cycles.</small>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Report Now</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading reports directory...</div>}>
      <ReportsContent />
    </Suspense>
  );
}
