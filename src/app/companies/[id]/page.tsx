'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Portal } from '@/components/Portal';
import { 
  Building2, 
  Server, 
  ShieldCheck, 
  Upload, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Search,
  Mail,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { getCompanyById, getDevicesByCompany, getAuditsByCompany, deleteDevice } from '@/app/actions/data';
import { Company, Device, AuditResult } from '@/lib/types/audit';
import { Trash2, TrendingUp } from 'lucide-react';

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [devices, setDevices] = useState<Device[]>([]);
  const [audits, setAudits] = useState<AuditResult[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{id: string, hostname: string} | null>(null);

  useEffect(() => {
    async function loadData() {
      const comp = await getCompanyById(resolvedParams.id);
      if (comp) setCompany(comp);
      const devs = await getDevicesByCompany(resolvedParams.id);
      if (devs) setDevices(devs);
      const auds = await getAuditsByCompany(resolvedParams.id);
      if (auds) setAudits(auds);
      setIsLoaded(true);
    }
    loadData();
  }, [resolvedParams.id]);

  const executeDeleteDevice = async (id: string) => {
    await deleteDevice(id);
    const devs = await getDevicesByCompany(resolvedParams.id);
    if (devs) setDevices(devs);
    const comp = await getCompanyById(resolvedParams.id);
    if (comp) setCompany(comp);
    const auds = await getAuditsByCompany(resolvedParams.id);
    if (auds) setAudits(auds);
  };

  if (!isLoaded) return <div className="p-8 text-slate-500">Loading client profile...</div>;
  if (!company) {
    return (
      <div className="card p-8 text-center">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Company Not Found</h3>
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/companies')}>
          <ArrowLeft size={16} /> Back to Companies
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Back Button & Actions */}
      <div className="flex-row">
        <button 
          type="button" 
          className="btn btn-ghost"
          onClick={() => router.push('/companies')}
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Back to Companies List
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => router.push(`/upload?company=${company.id}`)}
          >
            <Upload size={16} /> Upload Device Backup
          </button>
        </div>
      </div>

      {/* Company Overview Header Card */}
      <div className="card" style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div className="stat-icon" style={{ 
            width: 72, 
            height: 72, 
            fontSize: 24, 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, var(--navy), var(--indigo))', 
            color: '#fff', 
            borderRadius: 20 
          }}>
            {company.avatar_initials}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>{company.name}</h1>
              <span className="pill" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>{company.industry}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: '600px', marginBottom: 12 }}>{company.notes}</p>
            
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--slate)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={15} color="var(--muted2)" /> <b>{company.contact_person}</b>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={15} color="var(--muted2)" /> {company.contact_email}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} color="var(--muted2)" /> Registered {new Date(company.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', borderLeft: '1px solid var(--line)', paddingLeft: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Overall Posture</div>
            <span className={`grade-badge grade-${company.latest_grade.toLowerCase()}`} style={{ fontSize: 18, padding: '6px 16px', display: 'inline-block' }}>
              Grade {company.latest_grade}
            </span>
          </div>

          <div className="ring" style={{ '--p': company.latest_score, '--c': company.latest_score >= 80 ? 'var(--green)' : company.latest_score >= 60 ? 'var(--amber)' : 'var(--red)' } as React.CSSProperties}>
            <div className="in">
              <b>{company.latest_score}</b>
              <small>Mean Score</small>
            </div>
          </div>
        </div>
      </div>

      {/* Remediation & Posture Trend */}
      {(() => {
        const sortedAudits = [...audits].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const devicesHistory: Record<string, AuditResult[]> = {};
        for (const a of sortedAudits) {
          if (!devicesHistory[a.device_id]) devicesHistory[a.device_id] = [];
          devicesHistory[a.device_id].push(a);
        }

        let totalFixed = 0;
        const monthlyFixed: Record<string, number> = {};

        for (const devAudits of Object.values(devicesHistory)) {
          for (let i = 1; i < devAudits.length; i++) {
            const prevRules = new Set(devAudits[i - 1].findings.filter(f => f.status === 'open').map(f => f.rule_id));
            const currRules = new Set(devAudits[i].findings.filter(f => f.status === 'open').map(f => f.rule_id));
            
            let fixedInThisStep = 0;
            prevRules.forEach(id => { if (!currRules.has(id)) fixedInThisStep++; });
            
            totalFixed += fixedInThisStep;
            
            const monthKey = new Date(devAudits[i].created_at).toLocaleDateString('default', { month: 'short', year: 'numeric' });
            monthlyFixed[monthKey] = (monthlyFixed[monthKey] || 0) + fixedInThisStep;
          }
        }

        const monthlyKeys = Object.keys(monthlyFixed);
        
        return (
          <div className="card" style={{ padding: '24px 32px', display: 'flex', gap: 40, alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green)', marginBottom: 8 }}>
                <TrendingUp size={20} />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Remediation Tracking</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 280 }}>
                Total misconfigurations and vulnerabilities permanently resolved across all gateway nodes.
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 32 }}>
              <div>
                <b style={{ fontSize: 32, color: 'var(--txt)', lineHeight: 1 }}>{totalFixed}</b>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>TOTAL FINDINGS FIXED</div>
              </div>
              
              <div style={{ flex: 1, display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {monthlyKeys.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--muted2)' }}>No remediation history recorded yet. Upload consecutive backups to track progress.</span>
                ) : (
                  monthlyKeys.map(month => (
                    <div key={month} style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '12px 16px', borderRadius: 12, minWidth: 120 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', marginBottom: 8 }}>{month}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)' }}>
                        <CheckCircle2 size={16} />
                        <b style={{ fontSize: 16 }}>{monthlyFixed[month]}</b>
                        <span style={{ fontSize: 11 }}>Fixed</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Device Inventory Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Firewall Gateway Inventory</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>All monitored physical and virtual firewall appliances belonging to {company.name}</p>
          </div>
          <span className="pill pill-info">{devices.length} Devices Monitored</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Hostname / Appliance</th>
              <th>Vendor & Model</th>
              <th>Firmware Version</th>
              <th>HA Architecture</th>
              <th>Physical Location</th>
              <th>Latest Audit Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(dev => (
              <tr key={dev.id}>
                <td>
                  <div className="flex-start">
                    <Server size={18} color="var(--cyan-d)" />
                    <div>
                      <b style={{ fontSize: 14, display: 'block' }}>{dev.hostname}</b>
                      <small className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>SN: {dev.serial}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <b style={{ fontSize: 13.5 }}>{dev.vendor}</b>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Model {dev.model}</div>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{dev.os_version}</span>
                </td>
                <td>
                  <span className="pill" style={{ background: dev.ha_status.includes('Active') ? 'var(--indigo-light)' : 'var(--bg)', color: dev.ha_status.includes('Active') ? 'var(--indigo)' : 'var(--slate)', border: '1px solid var(--line)' }}>
                    {dev.ha_status}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate)' }}>
                    <MapPin size={14} color="var(--muted2)" /> {dev.location}
                  </span>
                </td>
                <td>
                  {dev.latest_score ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 14 }}>{dev.latest_score}</b>
                      <span className={`grade-badge grade-${dev.latest_grade?.toLowerCase()}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                        {dev.latest_grade}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Not Audited</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => router.push(`/upload?company=${company.id}&device=${dev.id}`)}
                    >
                      <Upload size={13} /> Audit Now
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 12px', fontSize: 12, color: 'var(--red)' }}
                      onClick={() => setDeleteTarget({ id: dev.id, hostname: dev.hostname })}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historical Audits for this Company */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Audit History & Reports</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Chronological record of configuration audit reviews and generated compliance reports</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Audit Reference ID</th>
              <th>Configuration File</th>
              <th>Evaluation Date</th>
              <th>Score & Grade</th>
              <th>Open Findings</th>
              <th>Audited By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {audits.map(audit => (
              <tr key={audit.id}>
                <td>
                  <b className="mono" style={{ fontSize: 13 }}>{audit.id.split('-')[0]}-...</b>
                </td>
                <td>
                  <b style={{ fontSize: 13.5, display: 'block' }}>{audit.config_file_name}</b>
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>{audit.vendor} Parser</small>
                </td>
                <td>{new Date(audit.created_at).toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{audit.status === 'in_progress' ? 'Scanning...' : audit.score}</b>
                    <span className={`grade-badge grade-${(audit.grade || 'F').toLowerCase()}`}>Grade {audit.grade || 'P'}</span>
                  </div>
                </td>
                <td>
                  <span className="pill pill-info">{(audit.findings || []).filter(f => f.status === 'open').length} Open</span>
                </td>
                <td>{audit.created_by}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => router.push(audit.status === 'in_progress' ? `/audit/progress?auditId=${audit.id}` : `/audit/${audit.id}`)}
                    >
                      <Search size={13} /> {audit.status === 'in_progress' ? 'Progress' : 'Inspect'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => router.push(`/reports?new=${audit.id}`)}
                    >
                      <FileText size={13} /> Report
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {audits.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  No historical audits recorded for this company yet. Click &quot;Upload Device Backup&quot; above to start!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Delete Device Modal */}
      {deleteTarget && (
      <Portal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 440, padding: 32, boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--crit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--crit)' }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Delete Device?</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.6, marginBottom: 32, paddingLeft: 64 }}>
              Are you sure you want to delete the firewall gateway <b>{deleteTarget.hostname}</b>? This action is permanent and will remove all associated audits for this device.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'var(--crit)', color: '#fff', padding: '10px 24px' }}
                onClick={() => {
                  executeDeleteDevice(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </>
  );
}
