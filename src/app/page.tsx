'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, UserCheck, ArrowRight, ShieldCheck } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { hasAnyUser, createFirstAdmin } from './actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    hasAnyUser().then(hasUser => {
      if (!hasUser) {
        setIsSetupMode(true);
      }
      setCheckingSetup(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    if (isSetupMode) {
      const res = await createFirstAdmin(email, password);
      if (res.error) {
        setErrorMsg(res.error);
        setIsLoading(false);
        return;
      }
      // If success, automatically log them in
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.error) {
        setErrorMsg("Admin created, but failed to login automatically.");
        setIsLoading(false);
      } else {
        router.push('/dashboard');
      }
    } else {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        setErrorMsg("Invalid email or password");
        setIsLoading(false);
      } else {
        router.push('/dashboard');
      }
    }
  };

  if (checkingSetup) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>Loading...</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 90%)',
      padding: '24px',
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100,
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-150px', right: '-150px', width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)', filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'absolute', bottom: '-150px', left: '-150px', width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.2) 0%, transparent 70%)', filter: 'blur(40px)'
      }} />

      <div className="card animate-fade-in" style={{
        width: '100%', maxWidth: '460px', background: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '24px', padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', zIndex: 10
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: '100%', maxWidth: 280, height: 'auto', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src="/logo.png" alt="FW Audit Analyzer Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.03em' }}>
            {isSetupMode ? "Initial Setup" : "Firewall Audit Analyzer"}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
            {isSetupMode ? "Create the first Admin account" : "Secure Authentication"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {errorMsg && (
            <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 13, fontWeight: 500, textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
          
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>
              {isSetupMode ? "Admin Email Address" : "Email Address"}
            </label>
            <div style={{ position: 'relative' }}>
              <UserCheck size={18} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--muted2)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%', padding: '11px 14px 11px 42px', borderRadius: '10px',
                  border: '1px solid var(--line)', fontSize: 14, outline: 'none', color: 'var(--txt)', background: '#fff'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>
              {isSetupMode ? "Admin Password" : "Password"}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--muted2)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '11px 14px 11px 42px', borderRadius: '10px',
                  border: '1px solid var(--line)', fontSize: 14, outline: 'none', color: 'var(--txt)', background: '#fff'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 8, width: '100%', padding: '14px', borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--cyan), var(--indigo))', color: '#fff',
              border: 'none', fontSize: 15, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 20px rgba(6, 182, 212, 0.25)', transition: 'transform 0.2s',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? "Processing..." : (isSetupMode ? "Create Admin & Login" : "Sign In")}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
          <ShieldCheck size={14} style={{ color: 'var(--green)' }} />
          <span>Secure AES-256 connection established</span>
        </div>
      </div>
    </div>
  );
}
