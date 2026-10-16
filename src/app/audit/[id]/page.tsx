'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  FileText, 
  Search, 
  Plus, 
  Filter, 
  Server, 
  Building2, 
  ExternalLink,
  X,
  HelpCircle,
  Bot,
  Activity
} from 'lucide-react';
import { getAuditById, getCompanyById, addManualFinding } from '@/app/actions/data';
import { AuditResult, Company, Finding, Severity, RuleCategory } from '@/lib/types/audit';
import { FrameworkLensSwitcher } from '@/components/framework/FrameworkLensSwitcher';
import { FrameworkView } from '@/components/framework/FrameworkView';
import { FrameworkCode } from '@/lib/types/framework';
import { evaluateAuditFrameworks, getFrameworkResultByCode } from '@/lib/engine/framework-evaluator';
import { Select } from '@/components/ui/select';
import { RULES_CATALOG } from '@/lib/engine/rules-catalog';
import { normalizeRuleId } from '@/lib/engine/rule-utils';

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [audit, setAudit] = useState<AuditResult | undefined>(undefined);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<FrameworkCode>('CIS');
  
  // Filters
  const [sevFilter, setSevFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cisLevelFilter, setCisLevelFilter] = useState('ALL');
  const [sysCheckFilter, setSysCheckFilter] = useState('ALL');
  const [cisSectionFilter, setCisSectionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'violations' | 'passed'>('violations');

  const failedNormalizedIds = new Set<string>();
  for (const f of audit?.findings || []) {
    if (f.status === 'open' || f.status === 'pending_confirmation') {
      const nId = normalizeRuleId(f.rule_id);
      if (nId) failedNormalizedIds.add(nId);
      const nCode = normalizeRuleId(f.cis_code);
      if (nCode) failedNormalizedIds.add(nCode);
    }
  }

  const passedRules = audit ? RULES_CATALOG.filter(r => {
    const applies = r.applies_to.includes('common') || 
                    r.applies_to.includes('fortigate') || 
                    (audit.vendor && r.applies_to.includes(audit.vendor.toLowerCase()));
    if (!applies) return false;
    const normR = normalizeRuleId(r.id);
    const normRCode = normalizeRuleId(r.code);
    if ((normR && failedNormalizedIds.has(normR)) || (normRCode && failedNormalizedIds.has(normRCode))) {
      return false;
    }
    return true;
  }) : [];

  // Manual Modal
  const [showModal, setShowModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualSev, setManualSev] = useState<Severity>('Medium');
  const [manualCat, setManualCat] = useState<RuleCategory>('Access Control');
  const [manualRec, setManualRec] = useState('');
  const [manualPen, setManualPen] = useState(5);

  useEffect(() => {
    async function loadData() {
      const a = await getAuditById(resolvedParams.id);
      if (a) {
        setAudit(a);
        const c = await getCompanyById(a.company_id);
        if (c) setCompany(c);
      }
      setIsLoaded(true);
    }
    loadData();
  }, [resolvedParams.id]);

  if (!isLoaded) return <div className="p-8 text-slate-500">Loading audit assessment...</div>;
  if (!audit) {
    return (
      <div className="card p-8 text-center">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Audit Result Not Found</h3>
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/audit/results')}>
          <ArrowLeft size={16} /> Back to Audit Directory
        </button>
      </div>
    );
  }

  if (audit.status === 'in_progress') {
    return (
      <div className="card animate-fade-in p-8 text-center" style={{ maxWidth: 650, margin: '40px auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, var(--cyan), var(--indigo))',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <Bot size={28} className="animate-spin" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
          AI Security Audit In Progress
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
          This firewall configuration backup is currently being evaluated by the AI engine in the background. You can monitor the real-time block evaluation telemetry below.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => router.push(`/audit/progress?auditId=${audit.id}`)}
          >
            <Activity size={15} className="animate-pulse" /> View Live Telemetry
          </button>
          <button 
            type="button" 
            className="btn btn-ghost"
            onClick={() => router.push('/audit/results')}
          >
            <ArrowLeft size={15} /> Back to Directory
          </button>
        </div>
      </div>
    );
  }

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualDesc) {
      alert('Please enter a title and description.');
      return;
    }

    const updated = await addManualFinding(audit.id, {
      rule_id: 'MANUAL_OBS',
      title: manualTitle,
      description: manualDesc,
      category: manualCat,
      severity: manualSev,
      recommendation: manualRec || 'Implement compensating security controls and procedural verification.',
      compliance_tags: ['ISO 27001', 'NIST CSF'],
      status: 'open',
      is_manual: true,
      penalty_score: manualPen
    });

    if (updated) setAudit({ ...updated });
    setShowModal(false);
    setManualTitle('');
    setManualDesc('');
  };

  const allSections = Array.from(new Set(audit.findings.map(f => f.cis_section || f.category).filter(Boolean)));

  const filteredFindings = audit.findings.filter(f => {
    const matchSev = sevFilter === 'ALL' || f.severity === sevFilter;
    const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchCisLevel = cisLevelFilter === 'ALL' || f.cis_level === cisLevelFilter || (!f.cis_level && cisLevelFilter === 'ALL');
    const matchSysCheck = sysCheckFilter === 'ALL' || f.system_check === sysCheckFilter || (!f.system_check && sysCheckFilter === 'ALL');
    const matchSection = cisSectionFilter === 'ALL' || (f.cis_section || f.category) === cisSectionFilter;
    const matchSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        f.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (f.cis_code && f.cis_code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSev && matchStatus && matchCisLevel && matchSysCheck && matchSection && matchSearch;
  });

  const filteredPassed = passedRules.filter(r => {
    const matchSev = sevFilter === 'ALL' || r.severity === sevFilter;
    const matchCisLevel = cisLevelFilter === 'ALL' || r.cis_level === cisLevelFilter || (!r.cis_level && cisLevelFilter === 'ALL');
    const matchSysCheck = sysCheckFilter === 'ALL' || r.system_check === sysCheckFilter;
    const matchSection = cisSectionFilter === 'ALL' || r.section === cisSectionFilter || r.category === cisSectionFilter;
    const matchSearch = searchQuery === '' || 
                        r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (r.id && r.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (r.code && r.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSev && matchCisLevel && matchSysCheck && matchSection && matchSearch;
  });

  const getSevColor = (sev: Severity) => {
    if (sev === 'Critical') return 'var(--crit)';
    if (sev === 'High') return 'var(--high)';
    if (sev === 'Medium') return 'var(--med)';
    if (sev === 'Low') return 'var(--low)';
    return 'var(--info)';
  };

  const openCrit = audit.findings.filter(f => f.status === 'open' && f.severity === 'Critical').length;
  const openHigh = audit.findings.filter(f => f.status === 'open' && f.severity === 'High').length;

  const fwResults = evaluateAuditFrameworks(audit);
  const activeFwResult = getFrameworkResultByCode(fwResults, selectedFramework);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Back & Actions */}
      <div className="flex-row">
        <button 
          type="button" 
          className="btn btn-ghost"
          onClick={() => router.push('/audit/results')}
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Back to Audit Directory
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            type="button" 
            className="btn btn-ghost"
            onClick={() => setShowModal(true)}
            style={{ borderColor: 'var(--cyan)', color: 'var(--cyan-d)' }}
          >
            <Plus size={16} /> Add Manual Observation
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => router.push(`/reports`)}
          >
            <FileText size={16} /> Export Executive / Tech Report
          </button>
        </div>
      </div>

      {/* Top Banner Scorecard */}
      <div className="card" style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flex: 1 }}>
          <div className="ring" style={{ '--p': audit.score, '--c': audit.score >= 80 ? 'var(--green)' : audit.score >= 60 ? 'var(--amber)' : 'var(--red)' } as React.CSSProperties}>
            <div className="in">
              <b>{audit.score}</b>
              <small>Score / 100</small>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <span className={`grade-badge grade-${audit.grade.toLowerCase()}`} style={{ fontSize: 16, padding: '4px 12px' }}>
                Grade {audit.grade}
              </span>
              <span className="pill pill-vendor">{audit.vendor} Parser</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
              {company?.name || 'Client Audit'} — {audit.config_file_name}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Audit Reference ID: <span className="mono" style={{ color: 'var(--txt)' }}>{audit.id}</span> • Evaluated {new Date(audit.created_at).toLocaleString()} by {audit.created_by.replace(' (Lead Auditor)', '')}
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="pill pill-crit">{openCrit} Critical Open</span>
              <span className="pill pill-high">{openHigh} High Open</span>
              <span className="pill pill-info">{audit.rules_analyzed} CIS/NIST Rules Evaluated</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--line)', minWidth: '240px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Scoring Methodology</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{audit.findings.length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Total Identified Findings</div>
          <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            Accepted Risk items excluded from deduction
          </div>
        </div>
      </div>

      {/* Framework Lens Switcher */}
      <FrameworkLensSwitcher
        selectedFramework={selectedFramework}
        onSelect={setSelectedFramework}
      />

      {selectedFramework === 'CIS' ? (
        <>
          {/* CIS Compliance Level Adherence Banner */}
          {audit.score_breakdown && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>CIS FortiGate Benchmark Adherence</h3>
          <div className="grid-2" style={{ gap: 16 }}>
            {['CIS Level 1', 'CIS Level 2'].map((levelKey, idx) => {
              const data = audit.score_breakdown?.[levelKey] || { score: 100, total: 0, passed: 0, failed: 0 };
              return (
                <div key={idx} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `6px solid ${data.score >= 80 ? 'var(--green)' : data.score >= 60 ? 'var(--amber)' : 'var(--red)'}` }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span className="pill" style={{ background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        {levelKey} Profile
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {levelKey === 'CIS Level 1' ? 'Essential Base Defense' : 'Defense-in-Depth / High Security'}
                      </span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>
                      {data.passed} / {data.total} Controls Compliant
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {data.failed} Active Violations Found
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: data.score >= 80 ? 'var(--green)' : data.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                      {data.score}%
                    </div>
                    <small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Adherence Rate</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6 Category Breakdown Grid */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Domain Security Posture Breakdown</h3>
        <div className="grid-3" style={{ gap: 16 }}>
          {audit.breakdown.map((cat, idx) => (
            <div key={idx} className="card" style={{ padding: '18px' }}>
              <div className="flex-row" style={{ marginBottom: 10 }}>
                <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>{cat.category}</b>
                <span style={{ fontSize: 13, fontWeight: 800, color: cat.score >= 80 ? 'var(--green)' : cat.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                  {cat.score}<small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>/100</small>
                </span>
              </div>
              <div className="bar-track" style={{ height: 6 }}>
                <div className="bar-fill" style={{ width: `${cat.score}%`, background: cat.score >= 80 ? 'var(--green)' : cat.score >= 60 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
              {audit.score_breakdown && audit.score_breakdown[cat.category] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8, fontWeight: 600 }}>
                  <span style={{ color: 'var(--green)' }}>{audit.score_breakdown[cat.category].passed} Passed</span>
                  <span style={{ color: 'var(--red)' }}>{audit.score_breakdown[cat.category].failed} Failed</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Findings Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Detailed Security Findings & Violations</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Click &quot;Inspect & Remediate&quot; on any finding to review raw configuration evidence code and compliance mapping</p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: '180px', padding: '8px 12px' }}>
              <Search size={14} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search rule ID or title..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 12.5 }}
              />
            </div>

            <Select
              value={cisLevelFilter}
              onChange={setCisLevelFilter}
              style={{ minWidth: 140 }}
              options={[
                { value: 'ALL', label: 'All CIS Profiles' },
                { value: 'L1', label: 'CIS Level 1' },
                { value: 'L2', label: 'CIS Level 2' }
              ]}
            />

            <Select
              value={sysCheckFilter}
              onChange={setSysCheckFilter}
              style={{ minWidth: 150 }}
              options={[
                { value: 'ALL', label: 'All Check Types' },
                { value: 'auto', label: 'Automated Check' },
                { value: 'semi', label: 'Semi-Automated' },
                { value: 'manual', label: 'Manual Review' }
              ]}
            />

            <Select
              value={cisSectionFilter}
              onChange={setCisSectionFilter}
              style={{ minWidth: 160, maxWidth: 200 }}
              options={[
                { value: 'ALL', label: 'All Sections' },
                ...allSections.map(sec => ({ value: sec, label: sec }))
              ]}
            />

            <Select
              value={sevFilter}
              onChange={setSevFilter}
              style={{ minWidth: 140 }}
              options={[
                { value: 'ALL', label: 'All Severities' },
                { value: 'Critical', label: 'Critical Only' },
                { value: 'High', label: 'High Only' },
                { value: 'Medium', label: 'Medium Only' },
                { value: 'Low', label: 'Low Only' }
              ]}
            />

            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ minWidth: 150 }}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'open', label: 'Open Findings' },
                { value: 'accepted_risk', label: 'Accepted Risk' },
                { value: 'false_positive', label: 'False Positive' },
                { value: 'resolved', label: 'Resolved' }
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, padding: '0 24px', borderBottom: '1px solid var(--line)', backgroundColor: 'var(--card-alt)' }}>
          <button 
            type="button" 
            style={{ 
              padding: '16px 0', 
              fontSize: 14, 
              fontWeight: 600,
              color: activeTab === 'violations' ? 'var(--navy)' : 'var(--muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'violations' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('violations')}
          >
            Violations & Findings ({filteredFindings.length})
          </button>
          <button 
            type="button" 
            style={{ 
              padding: '16px 0', 
              fontSize: 14, 
              fontWeight: 600,
              color: activeTab === 'passed' ? 'var(--navy)' : 'var(--muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'passed' ? '2px solid var(--green)' : '2px solid transparent',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('passed')}
          >
            Passed Checks ({filteredPassed.length})
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'violations' ? filteredFindings.map((f, idx) => (
            <div key={idx} className="finding-card">
              <div className="sev-bar" style={{ background: getSevColor(f.severity) }} />
              <div style={{ flex: 1 }}>
                <div className="flex-row" style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>
                      {f.rule_id}
                    </span>
                    {f.cis_level && (
                      <span className="pill" style={{ background: 'var(--navy)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                        CIS {f.cis_level}
                      </span>
                    )}
                    {f.system_check && (
                      <span className="pill" style={{ background: 'var(--bg)', color: 'var(--slate)', fontSize: 10, border: '1px solid var(--line)', fontWeight: 600 }}>
                        {f.system_check.toUpperCase()}
                      </span>
                    )}
                    {f.cis_code && (
                      <span className="pill" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', fontSize: 10, fontWeight: 700 }}>
                        CIS {f.cis_code}
                      </span>
                    )}
                    <b style={{ fontSize: 15, color: 'var(--navy)' }}>{f.title}</b>
                    {f.is_manual && <span className="pill pill-vendor" style={{ fontSize: 10 }}>Manual Obs</span>}
                    {f.ai_evaluated && (
                      <span className="pill" style={{ background: 'rgba(79,70,229,0.1)', color: '#4338ca', border: '1px solid rgba(79,70,229,0.25)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Bot size={10} /> AI Evaluated
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="pill" style={{ 
                      background: f.status === 'open' ? 'var(--crit-bg)' : f.status === 'resolved' ? 'var(--green-bg)' : 'var(--amber-bg)',
                      color: f.status === 'open' ? 'var(--crit)' : f.status === 'resolved' ? 'var(--green)' : '#b45309',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      Status: {f.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.status === 'open' ? 'var(--red)' : 'var(--muted)' }}>
                      -{f.status === 'open' ? f.penalty_score : 0} pts
                    </span>
                  </div>
                </div>

                <p style={{ 
                  fontSize: 13.5, 
                  color: 'var(--slate)', 
                  lineHeight: 1.6, 
                  marginBottom: f.ai_evaluated && f.ai_reason ? 8 : 12,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {f.description}
                </p>

                {f.ai_evaluated && f.ai_reason && (
                  <div style={{ padding: '10px 14px', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Bot size={14} color="#4338ca" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', margin: '0 0 3px 0' }}>AI Analysis</p>
                      <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: 0, lineHeight: 1.6 }}>{f.ai_reason}</p>
                    </div>
                  </div>
                )}

                <div className="flex-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="tag" style={{ color: 'var(--muted)' }}>{f.cis_section || f.category}</span>
                    {f.compliance_tags.map((tag, i) => (
                      <span key={i} className="tag" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', borderColor: 'rgba(6,182,212,0.2)' }}>
                        {tag}
                      </span>
                    ))}
                    {f.auditor_note && (
                      <span className="tag" style={{ background: 'var(--amber-bg)', color: '#b45309' }}>
                        Auditor Note Attached
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 12, background: 'var(--navy)', color: '#fff' }}
                    onClick={() => router.push(`/findings/${f.id}?audit=${audit.id}`)}
                  >
                    <span>Inspect Evidence & Remediate</span> <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>
          )) : null}
          {activeTab === 'violations' && filteredFindings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              No findings match your current filters.
            </div>
          )}

          {activeTab === 'passed' ? filteredPassed.map((r, idx) => (
            <div key={idx} className="finding-card">
              <div className="sev-bar" style={{ background: 'var(--green)' }} />
              <div style={{ flex: 1 }}>
                <div className="flex-row" style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>
                      {r.id}
                    </span>
                    {r.system_check && (
                      <span className="pill" style={{ background: 'var(--bg)', color: 'var(--slate)', fontSize: 10, border: '1px solid var(--line)', fontWeight: 600 }}>
                        {r.system_check.toUpperCase()}
                      </span>
                    )}
                    {r.code && (
                      <span className="pill" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', fontSize: 10, fontWeight: 700 }}>
                        CIS {r.code}
                      </span>
                    )}
                    <b style={{ fontSize: 15, color: 'var(--navy)' }}>{r.title}</b>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="pill" style={{ 
                      background: 'var(--green-bg)',
                      color: 'var(--green)',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      Status: PASSED
                    </span>
                  </div>
                </div>

                <p style={{ 
                  fontSize: 13.5, 
                  color: 'var(--slate)', 
                  lineHeight: 1.6, 
                  marginBottom: 12,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {r.recommendation}
                </p>

                <div className="flex-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="tag" style={{ color: 'var(--muted)' }}>{r.section || r.category}</span>
                    {r.compliance_tags?.map((tag, i) => (
                      <span key={i} className="tag" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', borderColor: 'rgba(6,182,212,0.2)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 12, background: 'var(--green-bg)', color: 'var(--green)' }}
                    onClick={() => router.push(`/findings/${r.id}?audit=${audit.id}`)}
                  >
                    <span>View Rule & Evidence</span> <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>
          )) : null}

          {activeTab === 'passed' && filteredPassed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              No passed checks match your current filters.
            </div>
          )}
        </div>
      </div>
      </>
      ) : activeFwResult ? (
        <FrameworkView result={activeFwResult} />
      ) : null}

      {/* Manual Finding Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '24px'
        }} className="animate-fade-in">
          <div className="card" style={{ width: '100%', maxWidth: '560px', background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>Add Manual Finding / Observation</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Record physical security, procedural interview, or ad-hoc architectural findings. Score deduction will be automatically calculated.
            </p>

            <form onSubmit={handleAddManual} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Finding Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unlocked Server Rack in Branch Data Closet"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13.5 }}
                />
              </div>

              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Severity Level</label>
                  <Select
                    value={manualSev}
                    onChange={(val) => {
                      const s = val as Severity;
                      setManualSev(s);
                      setManualPen(s === 'Critical' ? 25 : s === 'High' ? 12 : s === 'Medium' ? 5 : 2);
                    }}
                    options={[
                      { value: 'Critical', label: 'Critical (25 pts deduction)' },
                      { value: 'High', label: 'High (12 pts deduction)' },
                      { value: 'Medium', label: 'Medium (5 pts deduction)' },
                      { value: 'Low', label: 'Low (2 pts deduction)' }
                    ]}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Domain Category</label>
                  <Select
                    value={manualCat}
                    onChange={(val) => setManualCat(val as RuleCategory)}
                    options={[
                      { value: 'Access Control', label: 'Access Control' },
                      { value: 'Management Hardening', label: 'Management Hardening' },
                      { value: 'Logging & Monitoring', label: 'Logging & Monitoring' },
                      { value: 'Firewall Rulebase', label: 'Firewall Rulebase' },
                      { value: 'VPN Security', label: 'VPN Security' },
                      { value: 'Network Segmentation', label: 'Network Segmentation' }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Description / Observation Details</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the physical observation or procedural gap..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Recommended Remediation Action</label>
                <input
                  type="text"
                  placeholder="e.g. Install biometric access lock and log visitor entry."
                  value={manualRec}
                  onChange={(e) => setManualRec(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Observation & Recalculate Score</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
