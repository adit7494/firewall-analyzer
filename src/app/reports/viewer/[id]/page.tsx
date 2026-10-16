'use client';

import React, { useEffect, useState, use, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Building2, 
  Server, 
  Calendar, 
  User, 
  FileText,
  Share2,
  Trash2
} from 'lucide-react';
import { getReportById, getAuditById, getCompanyById, deleteReport } from '@/app/actions/data';
import { ScoringEngine } from '@/lib/engine/scoring-engine';
import { Report, AuditResult, Company } from '@/lib/types/audit';
import { getRuleDetailsByCodeOrId } from '@/lib/engine/cis-seed-importer';
import { FrameworkLensSwitcher } from '@/components/framework/FrameworkLensSwitcher';
import { FrameworkCode } from '@/lib/types/framework';
import { evaluateAuditFrameworks, getFrameworkResultByCode } from '@/lib/engine/framework-evaluator';

function ReportViewerContent({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | undefined>(undefined);
  const [audit, setAudit] = useState<AuditResult | undefined>(undefined);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<FrameworkCode>('CIS');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      const rep = await getReportById(reportId);
      if (rep) {
        setReport(rep);
        const aud = rep.snapshot || await getAuditById(rep.audit_id);
        if (aud) setAudit(aud);
        const c = await getCompanyById(rep.company_id);
        if (c) setCompany(c);
      }
      setIsLoaded(true);
    }
    loadData();
  }, [reportId]);

  if (!isLoaded) return <div className="p-8 text-slate-500">Loading report snapshot...</div>;
  if (!report || !audit) {
    return (
      <div className="card p-8 text-center">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Report Snapshot Not Found</h3>
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/reports')}>
          <ArrowLeft size={16} /> Back to Reports Directory
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Firewall_Report_${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!report) return;
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    await deleteReport(report.id);
    router.push('/reports');
  };

  const handleExportDOCX = () => {
    if (!report || !audit) return;
    
    // MS Word supports basic HTML with tables, inline styles, and limited CSS.
    // To make it look "100% exact", we generate a dedicated Word-compatible HTML string.
    
    const openFindingsWord = audit.findings.filter(f => f.status === 'open');
    const critCountWord = openFindingsWord.filter(f => f.severity === 'Critical').length;
    const highCountWord = openFindingsWord.filter(f => f.severity === 'High').length;
    const medCountWord = openFindingsWord.filter(f => f.severity === 'Medium').length;
    const passedCountWord = audit.findings.filter(f => f.status === 'resolved' || f.status === 'accepted_risk').length;
    const breakdown = audit.breakdown || [];

    let findingsHtml = '';
    if (openFindingsWord.length === 0) {
      findingsHtml = `<p style="color: #16a34a; font-weight: bold; text-align: center;">All identified findings have been resolved or remediated! Zero open compliance gaps remain.</p>`;
    } else {
      findingsHtml = openFindingsWord.map(f => {
        const details = getRuleDetailsByCodeOrId(f.cis_code || f.rule_id);
        const ef = { ...(details as Partial<typeof f>), ...f };
        const sevColor = ef.severity === 'Critical' ? '#e11d48' : ef.severity === 'High' ? '#ea580c' : '#d97706';
        const sevBg = ef.severity === 'Critical' ? '#ffe4e6' : ef.severity === 'High' ? '#ffedd5' : '#fef3c7';
        
        let technicalData = '';
        if (report.type === 'Technical') {
          if (ef.evidence_snippet) {
            technicalData += `<div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 10px;">CONFIGURATION EVIDENCE:</div>
            <div style="background-color: #0f172a; color: #f8fafc; padding: 10px; font-family: monospace; font-size: 11px;">${ef.evidence_snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          }
          if (ef.remediation_procedure || ef.remediation || ef.recommendation) {
             technicalData += `<div style="font-size: 11px; font-weight: bold; color: #16a34a; margin-top: 10px;">REMEDIATION PROCEDURE:</div>
            <div style="background-color: #064e3b; color: #ecfdf5; padding: 10px; font-family: monospace; font-size: 11px;">${(ef.remediation_procedure || ef.remediation || ef.recommendation).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          }
        }

        return `
          <div style="border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 15px; background-color: #f8fafc;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-weight: bold; color: #0f172a; font-size: 14px;">
                  [${ef.rule_id}] ${ef.title}
                </td>
                <td align="right" width="150">
                  <span style="background-color: ${sevBg}; color: ${sevColor}; padding: 4px 8px; font-size: 12px; font-weight: bold; border: 1px solid ${sevColor};">${ef.severity} (-${ef.penalty_score} pts)</span>
                </td>
              </tr>
            </table>
            <p style="font-size: 13px; color: #475569; margin: 10px 0;">${ef.description}</p>
            ${technicalData}
            <div style="background-color: #ffffff; padding: 10px; border: 1px solid #e2e8f0; margin-top: 10px;">
              <strong style="color: #0891b2; font-size: 12px;">Recommended Action Plan:</strong>
              <div style="font-size: 13px; color: #0f172a; margin-top: 4px;">${ef.remediation || ef.recommendation}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Firewall Audit Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #334155; }
          h1, h2, h3 { color: #0f172a; }
          table { border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div style="border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top">
                <div style="color: #0891b2; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 10px;">
                  Formal Firewall Compliance Audit Report
                </div>
                <h1 style="font-size: 24px; margin: 0 0 10px 0;">${report.type} Assessment: ${report.company_name}</h1>
                <p style="font-size: 14px; color: #64748b; margin: 0;">
                  Appliance Gateway: <b>${report.device_name}</b> (${audit.vendor} Parser Engine) • Ref: <span style="font-family: monospace;">${report.id}</span>
                </p>
              </td>
              <td align="right" valign="top">
                <div style="background-color: ${report.score >= 80 ? '#16a34a' : report.score >= 60 ? '#d97706' : '#dc2626'}; color: #ffffff; font-size: 24px; font-weight: bold; padding: 10px 20px; display: inline-block; margin-bottom: 5px;">
                  Grade ${report.grade}
                </div>
                <div style="font-size: 14px; font-weight: bold; color: #475569;">
                  Overall Score: ${report.score}/100
                </div>
              </td>
            </tr>
          </table>
        </div>

        <table width="100%" cellpadding="15" cellspacing="0" border="1" bordercolor="#e2e8f0" style="background-color: #f8fafc; margin-bottom: 30px;">
          <tr>
            <td width="25%" valign="top">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Target Client Tenant</span><br/>
              <b style="font-size: 14px; color: #0f172a;">${company?.name || report.company_name}</b>
            </td>
            <td width="25%" valign="top">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Configuration File</span><br/>
              <b style="font-size: 13px; color: #0f172a; font-family: monospace;">${audit.config_file_name}</b>
            </td>
            <td width="25%" valign="top">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Evaluation Date</span><br/>
              <b style="font-size: 13px; color: #0f172a;">${new Date(report.created_at).toLocaleDateString()}</b>
            </td>
            <td width="25%" valign="top">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Lead Auditor</span><br/>
              <b style="font-size: 13px; color: #0f172a;">${audit.created_by}</b>
            </td>
          </tr>
        </table>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">1. Executive Posture Summary</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
          This ${report.type.toLowerCase()} report presents the security posture evaluation of the firewall configuration backup retrieved from ${report.device_name}. 
          The audit engine evaluated ${audit.rules_analyzed} core CIS and NIST security rules across 6 security domains. 
          The system achieved an overall security grade of <b>${report.grade} (${report.score}/100)</b> with <b>${openFindingsWord.length} open security findings</b> requiring remediation.
        </p>

        <table width="100%" cellpadding="15" cellspacing="10" border="0" style="margin-bottom: 30px;">
          <tr>
            <td width="25%" align="center" style="background-color: #ffe4e6; border: 1px solid #fda4af;">
              <div style="font-size: 28px; font-weight: bold; color: #e11d48;">${critCountWord}</div>
              <div style="font-size: 12px; font-weight: bold; color: #e11d48;">Critical Violations</div>
            </td>
            <td width="25%" align="center" style="background-color: #ffedd5; border: 1px solid #fdba74;">
              <div style="font-size: 28px; font-weight: bold; color: #ea580c;">${highCountWord}</div>
              <div style="font-size: 12px; font-weight: bold; color: #ea580c;">High Severity</div>
            </td>
            <td width="25%" align="center" style="background-color: #fef3c7; border: 1px solid #fcd34d;">
              <div style="font-size: 28px; font-weight: bold; color: #d97706;">${medCountWord}</div>
              <div style="font-size: 12px; font-weight: bold; color: #d97706;">Medium Severity</div>
            </td>
            <td width="25%" align="center" style="background-color: #dcfce7; border: 1px solid #86efac;">
              <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${passedCountWord}</div>
              <div style="font-size: 12px; font-weight: bold; color: #16a34a;">Remediated / Waived</div>
            </td>
          </tr>
        </table>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">2. Security Domain Score Breakdown</h2>
        <table width="100%" cellpadding="10" cellspacing="0" border="1" bordercolor="#e2e8f0" style="margin-bottom: 40px;">
          <tr style="background-color: #f8fafc; font-weight: bold; text-align: left; color: #0f172a;">
            <th>Security Domain</th>
            <th>Posture Score</th>
            <th>Compliance Grade</th>
            <th>Domain Status</th>
          </tr>
          ${breakdown.map(b => `
          <tr>
            <td><b>${b.category}</b></td>
            <td><b>${b.score}/100</b></td>
            <td><span style="color: ${b.score >= 90 ? '#16a34a' : b.score >= 75 ? '#84cc16' : b.score >= 60 ? '#d97706' : '#dc2626'}; font-weight: bold;">Grade ${b.score >= 90 ? 'A' : b.score >= 75 ? 'B' : b.score >= 60 ? 'C' : 'D'}</span></td>
            <td><span style="color: ${b.score >= 80 ? '#16a34a' : '#dc2626'}; font-weight: bold;">${b.score >= 80 ? 'Compliant & Hardened' : 'Requires Remediation'}</span></td>
          </tr>
          `).join('')}
        </table>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">3. ${report.type === 'Technical' ? 'Technical Findings & Code Evidence' : 'Key Security Risks & Recommendations'}</h2>
        ${findingsHtml}

        <br/><hr style="border: 0; border-top: 1px solid #e2e8f0;"/><br/>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #64748b;">
          <tr>
            <td><b>Firewall Audit Analyzer Platform v1.0</b> • Air-Gapped Compliance Verification</td>
            <td align="right">Report Finalized & Signed by: <b style="color: #0f172a;">${audit.created_by}</b></td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Firewall_Report_${report.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Rule ID', 'Title', 'Severity', 'Status', 'CIS Code', 'CIS Level', 'System Check', 'Expected Value', 'Default Value', 'Penalty Score', 'Recommendation', 'Rationale', 'Audit Procedure', 'Remediation Procedure', 'References'];
    const rows = audit.findings.map(f => {
      const details = getRuleDetailsByCodeOrId(f.cis_code || f.rule_id);
      const ef = { ...(details as Partial<typeof f>), ...f };
      const refs = ef.references_json || ef.references || [];
      return [
        `"${ef.rule_id}"`,
        `"${ef.title.replace(/"/g, '""')}"`,
        `"${ef.severity}"`,
        `"${ef.status}"`,
        `"${ef.cis_code || ''}"`,
        `"${ef.cis_level || ''}"`,
        `"${ef.system_check || ''}"`,
        `"${(ef.expected_value || '').replace(/"/g, '""')}"`,
        `"${(ef.default_value || '').replace(/"/g, '""')}"`,
        ef.penalty_score,
        `"${(ef.remediation || ef.recommendation || '').replace(/"/g, '""')}"`,
        `"${(ef.rationale || '').replace(/"/g, '""')}"`,
        `"${(ef.audit_procedure || ef.audit_hint || '').replace(/"/g, '""')}"`,
        `"${(ef.remediation_procedure || ef.remediation || ef.recommendation || '').replace(/"/g, '""')}"`,
        `"${refs.join('; ').replace(/"/g, '""')}"`
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CIS_Audit_Report_${report.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMsg('CIS Compliance CSV Report (with full metadata) downloaded successfully!');
    setTimeout(() => setExportMsg(''), 3500);
  };

  const openFindings = audit.findings.filter(f => f.status === 'open');
  const critCount = openFindings.filter(f => f.severity === 'Critical').length;
  const highCount = openFindings.filter(f => f.severity === 'High').length;
  const medCount = openFindings.filter(f => f.severity === 'Medium').length;
  const scoreBreakdown = audit.score_breakdown || ScoringEngine.calculateScore(audit.findings).score_breakdown;

  const fwResults = evaluateAuditFrameworks(audit);
  const activeFwResult = getFrameworkResultByCode(fwResults, selectedFramework);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '960px', margin: '0 auto' }}>
      {/* Top Action Bar (hidden on print) */}
      <div className="flex-row print-hidden" style={{ background: '#fff', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
        <button 
          type="button" 
          className="btn btn-ghost"
          onClick={() => router.push('/reports')}
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Back to Reports Directory
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            type="button" 
            className="btn btn-ghost"
            onClick={handleExportCSV}
            style={{ fontSize: 13, borderColor: 'var(--cyan)', color: 'var(--cyan-d)' }}
          >
            <Download size={15} /> Export CSV (CIS Metadata)
          </button>
          <button 
            type="button" 
            className="btn btn-ghost"
            onClick={handleExportDOCX}
            style={{ fontSize: 13 }}
          >
            <Download size={15} /> Export DOCX
          </button>
          <button 
            type="button" 
            className="btn btn-ghost"
            onClick={handleExportJSON}
            style={{ fontSize: 13 }}
          >
            <Share2 size={15} /> JSON Archive
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ fontSize: 13.5, padding: '10px 20px', boxShadow: '0 4px 12px rgba(6,182,212,0.3)' }}
          >
            <Printer size={16} /> Print / Save Formal PDF
          </button>
          <button 
            type="button" 
            className="btn btn-ghost text-red-600"
            onClick={handleDelete}
            style={{ fontSize: 13, padding: '10px' }}
            title="Delete Report"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="animate-fade-in print-hidden" style={{ padding: '14px 20px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 13.5 }}>
          <CheckCircle2 size={18} /> {exportMsg}
        </div>
      )}

      {/* Framework Lens Switcher */}
      <FrameworkLensSwitcher
        selectedFramework={selectedFramework}
        onSelect={setSelectedFramework}
      />

      {/* Printable Report Document Container */}
      <div ref={reportRef} className="card print-document" style={{ padding: '48px', background: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', borderRadius: '16px', color: '#0f172a' }}>
        {/* Document Header */}
        <div style={{ borderBottom: '3px solid var(--navy)', paddingBottom: 24, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan-d)', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              <ShieldCheck size={20} /> Formal Firewall Compliance Audit Report
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              {selectedFramework === 'CIS' ? `${report.type} Assessment` : `${activeFwResult?.framework_name} Audit Report`}: {report.company_name}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              Appliance Gateway: <b style={{ color: 'var(--txt)' }}>{report.device_name}</b> ({audit.vendor} Parser Engine) • Ref: <span className="mono">{report.id}</span>
            </p>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '10px 14px', borderRadius: '8px', marginTop: 12, fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.5 }}>
              {selectedFramework === 'CIS' ? (
                <><b>Benchmark Applicability Statement:</b> Evaluated against <b>CIS FortiGate 7.0+ Benchmark v1.2.0</b> & <b>NIST SP 800-41 Rev. 1</b> Guidelines. Applicable to standalone appliances, high-availability clusters, and multi-tenant virtual domains (VDOMs).</>
              ) : (
                <><b>Crosswalk Mapping Applicability Statement:</b> Evaluated against <b>{activeFwResult?.framework_name}</b> via technical crosswalk mapping from CIS FortiGate baseline findings. Governance and non-config controls are disclosed transparently.</>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className={`grade-badge grade-${report.grade.toLowerCase()}`} style={{ fontSize: 20, padding: '6px 18px', display: 'inline-block', marginBottom: 8 }}>
              Grade {selectedFramework === 'CIS' ? report.grade : activeFwResult && activeFwResult.score >= 90 ? 'A' : activeFwResult && activeFwResult.score >= 75 ? 'B' : activeFwResult && activeFwResult.score >= 60 ? 'C' : 'D'}
            </span>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>
              {selectedFramework === 'CIS' ? `Overall Score: ${report.score}/100` : `Derived Score: ${activeFwResult?.score}% (${activeFwResult?.coverage_percent}% Auto Coverage)`}
            </div>
          </div>
        </div>

        {/* Metadata Table */}
        <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Target Client Tenant</span>
            <b style={{ fontSize: 14, color: 'var(--navy)' }}>{company?.name || report.company_name}</b>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Configuration File</span>
            <b className="mono" style={{ fontSize: 13, color: 'var(--navy)' }}>{audit.config_file_name}</b>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Evaluation Date</span>
            <b style={{ fontSize: 13, color: 'var(--navy)' }}>{new Date(report.created_at).toLocaleDateString()}</b>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>Lead Auditor</span>
            <b style={{ fontSize: 13, color: 'var(--navy)' }}>{audit.created_by}</b>
          </div>
        </div>

        {selectedFramework === 'CIS' ? (
        <>
        {/* Section 1: Executive Summary & Scorecard */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
            1. Executive Posture Summary
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate)', marginBottom: 20 }}>
            This {report.type.toLowerCase()} report presents the security posture evaluation of the firewall configuration backup retrieved from {report.device_name}. 
            The audit engine evaluated {audit.rules_analyzed} core CIS and NIST security rules across 6 security domains. 
            The system achieved an overall security grade of <b>{report.grade} ({report.score}/100)</b> with <b>{openFindings.length} open security findings</b> requiring remediation.
          </p>

          <div className="grid-4" style={{ gap: 16 }}>
            <div style={{ padding: '16px', background: 'var(--crit-bg)', borderRadius: '10px', border: '1px solid rgba(225,29,72,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--crit)' }}>{critCount}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--crit)' }}>Critical Violations</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--high-bg)', borderRadius: '10px', border: '1px solid rgba(234,88,12,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--high)' }}>{highCount}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--high)' }}>High Severity</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--med-bg)', borderRadius: '10px', border: '1px solid rgba(217,119,6,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--med)' }}>{medCount}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--med)' }}>Medium Severity</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--green-bg)', borderRadius: '10px', border: '1px solid rgba(22,163,74,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{audit.findings.filter(f => f.status === 'resolved' || f.status === 'accepted_risk').length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Remediated / Waived</div>
            </div>
          </div>
        </div>

        {/* Section 2: CIS Benchmark Profile Adherence Summary */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
            2. CIS Benchmark Profile Adherence Statistics
          </h2>
          <div className="grid-2" style={{ gap: 16 }}>
            {['CIS Level 1', 'CIS Level 2'].map((levelKey, idx) => {
              const data = scoreBreakdown?.[levelKey] || { score: 100, total: 0, passed: 0, failed: 0 };
              return (
                <div key={idx} style={{ padding: '20px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `6px solid ${data.score >= 80 ? 'var(--green)' : data.score >= 60 ? 'var(--amber)' : 'var(--red)'}` }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span className="pill" style={{ background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        {levelKey} Profile
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {levelKey === 'CIS Level 1' ? 'Essential Base Defense' : 'Defense-in-Depth / High Security'}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                      {data.passed} / {data.total} Controls Compliant
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {data.failed} Active Violations Found
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: data.score >= 80 ? 'var(--green)' : data.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                      {data.score}%
                    </div>
                    <small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Adherence Rate</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Domain Category Breakdown Table */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
            3. Security Domain Score Breakdown
          </h2>
          <table>
            <thead>
              <tr>
                <th>Security Domain</th>
                <th>Posture Score / 100</th>
                <th>Compliance Grade</th>
                <th>Domain Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.breakdown.map((b, idx) => (
                <tr key={idx}>
                  <td><b style={{ fontSize: 14 }}>{b.category}</b></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="bar-track" style={{ width: 100 }}>
                        <div className="bar-fill" style={{ width: `${b.score}%`, background: b.score >= 80 ? 'var(--green)' : b.score >= 60 ? 'var(--amber)' : 'var(--red)' }} />
                      </div>
                      <b style={{ fontSize: 13.5 }}>{b.score}/100</b>
                    </div>
                  </td>
                  <td>
                    <span className={`grade-badge grade-${b.score >= 90 ? 'a' : b.score >= 75 ? 'b' : b.score >= 60 ? 'c' : 'd'}`} style={{ fontSize: 11 }}>
                      Grade {b.score >= 90 ? 'A' : b.score >= 75 ? 'B' : b.score >= 60 ? 'C' : 'D'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: b.score >= 80 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {b.score >= 80 ? 'Compliant & Hardened' : 'Requires Remediation'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Detailed Open Violations & Code Evidence */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
            4. {report.type === 'Technical' ? 'Technical Findings & Code Evidence' : 'Key Security Risks & Recommendations'}
          </h2>

          {openFindings.length === 0 ? (
            <div style={{ padding: '32px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '12px', textAlign: 'center', fontWeight: 700 }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
              All identified findings have been resolved or remediated! Zero open compliance gaps remain.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {openFindings.map((f, idx) => {
                const details = getRuleDetailsByCodeOrId(f.cis_code || f.rule_id);
                const ef = { ...(details as Partial<typeof f>), ...f };
                const refs = ef.references_json || ef.references || [];
                return (
                  <div key={idx} style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 800, background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>
                          {ef.rule_id}
                        </span>
                        {ef.cis_level && (
                          <span className="pill" style={{ background: 'var(--navy)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                            CIS {ef.cis_level}
                          </span>
                        )}
                        {ef.cis_code && (
                          <span className="pill" style={{ background: 'var(--cyan-light)', color: 'var(--cyan-d)', fontSize: 10, fontWeight: 700 }}>
                            CIS {ef.cis_code}
                          </span>
                        )}
                        <b style={{ fontSize: 15, color: 'var(--navy)' }}>{ef.title}</b>
                      </div>
                      <span className={`pill ${ef.severity === 'Critical' ? 'pill-crit' : ef.severity === 'High' ? 'pill-high' : 'pill-med'}`}>
                        {ef.severity} Severity (-{ef.penalty_score} pts)
                      </span>
                    </div>

                    <p style={{ fontSize: 13.5, color: 'var(--slate)', lineHeight: 1.6, marginBottom: 12 }}>
                      {ef.description}
                    </p>

                    {report.type === 'Technical' && (
                      <>
                        {ef.evidence_snippet && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Configuration Evidence:</div>
                            <div className="mono" style={{ background: '#0f172a', color: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: 12, overflowX: 'auto' }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ef.evidence_snippet}</pre>
                            </div>
                          </div>
                        )}

                        {(ef.remediation_procedure || ef.remediation || ef.recommendation) && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 4 }}>Remediation Procedure:</div>
                            <div className="mono" style={{ background: '#064e3b', color: '#ecfdf5', padding: '12px', borderRadius: '8px', fontSize: 12, overflowX: 'auto' }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{ef.remediation_procedure || ef.remediation || ef.recommendation}</pre>
                            </div>
                          </div>
                        )}

                        {refs.length > 0 && (
                          <div style={{ marginBottom: 12, fontSize: 12 }}>
                            <b style={{ color: 'var(--navy)' }}>References:</b> {refs.join(', ')}
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      <b style={{ fontSize: 12.5, color: 'var(--cyan-d)', display: 'block', marginBottom: 2 }}>Recommended Action Plan:</b>
                      <span style={{ fontSize: 13, color: 'var(--navy)' }}>{ef.remediation || ef.recommendation}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
        ) : activeFwResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginBottom: 40 }}>
            {/* Section 1: Executive Crosswalk & Honest Coverage Summary */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
                1. Executive Crosswalk Posture & Honest Coverage Summary
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate)', marginBottom: 20 }}>
                This formal compliance report presents the derived security posture of the appliance evaluated against <b>{activeFwResult.framework_name}</b>. 
                Using our crosswalk mapping architecture, technical controls are evaluated directly against parsed firewall configurations without duplicating verification checkers.
              </p>
              <div style={{ padding: '20px', background: '#0f172a', color: '#fff', borderRadius: '12px', border: '1px solid #334155', marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: 'var(--cyan)', fontWeight: 700, marginBottom: 8 }}>HONEST COVERAGE DISCLOSURE STATEMENT</div>
                <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                  <b>{activeFwResult.coverage_percent}% of framework controls</b> ({activeFwResult.covered_controls} out of {activeFwResult.total_controls} total controls) can be evaluated automatically from firewall configuration directives. 
                  The remaining controls represent organizational policies, physical security, or non-network domains that require manual governance verification by lead auditors.
                </p>
              </div>
            </div>

            {/* Section 2: Automated Technical Controls Assessment */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
                2. Automated & Partial Technical Controls Adherence Table
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                    <th style={{ padding: '12px', fontSize: 12 }}>Control ID & Title</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Category / Domain</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Status</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Mapped CIS Rules & Remediation Procedure</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFwResult.controls.filter(c => c.coverage_type !== 'manual' && c.coverage_type !== 'not_covered').map((ctrl, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '22%' }}>
                        <b className="mono" style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>{ctrl.control_code}</b>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{ctrl.title}</span>
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '18%', fontSize: 12.5, color: 'var(--slate)' }}>
                        {ctrl.category}
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '15%' }}>
                        <span className="pill" style={{ background: ctrl.status === 'Compliant' ? 'rgba(22,163,74,0.15)' : ctrl.status === 'Non-Compliant' ? 'rgba(225,29,72,0.15)' : 'rgba(245,158,11,0.15)', color: ctrl.status === 'Compliant' ? 'var(--green)' : ctrl.status === 'Non-Compliant' ? 'var(--red)' : 'var(--amber)', fontWeight: 700, fontSize: 11 }}>
                          {ctrl.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '45%' }}>
                        {ctrl.mapped_rules.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No active CIS rules mapped</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {ctrl.mapped_rules.map((rule) => (
                              <div key={rule.rule_id} style={{ background: 'var(--bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <b>CIS {rule.rule_code}: {rule.title}</b>
                                  <b style={{ color: rule.status === 'open' && rule.penalty_score > 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {rule.status === 'open' && rule.penalty_score > 0 ? 'FAIL' : 'PASS'}
                                  </b>
                                </div>
                                {rule.status === 'open' && rule.penalty_score > 0 && (
                                  <div style={{ marginTop: 6, background: '#064e3b', color: '#ecfdf5', padding: '8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: 11 }}>
                                    <b>Remediation Procedure:</b> {rule.remediation_procedure || rule.remediation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 3: Governance Controls Requiring Manual Verification */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 16 }}>
                3. Governance Controls Requiring Manual Verification
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 16 }}>
                The following controls fall outside automated firewall configuration auditing. Auditors must verify compliance through documentation review, interview, or physical inspection as part of formal certification.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                    <th style={{ padding: '12px', fontSize: 12 }}>Control ID & Title</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Domain</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Audit Type</th>
                    <th style={{ padding: '12px', fontSize: 12 }}>Auditor Governance Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFwResult.controls.filter(c => c.coverage_type === 'manual' || c.coverage_type === 'not_covered').map((ctrl, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '22%' }}>
                        <b className="mono" style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>{ctrl.control_code}</b>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{ctrl.title}</span>
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '18%', fontSize: 12.5, color: 'var(--slate)' }}>
                        {ctrl.category}
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '15%' }}>
                        <span className="pill" style={{ background: ctrl.coverage_type === 'manual' ? 'rgba(245,158,11,0.15)' : 'var(--bg)', color: ctrl.coverage_type === 'manual' ? 'var(--amber)' : 'var(--muted)', fontWeight: 700, fontSize: 11 }}>
                          {ctrl.coverage_type === 'manual' ? 'Manual Review' : 'Outside Scope'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', verticalAlign: 'top', width: '45%', fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.5 }}>
                        {ctrl.guidance || 'Review organizational policies and verify manual compliance evidence.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Report Footer / Signature */}
        <div style={{ borderTop: '2px solid var(--line)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <div>
            <b>Firewall Audit Analyzer Platform v1.0</b> • Air-Gapped Compliance Verification
          </div>
          <div>
            Report Finalized & Signed by: <b style={{ color: 'var(--navy)' }}>{audit.created_by}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading report viewer...</div>}>
      <ReportViewerContent reportId={resolvedParams.id} />
    </Suspense>
  );
}
