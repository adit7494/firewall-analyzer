'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, ShieldCheck, Key, Copy, Check } from 'lucide-react';
import { getUsers, createUser } from '@/app/actions/users';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      if (session.user.role !== 'admin') {
        router.push('/dashboard');
      } else {
        loadUsers();
      }
    }
  }, [status, session, router]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newEmail || !newPassword) return;

    const res = await createUser(newEmail, newPassword);
    if (res.error) {
      setError(res.error);
    } else {
      setShowAdd(false);
      setNewEmail('');
      setNewPassword('');
      loadUsers();
    }
  };

  if (loading || status === 'loading') return <div>Loading...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 850, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>User Management</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Manage access to the Firewall Audit platform.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); generatePassword(); }}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid var(--cyan)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create New Admin Account</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input 
                type="email" 
                value={newEmail} 
                onChange={e => setNewEmail(e.target.value)} 
                required
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line)' }} 
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 6 }}>Secure Initial Password</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted2)' }} />
                  <input 
                    type="text" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid var(--line)' }} 
                  />
                </div>
                <button type="button" onClick={generatePassword} className="btn" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  Regenerate
                </button>
                <button type="button" onClick={handleCopy} className="btn" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                </button>
              </div>
              <small style={{ color: 'var(--muted)', display: 'block', marginTop: 6 }}>
                Copy this password and send it securely to the new user. They will be forced to change it upon first login.
              </small>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary">Create Account</button>
              <button type="button" className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--slate)' }}>User Email</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--slate)' }}>Role</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--slate)' }}>Date Created</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--slate)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px' }}>{u.email}</td>
                <td style={{ padding: '16px' }}>
                  <span className="pill" style={{ background: 'var(--cyan-light)', color: 'var(--navy)' }}>{u.role}</span>
                </td>
                <td style={{ padding: '16px', color: 'var(--muted)' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>
                    <ShieldCheck size={14} /> Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
