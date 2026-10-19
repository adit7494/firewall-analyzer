'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft, 
  FileText, 
  Code, 
  Save, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle,
  MessageSquare,
  Building2,
  Server,
  Copy,
  Check,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { getAuditById, getCompanyById, getAudits, updateFindingStatus } from '@/app/actions/data';
import { Finding, AuditResult, FindingStatus, Company } from '@/lib/types/audit';
import { RULES_CATALOG } from '@/lib/engine/rules-catalog';
import { normalizeRuleId } from '@/lib/engine/rule-utils';

function FindingDetailContent({ findingId }: { findingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get('audit') || '';
  
  const [audit, setAudit] = useState<AuditResult | undefined>(undefined);
  const [finding, setFinding] = useState<Finding | undefined>(undefined);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Editable state
  const [status, setStatus] = useState<FindingStatus>('open');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyRemediation = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function loadData() {
      let targetAudit = await getAuditById(auditId);
      if (!targetAudit) {
        // Find audit that contains this finding ID
        const allAudits = await getAudits();
        targetAudit = allAudits.find(a => a.findings.some(f => f.id === findingId)) || null;
      }

      if (targetAudit) {
        setAudit(targetAudit);
        let targetFinding = targetAudit.findings.find(f => f.id === findingId);
        if (!targetFinding) {
          const rule = RULES_CATALOG.find(r => r.id === findingId);
          if (rule) {
            targetFinding = {
              id: rule.id,
              audit_id: targetAudit.id,
              rule_id: rule.id,
              title: rule.title,
              description: rule.rationale || '',
              category: rule.category,
              severity: rule.severity,
              compliance_tags: rule.compliance_tags || [],
              status: 'resolved',
              is_manual: false,
              created_at: targetAudit.created_at,
              penalty_score: 0
            } as Finding;
          }
        }

        if (targetFinding) {
          let lookupId = targetFinding.rule_id || targetFinding.cis_code || '';
          if ((lookupId === 'CIS-3.4' || lookupId === '3.4') && (targetFinding.title.toLowerCase().includes('snmp') || targetFinding.category === 'SNMP')) {
            lookupId = 'CIS-2.3.4';
          }
          const normId = normalizeRuleId(lookupId);
          const details = RULES_CATALOG.find(r => normalizeRuleId(r.id) === normId || normalizeRuleId(r.code) === normId);
          let enrichedFinding: Finding = { ...(details as Partial<Finding>), ...targetFinding };
          
          if (details) {
            // Ensure catalog's remediation, audit guidance, and impact are populated if finding lacks them
            enrichedFinding.rationale = targetFinding.rationale || details.rationale;
            enrichedFinding.impact = targetFinding.impact || details.impact;
            enrichedFinding.remediation = targetFinding.remediation || details.remediation;
            enrichedFinding.remediation_procedure = targetFinding.remediation_procedure || details.remediation_procedure;
            enrichedFinding.audit_procedure = targetFinding.audit_procedure || details.audit_procedure;
            enrichedFinding.audit_hint = targetFinding.audit_hint || details.audit_hint;
            enrichedFinding.expected_value = targetFinding.expected_value || details.expected_value;
          }

          setFinding(enrichedFinding);
          setStatus(enrichedFinding.status);
          setNote(enrichedFinding.auditor_note || '');
        }
        const c = await getCompanyById(targetAudit.company_id);
        if (c) setCompany(c);
      }
      setIsLoaded(true);
    }
    loadData();
  }, [auditId, findingId]);

  if (!isLoaded) return <div className="p-8 text-slate-500">Loading finding remediation workspace...</div>;
  if (!finding || !audit) {
    return (
      <div className="card p-8 text-center">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Finding Reference Not Found</h3>
        <button type="button" className="btn btn-ghost" onClick={() => router.push(audit ? `/audit/${audit.id}` : '/audit/results')}>
          <ArrowLeft size={16} /> Back to Audit Assessment
        </button>
      </div>
    );
  }

  const handleSaveStatus = async (newStatus: FindingStatus) => {
    setStatus(newStatus);
    setIsSaving(true);
    const updatedAudit = await updateFindingStatus(audit.id, finding.id, newStatus, note);
    if (updatedAudit) {
      setAudit({ ...updatedAudit });
      const upd = updatedAudit.findings.find(f => f.id === finding.id);
      if (upd) setFinding({ ...upd });
    }
    setSaveMsg(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}! Score recalculated to ${updatedAudit?.score || audit.score}/100.`);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMsg('');
    }, 3000);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updatedAudit = await updateFindingStatus(audit.id, finding.id, status, note);
    if (updatedAudit) {
      setAudit({ ...updatedAudit });
    }
    setSaveMsg('Auditor remediation notes saved successfully.');
    setTimeout(() => {
      setIsSaving(false);
      setSaveMsg('');
    }, 2500);
  };

  const getSevColor = (sev: string) => {
    if (sev === 'Critical') return 'var(--crit)';
    if (sev === 'High') return 'var(--high)';
    if (sev === 'Medium') return 'var(--med)';
    return 'var(--low)';
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '1000px', margin: '0 auto' }}>
      {/* Back Bar */}
      <div className="flex-row">
        <button 
          type="button" 
          className="btn btn-ghost"
          onClick={() => router.push(`/audit/${audit.id}`)}
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Back to {audit.config_file_name} Assessment
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="pill pill-vendor">{audit.vendor} Parser</span>
          <span className={`grade-badge grade-${audit.grade.toLowerCase()}`}>
            Audit Grade: {audit.grade} ({audit.score}/100)
          </span>
        </div>
      </div>

      {saveMsg && (
        <div className="animate-fade-in" style={{ padding: '14px 20px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 13.5 }}>
          <CheckCircle2 size={18} /> {saveMsg}
        </div>
      )}

      {/* Main Grid: Finding Info vs Status Changer */}
      <div className="grid-60-40" style={{ gap: 24 }}>
        {/* Left Column: Title, Description, Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ borderLeft: `6px solid ${getSevColor(finding.severity)}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>
                {finding.rule_id}
              </span>
              <span className={`pill ${finding.severity === 'Critical' ? 'pill-crit' : finding.severity === 'High' ? 'pill-high' : 'pill-med'}`}>
                {finding.severity} Severity
              </span>
              <span className="tag">{finding.category}</span>
            </div>

            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 12, lineHeight: 1.3 }}>
              {finding.title}
            </h1>

            <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.7, marginBottom: (finding.rationale || finding.impact) ? 14 : 20 }}>
              {finding.description}
            </p>

            {(finding.rationale || finding.impact) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: 20 }}>
                {finding.rationale && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', marginBottom: 4 }}>Security Rationale</div>
                    <div style={{ fontSize: 13.5, color: 'var(--slate)', lineHeight: 1.6 }}>{finding.rationale}</div>
                  </div>
                )}
                {finding.impact && (
                  <div style={{ borderTop: finding.rationale ? '1px dashed var(--line)' : 'none', paddingTop: finding.rationale ? 10 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>Potential Impact / Exploitability</div>
                    <div style={{ fontSize: 13.5, color: 'var(--slate)', lineHeight: 1.6 }}>{finding.impact}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginRight: 4, display: 'flex', alignItems: 'center' }}>Compliance Standards:</span>
              {finding.compliance_tags.map((tag, idx) => (
                <span key={idx} className="tag" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', fontWeight: 700 }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Evidence Snippet Code Block */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--navy2)' }}>
            <div style={{ background: 'var(--navy)', color: '#cbd5e1', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#fff' }}>
                <Code size={16} color="var(--cyan)" />
                <span>Raw Configuration Evidence Code Snippet</span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted2)' }}>{audit.config_file_name}</span>
            </div>

            <div className="mono" style={{ background: '#0f172a', color: '#f8fafc', padding: '20px', fontSize: 13, lineHeight: 1.7, overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {finding.evidence_snippet || `# Automated extraction from configuration file:\nconfig system settings\n    # Identified violation snippet matching rule criteria\nend`}
              </pre>
            </div>
          </div>

          {/* Audit Procedure */}
          {(finding.audit_procedure || finding.audit_hint) && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--navy2)' }}>
              <div style={{ background: '#1e293b', color: '#cbd5e1', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                  <Terminal size={17} color="var(--cyan)" />
                  <span>Verification & Audit Procedure</span>
                </div>
                <span className="pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }}>CLI / GUI Verification</span>
              </div>
              <div className="mono" style={{ background: '#0f172a', color: '#f8fafc', padding: '20px', fontSize: 13, lineHeight: 1.7, overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                  {finding.audit_procedure || finding.audit_hint}
                </pre>
              </div>
            </div>
          )}

          {/* Remediation Procedure */}
          {(finding.remediation_procedure || finding.remediation || finding.recommendation) && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #16a34a' }}>
              <div style={{ background: '#15803d', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                  <ShieldCheck size={17} color="#fff" />
                  <span>Technical Fix & Remediation Procedure</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyRemediation(finding.remediation_procedure || finding.remediation || finding.recommendation)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 12px', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Commands'}
                </button>
              </div>
              <div className="mono" style={{ background: '#064e3b', color: '#ecfdf5', padding: '20px', fontSize: 13, lineHeight: 1.7, overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                  {finding.remediation_procedure || finding.remediation || finding.recommendation}
                </pre>
              </div>
            </div>
          )}

          {/* CIS Benchmark Metadata & Specifications Card */}
          {(finding.cis_code || finding.cis_level || finding.config_key || finding.expected_value || finding.audit_hint) && (
            <div className="card" style={{ border: '1px solid rgba(6,182,212,0.3)', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={18} color="var(--cyan-d)" /> CIS Benchmark Audit Specifications
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {finding.cis_level && (
                    <span className="pill" style={{ background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      CIS {finding.cis_level} Profile
                    </span>
                  )}
                  {finding.system_check && (
                    <span className="pill" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', fontSize: 11, fontWeight: 700 }}>
                      {finding.system_check.toUpperCase()} Evaluation
                    </span>
                  )}
                </div>
              </div>

              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>CIS Code / Section</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>
                    {finding.cis_code ? `CIS ${finding.cis_code}` : 'N/A'} — {finding.cis_section || finding.category}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Target Config Key</div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', background: '#fff', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', display: 'inline-block' }}>
                    {finding.config_key || 'Standard Policy'}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 4 }}>Expected Compliant Value</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    {finding.expected_value || 'Compliant configuration setting required'}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>Default Vendor Value</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)' }}>
                    {finding.default_value || 'Factory default setting'}
                  </div>
                </div>
              </div>

              {finding.cis_controls && finding.cis_controls.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>CIS Controls Mapping:</span>
                  {finding.cis_controls.map((ctrl, idx) => (
                    <span key={idx} className="tag" style={{ background: '#fff', color: 'var(--navy)', border: '1px solid var(--line)', fontWeight: 600 }}>
                      Control {ctrl}
                    </span>
                  ))}
                </div>
              )}

              {/* References */}
              {((finding.references_json && finding.references_json.length > 0) || (finding.references && finding.references.length > 0)) && (
                <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', marginBottom: 8 }}>External References & Vendor Documentation:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(finding.references_json || finding.references || []).map((refUrl, idx) => (
                      <a
                        key={idx}
                        href={refUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12.5, color: 'var(--cyan-d)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', wordBreak: 'break-all' }}
                      >
                        <ExternalLink size={14} /> {refUrl}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommendation */}
          <div className="card" style={{ background: 'var(--cyan-light)', borderColor: 'rgba(6,182,212,0.3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--cyan-d)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} /> Recommended Remediation Action Plan
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--navy)', lineHeight: 1.6, fontWeight: 500 }}>
              {finding.remediation || finding.recommendation}
            </p>
          </div>
        </div>

        {/* Right Column: Status Changer & Auditor Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>Remediation Status Workflow</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
              Changing status to Accepted Risk, False Positive, or Resolved immediately removes penalty deductions and recalculates audit grade.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => handleSaveStatus('open')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${status === 'open' ? 'var(--crit)' : 'var(--line)'}`,
                  background: status === 'open' ? 'var(--crit-bg)' : '#fff',
                  color: status === 'open' ? 'var(--crit)' : 'var(--slate)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Open (Active Violation)</b>
                  <small style={{ opacity: 0.8, fontSize: 11 }}>Applies full -{finding.penalty_score} pts penalty deduction</small>
                </div>
                {status === 'open' && <CheckCircle2 size={20} />}
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('accepted_risk')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${status === 'accepted_risk' ? '#d97706' : 'var(--line)'}`,
                  background: status === 'accepted_risk' ? 'var(--med-bg)' : '#fff',
                  color: status === 'accepted_risk' ? '#b45309' : 'var(--slate)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Accepted Risk</b>
                  <small style={{ opacity: 0.8, fontSize: 11 }}>Business justification approved; penalty waived</small>
                </div>
                {status === 'accepted_risk' && <CheckCircle2 size={20} />}
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('false_positive')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${status === 'false_positive' ? 'var(--info)' : 'var(--line)'}`,
                  background: status === 'false_positive' ? 'var(--info-bg)' : '#fff',
                  color: status === 'false_positive' ? 'var(--info)' : 'var(--slate)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>False Positive</b>
                  <small style={{ opacity: 0.8, fontSize: 11 }}>Compensating control identified; penalty waived</small>
                </div>
                {status === 'false_positive' && <CheckCircle2 size={20} />}
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('resolved')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${status === 'resolved' ? 'var(--green)' : 'var(--line)'}`,
                  background: status === 'resolved' ? 'var(--green-bg)' : '#fff',
                  color: status === 'resolved' ? 'var(--green)' : 'var(--slate)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'left'
                }}
              >
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Resolved / Remediated</b>
                  <small style={{ opacity: 0.8, fontSize: 11 }}>Configuration corrected on device; penalty waived</small>
                </div>
                {status === 'resolved' && <CheckCircle2 size={20} />}
              </button>
            </div>
          </div>

          {/* Auditor Notes Input */}
          <form onSubmit={handleSaveNote} className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} /> Auditor Justification Notes
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
              Required for ITIL compliance when marking findings as Accepted Risk or False Positive.
            </p>

            <textarea
              rows={5}
              placeholder="Enter ticket ID, compensating controls, or engineering justification here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                fontSize: 13.5,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                marginBottom: 12
              }}
            />

            <button
              type="submit"
              className="btn btn-dark"
              style={{ width: '100%', padding: '12px', fontSize: 13.5 }}
              disabled={isSaving}
            >
              <Save size={16} /> Save Auditor Notes
            </button>
          </form>

          {/* Tenant summary */}
          <div className="card" style={{ background: 'var(--bg)', padding: '18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Audit Context</div>
            <div style={{ fontSize: 13, color: 'var(--txt)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span><b>Client Tenant:</b> {company?.name || 'Unknown'}</span>
              <span><b>Config Backup:</b> {audit.config_file_name}</span>
              <span><b>Audited By:</b> {audit.created_by}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading finding details...</div>}>
      <FindingDetailContent findingId={resolvedParams.id} />
    </Suspense>
  );
}
