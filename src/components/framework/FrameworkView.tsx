'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Terminal, 
  Wrench, 
  FileText,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { AuditFrameworkResult, EvaluatedFrameworkControl, MappedRuleEvidence, ControlStatus } from '@/lib/types/framework';

interface FrameworkViewProps {
  result: AuditFrameworkResult;
}

export const FrameworkView: React.FC<FrameworkViewProps> = ({ result }) => {
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: ControlStatus, coverageType: string) => {
    if (coverageType === 'manual') {
      return (
        <span className="pill" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 700, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} /> Needs Review (Manual Audit)
        </span>
      );
    }
    if (coverageType === 'not_covered') {
      return (
        <span className="pill" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Info size={12} /> Outside Config Scope
        </span>
      );
    }
    if (status === 'Compliant') {
      return (
        <span className="pill" style={{ background: 'rgba(22,163,74,0.15)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.3)', fontWeight: 700, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} /> Compliant
        </span>
      );
    }
    if (status === 'Non-Compliant') {
      return (
        <span className="pill" style={{ background: 'rgba(225,29,72,0.15)', color: 'var(--red)', border: '1px solid rgba(225,29,72,0.3)', fontWeight: 700, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ShieldAlert size={12} /> Non-Compliant
        </span>
      );
    }
    if (status === 'Needs Review') {
      return (
        <span className="pill" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--cyan-d)', border: '1px solid rgba(6,182,212,0.3)', fontWeight: 700, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <HelpCircle size={12} /> Pending Confirmation
        </span>
      );
    }
    return (
      <span className="pill" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 11.5 }}>
        N/A
      </span>
    );
  };

  // Group controls by category
  const groupedControls = result.controls.reduce((acc, ctrl) => {
    const cat = ctrl.category || 'General Controls';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ctrl);
    return acc;
  }, {} as Record<string, EvaluatedFrameworkControl[]>);

  const manualCount = result.controls.filter(c => c.coverage_type === 'manual').length;
  const notCoveredCount = result.controls.filter(c => c.coverage_type === 'not_covered').length;
  const assessableCount = result.covered_controls;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      {/* Honest Coverage Banner & Scorecard */}
      <div className="card" style={{ padding: '24px 28px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              <ShieldCheck size={18} /> Derived Crosswalk Evaluation Statement
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              {result.framework_name}
            </h2>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
              <b>Honest Coverage Disclosure:</b> <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{result.coverage_percent}%</span> of framework controls ({assessableCount} of {result.total_controls}) can be evaluated automatically from firewall configuration directives. 
              The remaining controls require manual governance audit ({manualCount} controls) or fall outside network config scope ({notCoveredCount} controls).
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                Automated / Partial: <b style={{ color: 'var(--green)' }}>{assessableCount}</b>
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.15)', borderRadius: '8px', fontSize: 12, fontWeight: 600, color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                Manual Verification Required: <b>{manualCount}</b>
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                Outside Scope: <b>{notCoveredCount}</b>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '20px 28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: result.score >= 80 ? 'var(--green)' : result.score >= 60 ? '#fbbf24' : '#f43f5e' }}>
                {result.score}%
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Derived Score</div>
              <small style={{ fontSize: 10, color: '#64748b' }}>(Over {assessableCount} Assessable Controls)</small>
            </div>
            <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--cyan)' }}>
                {result.coverage_percent}%
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Automated Coverage</div>
              <small style={{ fontSize: 10, color: '#64748b' }}>({assessableCount} / {result.total_controls} Controls)</small>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Grid */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Domain & Function Adherence Breakdown</h3>
        <div className="grid-3" style={{ gap: 16 }}>
          {result.category_breakdown.map((cat, idx) => (
            <div key={idx} className="card" style={{ padding: '16px 18px' }}>
              <div className="flex-row" style={{ marginBottom: 8 }}>
                <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>{cat.category}</b>
                <span style={{ fontSize: 13, fontWeight: 800, color: cat.score >= 80 ? 'var(--green)' : cat.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                  {cat.score}<small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>%</small>
                </span>
              </div>
              <div className="bar-track" style={{ height: 6, marginBottom: 8 }}>
                <div className="bar-fill" style={{ width: `${cat.score}%`, background: cat.score >= 80 ? 'var(--green)' : cat.score >= 60 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
                <span>Passed: <b style={{ color: 'var(--green)' }}>{cat.passed}</b> / {cat.total}</span>
                {cat.needs_review > 0 && <span style={{ color: 'var(--amber)' }}>Manual: {cat.needs_review}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls List grouped by Category */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Detailed Framework Controls & Crosswalk Mapping</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Click any control row to expand mapped CIS rules, configuration evidence, verification steps, and remediation commands</p>
        </div>

        <div>
          {Object.entries(groupedControls).map(([categoryName, controls]) => (
            <div key={categoryName}>
              <div style={{ padding: '12px 24px', background: 'var(--slate)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{categoryName}</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                  {controls.length} Controls
                </span>
              </div>

              {controls.map((ctrl) => {
                const isExp = expandedControl === ctrl.control_code;
                return (
                  <div key={ctrl.control_code} style={{ borderBottom: '1px solid var(--line)' }}>
                    {/* Control Row Header */}
                    <div
                      onClick={() => setExpandedControl(isExp ? null : ctrl.control_code)}
                      style={{
                        padding: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExp ? 'var(--bg)' : '#fff',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, paddingRight: 20 }}>
                        <div style={{ paddingTop: 2 }}>
                          {isExp ? <ChevronDown size={18} style={{ color: 'var(--cyan-d)' }} /> : <ChevronRight size={18} style={{ color: 'var(--muted)' }} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)', background: 'rgba(15,23,42,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                              {ctrl.control_code}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                              {ctrl.title}
                            </span>
                          </div>
                          {ctrl.guidance && (
                            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                              {ctrl.guidance}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        {ctrl.coverage_type !== 'manual' && ctrl.coverage_type !== 'not_covered' && (
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                            Mapped CIS Rules: <b>{ctrl.mapped_rules.length}</b> ({ctrl.passed_count} Pass / <span style={{ color: ctrl.failed_count > 0 ? 'var(--red)' : 'inherit' }}>{ctrl.failed_count} Fail</span>)
                          </span>
                        )}
                        {getStatusBadge(ctrl.status, ctrl.coverage_type)}
                      </div>
                    </div>

                    {/* Expanded Drawer */}
                    {isExp && (
                      <div style={{ padding: '20px 24px 24px 56px', background: 'var(--bg)', borderTop: '1px dashed var(--line)' }}>
                        {ctrl.coverage_type === 'manual' || ctrl.coverage_type === 'not_covered' ? (
                          <div style={{ padding: '16px', background: '#fff', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', gap: 12 }}>
                            <AlertCircle size={20} style={{ color: ctrl.coverage_type === 'manual' ? 'var(--amber)' : 'var(--muted)', flexShrink: 0 }} />
                            <div>
                              <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>
                                {ctrl.coverage_type === 'manual' ? 'Manual Governance Verification Required' : 'Control Outside Configuration Audit Scope'}
                              </b>
                              <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 4, lineHeight: 1.5 }}>
                                {ctrl.guidance || 'This control evaluates organizational processes or non-network controls and cannot be automated from firewall configuration files.'}
                              </p>
                            </div>
                          </div>
                        ) : ctrl.mapped_rules.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                            No active CIS rules are mapped to this control in the current configuration profile.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Supporting Technical CIS Rules & Verification Evidence
                            </h4>

                            {ctrl.mapped_rules.map((rule) => (
                              <div key={rule.rule_id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--line)', padding: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span className="mono" style={{ fontSize: 12, fontWeight: 800, background: 'var(--navy)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                                        CIS {rule.rule_code}
                                      </span>
                                      <b style={{ fontSize: 14, color: 'var(--navy)' }}>{rule.title}</b>
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                      Severity: <b style={{ color: rule.severity === 'Critical' ? 'var(--crit)' : rule.severity === 'High' ? 'var(--high)' : 'var(--med)' }}>{rule.severity}</b>
                                    </span>
                                  </div>
                                  <div>
                                    {rule.status === 'open' && rule.penalty_score > 0 ? (
                                      <span className="pill" style={{ background: 'rgba(225,29,72,0.15)', color: 'var(--red)', border: '1px solid rgba(225,29,72,0.3)', fontWeight: 700, fontSize: 11 }}>
                                        Violation (Fail)
                                      </span>
                                    ) : rule.status === 'pending_confirmation' ? (
                                      <span className="pill" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--cyan-d)', border: '1px solid rgba(6,182,212,0.3)', fontWeight: 700, fontSize: 11 }}>
                                        Pending Confirmation
                                      </span>
                                    ) : (
                                      <span className="pill" style={{ background: 'rgba(22,163,74,0.15)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.3)', fontWeight: 700, fontSize: 11 }}>
                                        Compliant (Pass)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {rule.description && (
                                  <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14, lineHeight: 1.5 }}>
                                    {rule.description}
                                  </p>
                                )}

                                {/* Evidence Snippet if failed */}
                                {rule.status === 'open' && rule.evidence_snippet && (
                                  <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                                      Configuration Evidence Snippet
                                    </div>
                                    <pre style={{ background: '#0f172a', color: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: 12, fontFamily: 'monospace', overflowX: 'auto', border: '1px solid #334155' }}>
                                      {rule.evidence_snippet}
                                    </pre>
                                  </div>
                                )}

                                {/* Verification / Remediation terminal box */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                  {/* Audit Procedure */}
                                  <div style={{ background: '#1e293b', color: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cyan)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                                        <Terminal size={14} /> Audit Procedure
                                      </div>
                                      <pre style={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, color: '#e2e8f0', margin: 0 }}>
                                        {rule.audit_procedure || 'Run get system status in FortiGate CLI.'}
                                      </pre>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(rule.audit_procedure || '', `audit-${rule.rule_id}`, e)}
                                      style={{ alignSelf: 'flex-end', marginTop: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      {copiedId === `audit-${rule.rule_id}` ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                                      {copiedId === `audit-${rule.rule_id}` ? 'Copied' : 'Copy Command'}
                                    </button>
                                  </div>

                                  {/* Remediation Procedure */}
                                  <div style={{ background: '#1e293b', color: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                                        <Wrench size={14} /> Remediation Procedure
                                      </div>
                                      <pre style={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, color: '#e2e8f0', margin: 0 }}>
                                        {rule.remediation_procedure || rule.remediation || 'Configure compliant parameters via CLI.'}
                                      </pre>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(rule.remediation_procedure || rule.remediation || '', `rem-${rule.rule_id}`, e)}
                                      style={{ alignSelf: 'flex-end', marginTop: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      {copiedId === `rem-${rule.rule_id}` ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                                      {copiedId === `rem-${rule.rule_id}` ? 'Copied' : 'Copy Command'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
