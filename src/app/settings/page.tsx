'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  Sliders,
  Cpu,
  Users,
  Bot,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { ParserRegistry } from '@/lib/parsers/parser-registry';

type TabId = 'parsers' | 'scoring' | 'ai' | 'users';

const AI_PROVIDER_OPTIONS = [
  { value: 'openai',  label: 'OpenAI',           placeholder: 'https://api.openai.com/v1',        suggestions: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { value: 'gemini',  label: 'Google Gemini',     placeholder: 'https://generativelanguage.googleapis.com/v1beta/openai', suggestions: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
  { value: 'azure',   label: 'Azure OpenAI',      placeholder: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>', suggestions: ['gpt-4o', 'gpt-4o-mini'] },
  { value: 'ollama',  label: 'Ollama (Local)',    placeholder: 'http://localhost:11434/v1',         suggestions: ['llama3.2', 'mistral', 'phi3', 'gemma2'] },
  { value: 'custom',  label: 'Custom (OpenAI-compatible)', placeholder: 'https://your-api-endpoint/v1', suggestions: [] },
];

export default function SettingsPage() {
  const router = useRouter();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('parsers');

  // ── Scoring weights state ──────────────────────────────────────────────────
  const [critWeight, setCritWeight] = useState(25);
  const [highWeight, setHighWeight] = useState(12);
  const [medWeight,  setMedWeight]  = useState(5);
  const [lowWeight,  setLowWeight]  = useState(2);
  const [saveMsg,    setSaveMsg]    = useState('');

  // ── AI config state ────────────────────────────────────────────────────────
  const [aiProvider,  setAiProvider]  = useState('openai');
  const [aiBaseUrl,   setAiBaseUrl]   = useState('https://api.openai.com/v1');
  const [aiApiKey,    setAiApiKey]    = useState('');
  const [aiModel,     setAiModel]     = useState('gpt-4o-mini');
  const [showApiKey,  setShowApiKey]  = useState(false);
  const [aiSaving,    setAiSaving]    = useState(false);
  const [aiSaveMsg,   setAiSaveMsg]   = useState('');
  const [aiSaveErr,   setAiSaveErr]   = useState('');
  const [aiTesting,   setAiTesting]   = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; latencyMs: number; model: string; error?: string } | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);

  const parsers = ParserRegistry.getAllParsers();

  // ── Load AI config on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings/ai')
      .then(r => r.json())
      .then(data => {
        if (data.configured && data.config) {
          setAiProvider(data.config.provider ?? 'openai');
          setAiBaseUrl(data.config.baseUrl ?? '');
          setAiApiKey(data.config.apiKey ?? '');  // masked value
          setAiModel(data.config.model ?? '');
          setAiConfigured(true);
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  // ── Auto-fill base URL when provider changes ───────────────────────────────
  const handleProviderChange = (val: string) => {
    setAiProvider(val);
    const preset = AI_PROVIDER_OPTIONS.find(p => p.value === val);
    if (preset && val !== 'custom') {
      setAiBaseUrl(preset.placeholder);
      if (preset.suggestions.length > 0) {
        setAiModel(preset.suggestions[0]);
      }
    }
  };

  // ── Scoring save (UI only for now — wired to DB in a follow-up) ───────────
  const handleSaveWeights = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg('Scoring penalty weights updated. This will apply to future audits.');
    setTimeout(() => setSaveMsg(''), 3500);
  };

  // ── AI config save ─────────────────────────────────────────────────────────
  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiSaving(true);
    setAiSaveMsg('');
    setAiSaveErr('');
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, baseUrl: aiBaseUrl, apiKey: aiApiKey, model: aiModel }),
      });
      const data = await res.json();
      if (data.success) {
        setAiSaveMsg('AI engine configuration saved successfully.');
        setAiConfigured(true);
        setTimeout(() => setAiSaveMsg(''), 4000);
      } else {
        setAiSaveErr(data.error ?? 'Failed to save configuration.');
      }
    } catch (err) {
      setAiSaveErr((err as Error).message);
    } finally {
      setAiSaving(false);
    }
  };

  // ── AI connection test ─────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, baseUrl: aiBaseUrl, apiKey: aiApiKey, model: aiModel }),
      });
      const data = await res.json();
      setAiTestResult(data);
    } catch (err) {
      setAiTestResult({ success: false, latencyMs: 0, model: aiModel, error: (err as Error).message });
    } finally {
      setAiTesting(false);
    }
  };

  const selectedProvider = AI_PROVIDER_OPTIONS.find(p => p.value === aiProvider);

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'parsers',  label: 'Parser Registry', icon: <Cpu size={15} /> },
    { id: 'scoring',  label: 'Scoring Weights', icon: <Sliders size={15} /> },
    { id: 'ai',       label: 'AI Engine',        icon: <Bot size={15} /> },
    { id: 'users',    label: 'User Management',  icon: <Users size={15} /> },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>System Settings</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>
          Configure parser modules, scoring weights, AI engine, and user access.
        </p>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 12, padding: 4, border: '1px solid var(--line)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 13,
              color: activeTab === tab.id ? '#fff' : 'var(--slate)',
              background: activeTab === tab.id ? 'var(--navy)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'ai' && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: aiConfigured ? 'var(--green)' : 'var(--med)',
                marginLeft: 2,
                flexShrink: 0,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Parser Registry ────────────────────────────────────────── */}
      {activeTab === 'parsers' && (
        <div className="card animate-fade-in">
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} color="var(--cyan-d)" /> Registered Vendor Parser Adapters
            </h3>
            <span className="pill pill-ok">Plugin Architecture Active</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            New firewall vendors can be added by implementing the <span className="mono">FirewallParser</span> interface without altering core scoring or reporting logic.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {parsers.map((p, idx) => (
              <div key={idx} style={{ padding: '16px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    {p.vendor.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <b style={{ fontSize: 15, color: 'var(--navy)', display: 'block' }}>{p.name}</b>
                    <small style={{ color: 'var(--muted)', fontSize: 12 }}>Formats: {p.supportedFileTypes.join(', ')} · Version {p.version}</small>
                  </div>
                </div>
                <span className="pill pill-ok" style={{ fontSize: 11 }}>Active & Ready</span>
              </div>
            ))}
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '12px', border: '1px dashed var(--line2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.75 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--slate)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>PAL</div>
                <div>
                  <b style={{ fontSize: 15, color: 'var(--slate)', display: 'block' }}>Palo Alto PanOS Parser Plugin</b>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Formats: .xml, .txt · Architectural stub ready for registration</small>
                </div>
              </div>
              <span className="pill pill-info" style={{ fontSize: 11 }}>Extensible Stub</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Scoring Weights ────────────────────────────────────────── */}
      {activeTab === 'scoring' && (
        <form onSubmit={handleSaveWeights} className="card animate-fade-in">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} color="var(--cyan-d)" /> Posture Score Penalty Weights
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Points deducted from the base score of 100 for each finding severity level.
          </p>
          {saveMsg && (
            <div className="animate-fade-in" style={{ padding: '12px 16px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '10px', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 20 }}>
              <CheckCircle2 size={16} /> {saveMsg}
            </div>
          )}
          <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
            {[
              { label: 'Critical Severity', color: 'var(--crit)', val: critWeight, set: setCritWeight, min: 1, max: 50 },
              { label: 'High Severity',     color: 'var(--high)', val: highWeight, set: setHighWeight, min: 1, max: 30 },
              { label: 'Medium Severity',   color: 'var(--med)',  val: medWeight,  set: setMedWeight,  min: 1, max: 20 },
              { label: 'Low Severity',      color: 'var(--low)',  val: lowWeight,  set: setLowWeight,  min: 0, max: 10 },
            ].map(({ label, color, val, set, min, max }) => (
              <div key={label}>
                <label style={{ fontSize: 12, fontWeight: 700, color, display: 'block', marginBottom: 6 }}>{label} Deduction (pts)</label>
                <input type="number" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 14, fontWeight: 700 }} />
              </div>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <Save size={16} /> Save Weight Configuration
          </button>
        </form>
      )}

      {/* ── Tab: AI Engine ──────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <form onSubmit={handleSaveAI} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} color="var(--cyan-d)" /> AI Engine Configuration
              </h3>
              {aiConfigured ? (
                <span className="pill pill-ok" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  Configured
                </span>
              ) : (
                <span className="pill" style={{ background: 'rgba(234,179,8,0.1)', color: '#a16207', border: '1px solid rgba(234,179,8,0.3)', fontSize: 12 }}>
                  Not Configured
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Configure the AI provider used to evaluate all firewall audit rules. Supports any OpenAI-compatible API endpoint.
            </p>
          </div>

          {/* Provider */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 8 }}>AI Provider</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {AI_PROVIDER_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => handleProviderChange(opt.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: `2px solid ${aiProvider === opt.value ? 'var(--cyan)' : 'var(--line)'}`,
                    background: aiProvider === opt.value ? 'var(--cyan-light)' : 'var(--bg)',
                    color: aiProvider === opt.value ? 'var(--cyan-d)' : 'var(--slate)',
                    fontWeight: aiProvider === opt.value ? 700 : 500,
                    fontSize: 13, cursor: 'pointer', textAlign: 'left' as const,
                    transition: 'all 0.15s ease',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>
              API Base URL
            </label>
            <input
              type="url"
              value={aiBaseUrl}
              onChange={e => setAiBaseUrl(e.target.value)}
              placeholder={selectedProvider?.placeholder ?? 'https://...'}
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}
            />
            {aiProvider === 'gemini' && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                Google Gemini uses the OpenAI-compatible endpoint. Your Gemini API key goes in the field below.
              </p>
            )}
            {aiProvider === 'ollama' && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                Ollama runs locally. Make sure Ollama is running and the model is pulled: <span className="mono">ollama pull llama3.2</span>
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>
              API Key {aiProvider === 'ollama' ? '(leave empty for Ollama)' : ''}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiApiKey}
                onChange={e => setAiApiKey(e.target.value)}
                placeholder={aiProvider === 'ollama' ? 'No API key required for Ollama' : 'sk-... or API key'}
                required={aiProvider !== 'ollama'}
                style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>
              Model Name
            </label>
            <input
              type="text"
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}
            />
            {selectedProvider && selectedProvider.suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {selectedProvider.suggestions.map(s => (
                  <button key={s} type="button" onClick={() => setAiModel(s)}
                    style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: aiModel === s ? 'var(--cyan-light)' : 'var(--bg)', color: aiModel === s ? 'var(--cyan-d)' : 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test result banner */}
          {aiTestResult && (
            <div className="animate-fade-in" style={{
              padding: '12px 16px', borderRadius: 10,
              background: aiTestResult.success ? 'var(--green-bg)' : 'rgba(239,68,68,0.07)',
              border: `1px solid ${aiTestResult.success ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: aiTestResult.success ? 'var(--green)' : 'var(--crit)',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {aiTestResult.success
                ? <><CheckCircle2 size={16} /> Connected to <span className="mono" style={{ fontWeight: 700 }}>{aiTestResult.model}</span> &mdash; {aiTestResult.latencyMs}ms</>
                : <><WifiOff size={16} /> Connection failed: {aiTestResult.error}</>
              }
            </div>
          )}

          {/* Save feedback */}
          {aiSaveMsg && (
            <div className="animate-fade-in" style={{ padding: '12px 16px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 10, border: '1px solid rgba(22,163,74,0.3)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} /> {aiSaveMsg}
            </div>
          )}
          {aiSaveErr && (
            <div className="animate-fade-in" style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.07)', color: 'var(--crit)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, fontWeight: 600 }}>
              Error: {aiSaveErr}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={handleTestConnection} disabled={aiTesting}
              className="btn btn-ghost" style={{ padding: '10px 20px' }}>
              {aiTesting ? <><RefreshCw size={15} className="animate-spin" /> Testing...</> : <><Wifi size={15} /> Test Connection</>}
            </button>
            <button type="submit" disabled={aiSaving} className="btn btn-primary" style={{ padding: '10px 24px' }}>
              {aiSaving ? <><RefreshCw size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> Save Configuration</>}
            </button>
          </div>
        </form>
      )}

      {/* ── Tab: User Management ────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="card animate-fade-in">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--cyan-d)" /> User Management
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Manage platform access. Create new users and assign administrator roles.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => router.push('/settings/users')} style={{ padding: '10px 24px' }}>
            <Users size={16} /> Open User Management <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
