'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder, icon, style, className, disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div 
      ref={containerRef} 
      className={`custom-select-container ${className || ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ position: 'relative', minWidth: 140, ...style }}
    >
      <div 
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: icon ? '11px 14px 11px 40px' : '11px 14px',
          borderRadius: '10px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: isOpen ? 'var(--cyan)' : 'var(--line)',
          background: 'var(--bg)',
          color: 'var(--txt)',
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px rgba(6,182,212,0.1)' : 'none'
        }}
      >
        {icon && (
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--muted2)' }}>
            {icon}
          </div>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', minWidth: 16 }} />
      </div>

      {isOpen && (
        <div 
          className="custom-select-dropdown animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            zIndex: 50,
            maxHeight: 250,
            overflowY: 'auto',
            padding: '6px'
          }}
        >
          {options.length === 0 ? (
             <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>No options available</div>
          ) : options.map((opt) => (
            <div
              key={opt.value}
              className="custom-select-option"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: opt.value === value ? 700 : 500,
                color: opt.value === value ? 'var(--cyan-d)' : 'var(--txt)',
                background: opt.value === value ? 'var(--cyan-light)' : 'transparent',
                transition: 'background 0.15s, color 0.15s',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                if (opt.value !== value) {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--line)';
                }
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
