'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, Cpu, CheckCircle2, AlertCircle, Activity,
  ArrowRight, Settings, RefreshCw, Bot, Upload, LayoutDashboard, Search
} from 'lucide-react';
import { loadUploadData } from '@/lib/utils/large-file-storage';

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'ai' | 'system';
  message: string;
  timestamp: string;
}

interface AuditStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

const INITIAL_STEPS: AuditStep[] = [
  { id: 1, label: 'Vendor Detection & Parsing', status: 'pending' },
  { id: 2, label: 'Config Block Extraction',    status: 'pending' },
  { id: 3, label: 'AI Security Analysis',       status: 'pending' },
  { id: 4, label: 'Scoring & Finalization',     status: 'pending' },
];

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function AuditProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [steps,         setSteps]         = useState<AuditStep[]>(INITIAL_STEPS);
  const [logs,          setLogs]          = useState<LogEntry[]>([]);
  const [progress,      setProgress]      = useState(5);
  const [totalBlocks,   setTotalBlocks]   = useState(0);
  const [doneBlocks,    setDoneBlocks]    = useState(0);
  const [isDone,        setIsDone]        = useState(false);
  const [isError,       setIsError]       = useState(false);
  const [errorMessage,  setErrorMessage]  = useState('');
  const [resultAuditId, setResultAuditId] = useState('');
  const [finalScore,    setFinalScore]    = useState(0);
  const [finalGrade,    setFinalGrade]    = useState('');
  const [aiEnabled,     setAiEnabled]     = useState(true);
  const [currentBlockName, setCurrentBlockName] = useState('');

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: now() }]);
  };

  const updateStep = (id: number, status: AuditStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const hasStartedRef = useRef(false);

  // ── Auto-scroll log terminal ────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Connect to background audit stream or start new audit ─────────────────
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function initAuditStream() {
      let targetAuditId = searchParams.get('auditId');

      // If no auditId in query params, check active background scans on server
      if (!targetAuditId) {
        try {
          const activeRes = await fetch('/api/audit/active');
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            if (activeData.active && activeData.active.length > 0) {
              targetAuditId = activeData.active[0].auditId;
            } else if (activeData.completed && activeData.completed.length > 0) {
              targetAuditId = activeData.completed[0].auditId;
            }
          }
        } catch {
          // ignore
        }
      }

      // If still no auditId, check cached uploadData as fallback
      if (!targetAuditId) {
        const uploadData = await loadUploadData();
        if (uploadData && uploadData.fileContent && uploadData.companyId && uploadData.deviceId) {
          try {
            addLog('system', `Submitting upload session data to background engine: ${uploadData.fileName}`);
            const startRes = await fetch('/api/audit/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(uploadData),
            });
            if (startRes.ok) {
              const startData = await startRes.json();
              targetAuditId = startData.auditId;
            }
          } catch (e) {
            console.error('Failed to start audit from uploadData:', e);
          }
        }
      }

      if (!targetAuditId) {
        addLog('error', 'No active audit in progress and no upload session found.');
        setIsError(true);
        setErrorMessage('No active audit found. Please upload a firewall configuration file to begin.');
        return;
      }

      setResultAuditId(targetAuditId);
      connectToStream(targetAuditId);
    }

    function connectToStream(auditId: string) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/audit/stream?auditId=${auditId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEEvent(data);
        } catch (e) {
          console.warn('Failed to parse SSE event:', e);
        }
      };

      es.onerror = () => {
        // Stream ended or connection lost. Check status endpoint once to verify if it completed.
        fetch('/api/audit/active')
          .then(r => r.json())
          .then(data => {
            const doneScan = (data.completed || []).find((c: any) => c.auditId === auditId);
            if (doneScan) {
              handleSSEEvent({
                type: 'done',
                auditId: doneScan.auditId,
                score: doneScan.score,
                grade: doneScan.grade,
                findingsTotal: doneScan.findingsCount,
              });
            }
          })
          .catch(() => {});
      };
    }

    initAuditStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSSEEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case 'init': {
        const scan = event.scan as Record<string, unknown> | undefined;
        if (scan) {
          if (scan.progress) setProgress(scan.progress as number);
          if (scan.totalBlocks) setTotalBlocks(scan.totalBlocks as number);
          if (scan.completedBlocks) setDoneBlocks(scan.completedBlocks as number);
          if (scan.currentBlock) setCurrentBlockName(scan.currentBlock as string);
          
          if (scan.status === 'in_progress') {
            updateStep(1, 'done');
            updateStep(2, 'done');
            updateStep(3, 'active');
          } else if (scan.status === 'done') {
            updateStep(1, 'done');
            updateStep(2, 'done');
            updateStep(3, 'done');
            updateStep(4, 'done');
            setProgress(100);
            setIsDone(true);
            setFinalScore((scan.score as number) || 0);
            setFinalGrade((scan.grade as string) || 'B');
          }
        }
        if (event.logs && Array.isArray(event.logs) && event.logs.length > 0) {
          setLogs(event.logs as LogEntry[]);
        }
        break;
      }

      case 'parsing':
        updateStep(1, 'active');
        setProgress(5);
        addLog('info', event.message as string);
        break;

      case 'parsed':
        updateStep(1, 'done');
        updateStep(2, 'active');
        setProgress(15);
        addLog('success', `Vendor identified: ${event.vendor} — Hostname: ${event.hostname}`);
        setAiEnabled(true);
        break;

      case 'extracted':
        updateStep(2, 'done');
        updateStep(3, 'active');
        setTotalBlocks(event.totalBlocks as number);
        setProgress(20);
        addLog('info', `Extracted ${event.totalBlocks} configuration block types for AI analysis`);
        break;

      case 'info':
        addLog('info', event.message as string);
        if ((event.message as string).includes('static rule')) {
          setAiEnabled(false);
        }
        break;

      case 'block_start': {
        const rawMsg = (event.message as string) || (event.block as string);
        const cleanName = rawMsg.replace(/^Analyzing:\s*/i, '');
        setCurrentBlockName(cleanName);
        addLog('ai', `⟳ Analyzing: ${cleanName}`);
        break;
      }

      case 'block_done': {
        setDoneBlocks(prev => {
          const next = prev + 1;
          const pct = totalBlocks > 0 ? Math.min(92, Math.round(20 + (next / totalBlocks) * 75)) : 50;
          setProgress(pct);
          return next;
        });
        const count = event.findingsCount as number;
        const rawMsg = (event.message as string) || (event.block as string);
        const cleanName = rawMsg.replace(/^Completed:\s*/i, '').split(' — ')[0].trim();
        addLog('ai', `✓ Completed: ${cleanName} — ${count === 0 ? 'No issues found' : `${count} finding(s)`}`);
        break;
      }

      case 'scoring':
        updateStep(3, 'done');
        updateStep(4, 'active');
        setProgress(95);
        setCurrentBlockName('Scoring & Finalization');
        addLog('info', (event.message as string) ?? 'Calculating security posture score...');
        break;

      case 'scoring_done':
        addLog('success', `Security posture calculated — Score: ${event.score}/100, Grade: ${event.grade}`);
        break;

      case 'done':
        updateStep(4, 'done');
        setProgress(100);
        setIsDone(true);
        setResultAuditId((event.auditId as string) || resultAuditId);
        setFinalScore(event.score as number);
        setFinalGrade(event.grade as string);
        addLog('success', `Audit complete! Grade: ${event.grade} (${event.score}/100) — ${event.findingsTotal ?? 0} findings recorded`);
        break;

      case 'error': {
        const msg = (event.message as string) || 'Audit encountered an error.';
        addLog('error', msg);
        setIsError(true);
        setErrorMessage(msg);
        setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
        break;
      }
    }
  }

  const gradeColor = finalGrade === 'A' ? 'var(--green)' : finalGrade === 'B' ? 'var(--cyan-d)' : finalGrade === 'C' ? 'var(--med)' : 'var(--crit)';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '840px', margin: '24px auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Background Notification Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(79,70,229,0.08))',
        border: '1px solid rgba(6,182,212,0.3)',
        borderRadius: 14,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: isDone
              ? 'linear-gradient(135deg, var(--green), #059669)'
              : 'linear-gradient(135deg, var(--cyan), var(--indigo))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            flexShrink: 0
          }}>
            {isDone ? <CheckCircle2 size={20} /> : <Bot size={20} className={isError ? '' : 'animate-pulse'} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>
                {isDone ? 'AI Audit Completed' : 'AI Security Scan Running in Background'}
              </b>
              <span className="pill pill-ok" style={{ fontSize: 10.5, padding: '2px 8px' }}>Config Saved</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
              {isDone
                ? 'Analysis finished and saved in database. You can inspect findings below.'
                : 'Config backup is safely stored. You can leave this page anytime and check status in the topbar.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push('/dashboard')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            <LayoutDashboard size={13} /> Dashboard
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push('/audit/results')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            <Search size={13} /> Audit Results
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 58, height: 58, borderRadius: 18, margin: '0 auto 12px',
          background: isError
            ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
            : isDone
            ? 'linear-gradient(135deg, var(--green), #059669)'
            : 'linear-gradient(135deg, var(--cyan), var(--indigo))',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(6,182,212,0.25)',
        }}>
          {isError
            ? <AlertCircle size={28} />
            : isDone
            ? <ShieldCheck size={28} />
            : <Bot size={28} className="animate-pulse" />
          }
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>
          {isError ? 'Audit Aborted' : isDone ? 'AI Security Assessment Complete' : 'AI Security Analysis in Progress'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          {isError
            ? 'The audit was stopped due to an error. Please review the details below.'
            : isDone
            ? `Security posture evaluated. Result report is ready for inspection.`
            : currentBlockName
            ? `Currently analyzing: ${currentBlockName}`
            : 'Evaluating configuration blocks using AI engine...'}
        </p>
      </div>

      {/* Step Bar & Telemetry Card */}
      <div className="card" style={{ padding: 24 }}>
        <div className="stepbar" style={{ marginBottom: 20 }}>
          {steps.map((step) => (
            <div key={step.id} className={`step-item ${step.status === 'done' ? 'done' : step.status === 'active' ? 'active' : step.status === 'error' ? 'error' : ''}`}>
              <div className="step-circle">
                {step.status === 'done'  ? <CheckCircle2 size={16} /> :
                 step.status === 'error' ? <AlertCircle  size={16} /> :
                 step.status === 'active' ? <Activity size={15} className="animate-pulse" /> :
                 step.id}
              </div>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'var(--line)', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            height: '100%', borderRadius: 8,
            width: `${progress}%`,
            background: isError
              ? 'linear-gradient(90deg, #ef4444, #b91c1c)'
              : 'linear-gradient(90deg, var(--cyan), var(--indigo))',
            transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>

        {/* Block progress counter */}
        {totalBlocks > 0 && !isDone && !isError && (
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>
            <Bot size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Analyzing block <b>{Math.min(doneBlocks + 1, totalBlocks)}</b> of <b>{totalBlocks}</b>
            {currentBlockName ? ` — ${currentBlockName}` : ''}
          </p>
        )}

        {/* Terminal log */}
        <div className="mono" style={{
          background: 'var(--navy)', color: '#a5b4fc', padding: '16px 18px', borderRadius: 12,
          fontSize: 12, lineHeight: 1.8, minHeight: 180, maxHeight: 300, overflowY: 'auto',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
        }}>
          <div style={{ color: '#475569', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 10, fontSize: 11 }}>
            ── FIREWALL AI AUDIT ENGINE — BACKGROUND TELEMETRY ──
          </div>
          {logs.map((log, i) => (
            <div key={i} className="animate-fade-in" style={{
              color: log.type === 'success' ? '#4ade80'
                   : log.type === 'error'   ? '#f87171'
                   : log.type === 'ai'      ? '#38bdf8'
                   : log.type === 'system'  ? '#e2e8f0'
                   : '#94a3b8',
              display: 'flex', gap: 10,
            }}>
              <span style={{ color: '#475569', flexShrink: 0, fontSize: 10.5, paddingTop: 2 }}>{log.timestamp}</span>
              <span>{log.message}</span>
            </div>
          ))}
          {!isDone && !isError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#facc15', marginTop: 8 }}>
              <Activity className="animate-pulse" size={13} /> AI background evaluation in progress...
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="card animate-fade-in" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <AlertCircle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>Audit Notice</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>{errorMessage}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => router.push('/upload')} style={{ fontSize: 13 }}>
                  <Upload size={14} /> Upload New Backup
                </button>
                <button className="btn btn-primary" onClick={() => router.push('/settings')} style={{ fontSize: 13 }}>
                  <Settings size={14} /> Configure AI Engine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Done state */}
      {isDone && resultAuditId && (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{finalGrade}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Grade</div>
            </div>
            <div style={{ width: 1, height: 46, background: 'var(--line)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>{finalScore}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>/ 100 Score</div>
            </div>
            <div style={{ width: 1, height: 46, background: 'var(--line)' }} />
            <div style={{ textAlign: 'center' }}>
              {aiEnabled
                ? <Bot size={26} color="var(--indigo)" />
                : <Cpu size={26} color="var(--slate)" />}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{aiEnabled ? 'AI Evaluated' : 'Static Rules'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-primary animate-fade-in" onClick={() => router.push(`/audit/${resultAuditId}`)} style={{ padding: '12px 28px', fontSize: 14 }}>
              Inspect Assessment Findings <ArrowRight size={16} />
            </button>
            <button className="btn btn-ghost" onClick={() => router.push('/audit/results')} style={{ padding: '12px 20px', fontSize: 14 }}>
              Audit Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditProgressPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading audit telemetry...</div>}>
      <AuditProgressContent />
    </Suspense>
  );
}
