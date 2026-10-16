'use client';

import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Activity, ShieldAlert, Cpu, Code } from 'lucide-react';

interface BlockStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  findingsCount?: number;
  latencyMs?: number;
  tokens?: { prompt: number; completion: number; total: number };
  rawResponse?: string;
  prompt?: string;
  errorMsg?: string;
}

export default function DiagnosticPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [blocks, setBlocks] = useState<Record<string, BlockStatus>>({});
  const [activeModal, setActiveModal] = useState<BlockStatus | null>(null);
  const [modalTab, setModalTab] = useState<'response' | 'prompt'>('response');
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startDiagnostic = async () => {
    if (!file) return;
    setIsAuditing(true);
    setBlocks({});
    
    const fileContent = await file.text();

    fetch('/api/audit/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileContent, fileName: file.name, vendor: 'auto' }),
    }).then(response => {
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk(done: boolean, value?: Uint8Array) {
        if (done) {
          setIsAuditing(false);
          return;
        }
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            handleSSEEvent(event);
          } catch {
            // ignore
          }
        }

        reader.read().then(({ done, value }) => processChunk(done, value));
      }

      reader.read().then(({ done, value }) => processChunk(done, value));
    }).catch(err => {
      console.error(err);
      setIsAuditing(false);
    });
  };

  const handleSSEEvent = (event: any) => {
    const type = event.type;
    const blockId = event.block;

    if (!blockId && type !== 'done' && type !== 'error') return;

    setBlocks(prev => {
      const b = prev[blockId] || { id: blockId, name: blockId, status: 'pending' };

      if (type === 'block_start') {
        return { ...prev, [blockId]: { ...b, status: 'running' } };
      }
      
      if (type === 'block_telemetry') {
        return { 
          ...prev, 
          [blockId]: { 
            ...b, 
            rawResponse: event.rawResponse,
            prompt: event.prompt,
            latencyMs: event.telemetry?.latencyMs,
            tokens: {
              prompt: event.telemetry?.promptTokens,
              completion: event.telemetry?.completionTokens,
              total: event.telemetry?.totalTokens
            }
          } 
        };
      }

      if (type === 'block_done') {
        return { ...prev, [blockId]: { ...b, status: 'done', findingsCount: event.findingsCount } };
      }

      if (type === 'error' && blockId) {
        return { ...prev, [blockId]: { ...b, status: 'error', errorMsg: event.message } };
      }

      return prev;
    });
  };

  const totalTokens = Object.values(blocks).reduce((acc, b) => acc + (b.tokens?.total || 0), 0);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Activity size={28} color="var(--indigo)" /> 
          AI Diagnostic Sandbox
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '15px' }}>
          Upload a configuration file to test the AI evaluation engine. Telemetry, latency, and raw outputs are displayed for debugging. <strong style={{ color: 'var(--red)' }}>Data is not saved.</strong>
        </p>
      </div>

      {/* Uploader */}
      {!isAuditing && Object.keys(blocks).length === 0 && (
        <div className="card" style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '2px dashed var(--line2)', background: 'var(--bg)' }}>
          <div style={{ background: 'var(--indigo-light)', padding: '16px', borderRadius: '50%', color: 'var(--indigo)' }}>
            <UploadCloud size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--navy)', marginBottom: '8px' }}>Upload Configuration</h3>
            <p style={{ color: 'var(--slate)', fontSize: '14px', marginBottom: '16px' }}>Select a .conf or .txt file to begin the diagnostic analysis.</p>
            <input type="file" id="file" style={{ display: 'none' }} accept=".conf,.txt" onChange={handleFileUpload} />
            <label htmlFor="file" className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', padding: '10px 20px' }}>
              Browse Files
            </label>
            {file && (
              <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500, color: 'var(--indigo)' }}>
                Selected: {file.name}
              </p>
            )}
          </div>
          {file && (
            <button className="btn btn-primary" onClick={startDiagnostic} style={{ marginTop: '16px', width: '100%', maxWidth: '300px' }}>
              Run Diagnostic
            </button>
          )}
        </div>
      )}

      {/* Dashboard */}
      {(isAuditing || Object.keys(blocks).length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: 'var(--navy)', color: 'white' }}>
            <div style={{ display: 'flex', gap: '48px' }}>
              <div>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--slate2)' }}>File</span>
                <p style={{ fontSize: '16px', fontWeight: 500 }}>{file?.name}</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--slate2)' }}>Status</span>
                <p style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isAuditing ? <><Loader2 size={16} className="animate-spin" color="var(--cyan)" /> Analyzing</> : 'Completed'}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--slate2)' }}>Total Tokens Used</span>
              <p className="mono" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--cyan)' }}>{totalTokens.toLocaleString()}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {Object.values(blocks).map(b => (
              <div key={b.id} className="card" style={{ display: 'flex', flexDirection: 'column', borderTop: `4px solid ${b.status === 'error' ? 'var(--red)' : b.status === 'done' ? 'var(--green)' : 'var(--indigo)'}`, padding: '20px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy)', textTransform: 'capitalize' }}>
                    {b.name.replace(/_/g, ' ')}
                  </h3>
                  {b.status === 'running' && <Loader2 size={18} className="animate-spin" color="var(--indigo)" />}
                  {b.status === 'done' && <CheckCircle2 size={18} color="var(--green)" />}
                  {b.status === 'error' && <ShieldAlert size={18} color="var(--red)" />}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--slate)' }}>Latency:</span>
                    <span className="mono" style={{ fontWeight: 500, color: 'var(--navy)' }}>{b.latencyMs ? `${b.latencyMs}ms` : '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--slate)' }}>Tokens (In/Out):</span>
                    <span className="mono" style={{ fontWeight: 500, color: 'var(--navy)' }}>
                      {b.tokens && b.tokens.total ? `${b.tokens.prompt} / ${b.tokens.completion}` : '-'}
                    </span>
                  </div>
                  
                  {b.errorMsg && (
                    <div style={{ marginTop: '8px', padding: '10px', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                      {b.errorMsg}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                  <button 
                    onClick={() => { setActiveModal(b); setModalTab('response'); }}
                    disabled={!b.rawResponse && !b.prompt}
                    className="btn btn-outline"
                    style={{ width: '100%', fontSize: '13px', padding: '8px', opacity: b.rawResponse ? 1 : 0.5 }}
                  >
                    <Code size={14} style={{ marginRight: '6px' }} /> View Raw Response
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {activeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize', marginRight: '16px' }}>
                  <Cpu size={18} color="var(--indigo)" />
                  {activeModal.name.replace(/_/g, ' ')}
                </h2>
                
                <div style={{ display: 'flex', background: 'var(--line2)', borderRadius: '6px', padding: '4px' }}>
                  <button 
                    onClick={() => setModalTab('response')}
                    style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 500, borderRadius: '4px', border: 'none', cursor: 'pointer', background: modalTab === 'response' ? 'white' : 'transparent', color: modalTab === 'response' ? 'var(--navy)' : 'var(--slate)', boxShadow: modalTab === 'response' ? 'var(--shadow-sm)' : 'none' }}
                  >
                    AI Response
                  </button>
                  <button 
                    onClick={() => setModalTab('prompt')}
                    style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 500, borderRadius: '4px', border: 'none', cursor: 'pointer', background: modalTab === 'prompt' ? 'white' : 'transparent', color: modalTab === 'prompt' ? 'var(--navy)' : 'var(--slate)', boxShadow: modalTab === 'prompt' ? 'var(--shadow-sm)' : 'none' }}
                  >
                    Sent Prompt
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => handleCopy(modalTab === 'response' ? (activeModal.rawResponse || '') : (activeModal.prompt || ''))}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  {copied ? <CheckCircle2 size={14} style={{ marginRight: '6px' }} color="var(--green)" /> : <FileText size={14} style={{ marginRight: '6px' }} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button 
                  onClick={() => setActiveModal(null)} 
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--slate)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#1e1e1e' }}>
              <pre className="mono" style={{ fontSize: '13px', color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                {modalTab === 'response' 
                  ? (activeModal.rawResponse || 'No raw response available.') 
                  : (activeModal.prompt || 'No prompt available.')}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
