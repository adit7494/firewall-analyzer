'use client';

import React from 'react';
import { Shield, ShieldAlert, CheckCircle2, Layers } from 'lucide-react';
import { FrameworkCode } from '@/lib/types/framework';

interface FrameworkLensSwitcherProps {
  selectedFramework: FrameworkCode;
  onSelect: (code: FrameworkCode) => void;
}

const FRAMEWORK_OPTIONS: { code: FrameworkCode; label: string; desc: string; isBase?: boolean }[] = [
  { code: 'CIS', label: 'CIS Benchmark', desc: 'Granular Technical Rules (Default)', isBase: true },
  { code: 'NIST_CSF', label: 'NIST CSF 2.0', desc: '6 Core Functions (Govern, Protect, etc.)' },
  { code: 'NIST_800_41', label: 'NIST SP 800-41', desc: 'Firewall Policy & Perimeter Defense' },
  { code: 'ISO_27001', label: 'ISO/IEC 27001', desc: 'A.8 Technological & Management Controls' },
  { code: 'PCI_DSS', label: 'PCI DSS v4.0', desc: 'Cardholder Data Environment (Req 1 & 8)' },
  { code: 'CTM', label: 'Cyber Trust Mark', desc: 'Singapore CSA Preparedness Tiers' },
];

export const FrameworkLensSwitcher: React.FC<FrameworkLensSwitcherProps> = ({
  selectedFramework,
  onSelect,
}) => {
  return (
    <div className="card print-hidden" style={{ padding: '16px 20px', background: 'var(--bg)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Layers size={18} style={{ color: 'var(--cyan-d)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Compliance Assessment Lens (Crosswalk Architecture)
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FRAMEWORK_OPTIONS.map((opt) => {
          const isActive = selectedFramework === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => onSelect(opt.code)}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: isActive ? '2px solid var(--cyan-d)' : '1px solid var(--line)',
                background: isActive ? 'var(--cyan-bg, rgba(6,182,212,0.1))' : '#fff',
                color: isActive ? 'var(--navy)' : 'var(--slate)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 4px 12px rgba(6,182,212,0.15)' : 'none',
                minWidth: 160,
                flex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} style={{ color: isActive ? 'var(--cyan-d)' : 'var(--muted)' }} />
                <span>{opt.label}</span>
              </div>
              <small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>
                {opt.desc}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
};
