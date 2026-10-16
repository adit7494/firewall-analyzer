'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Portal } from '@/components/Portal';
import { Building2, Search, ArrowRight, Server, ShieldCheck, Plus } from 'lucide-react';
import { getCompanies, addCompany, deleteCompany, updateCompany } from '@/app/actions/data';
import { Company } from '@/lib/types/audit';

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('ALL');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyLocation, setNewCompanyLocation] = useState('');
  const [newCompanyContact, setNewCompanyContact] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);
  const [renameTarget, setRenameTarget] = useState<{id: string, name: string} | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    
    await addCompany({
      name: newCompanyName,
      industry: newCompanyIndustry || 'Other',
      contact_person: newCompanyContact || 'Admin',
      contact_email: newCompanyContact.toLowerCase().replace(' ', '.') + '@' + newCompanyName.toLowerCase().replace(' ', '') + '.com',
      notes: newCompanyLocation ? `Location: ${newCompanyLocation}` : '',
      avatar_initials: newCompanyName.substring(0, 2).toUpperCase(),
      devices_count: 0,
      latest_score: 0,
      latest_grade: 'N/A',
      open_findings_count: 0
    });
    
    const refreshed = await getCompanies();
    setCompanies(refreshed);
    setShowAddModal(false);
    setNewCompanyName('');
    setNewCompanyIndustry('');
    setNewCompanyLocation('');
    setNewCompanyContact('');
  };

  const handleDelete = async (id: string) => {
    await deleteCompany(id);
    const refreshed = await getCompanies();
    setCompanies(refreshed);
  };

  const handleRename = async (id: string, newName: string) => {
    await updateCompany(id, { name: newName });
    const refreshed = await getCompanies();
    setCompanies(refreshed);
  };

  useEffect(() => {
    async function load() {
      const comps = await getCompanies();
      setCompanies(comps);
    }
    load();
  }, []);

  const industries = ['ALL', ...Array.from(new Set(companies.map(c => c.industry)))];

  const filtered = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        c.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchInd = industryFilter === 'ALL' || c.industry === industryFilter;
    return matchSearch && matchInd;
  });

  return (
    <>
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <div className="flex-row">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>Managed Client Companies</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Overview of all monitored enterprise tenants and their firewall gateway inventories</p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} /> Add Client Tenant
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ width: '300px' }}>
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by company name, contact, industry..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginRight: 4 }}>Industry:</span>
            {industries.map(ind => (
              <button
                key={ind}
                type="button"
                onClick={() => setIndustryFilter(ind)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: industryFilter === ind ? 'var(--navy)' : 'transparent',
                  color: industryFilter === ind ? '#fff' : 'var(--slate)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <b>{filtered.length}</b> of <b>{companies.length}</b> clients
        </div>
      </div>

      {/* Company Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Client Company</th>
              <th>Primary Contact</th>
              <th>Industry Sector</th>
              <th>Firewall Gateways</th>
              <th>Latest Score</th>
              <th>Security Grade</th>
              <th>Open Findings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(comp => (
              <tr key={comp.id}>
                <td>
                  <div className="flex-start">
                    <span className="company-ava" style={{ width: 40, height: 40, fontSize: 14 }}>{comp.avatar_initials}</span>
                    <div>
                      <b style={{ fontSize: 14, display: 'block', color: 'var(--navy)' }}>{comp.name}</b>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Registered: {new Date(comp.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <b style={{ fontSize: 13, display: 'block' }}>{comp.contact_person}</b>
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>{comp.contact_email}</small>
                </td>
                <td>
                  <span className="pill" style={{ background: 'var(--bg)', color: 'var(--slate)', border: '1px solid var(--line)' }}>
                    {comp.industry}
                  </span>
                </td>
                <td>
                  <div className="flex-start" style={{ gap: 6 }}>
                    <Server size={16} color="var(--cyan-d)" />
                    <b style={{ fontSize: 13.5 }}>{comp.devices_count}</b>
                    <small style={{ color: 'var(--muted)' }}>device(s)</small>
                  </div>
                </td>
                <td>
                  {comp.devices_count === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>N/A</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="bar-track" style={{ width: 60 }}>
                        <div className="bar-fill" style={{ 
                          width: `${comp.latest_score}%`, 
                          background: comp.latest_score >= 80 ? 'var(--green)' : comp.latest_score >= 60 ? 'var(--amber)' : 'var(--red)' 
                        }} />
                      </div>
                      <b style={{ fontSize: 13.5 }}>{comp.latest_score}</b>
                    </div>
                  )}
                </td>
                <td>
                  {comp.devices_count === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>N/A</span>
                  ) : (
                    <span className={`grade-badge grade-${comp.latest_grade.toLowerCase()}`}>
                      Grade {comp.latest_grade}
                    </span>
                  )}
                </td>
                <td>
                  {comp.devices_count === 0 ? (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>N/A</span>
                  ) : (
                    <span className={`pill ${comp.open_findings_count > 5 ? 'pill-crit' : comp.open_findings_count > 0 ? 'pill-high' : 'pill-ok'}`}>
                      {comp.open_findings_count} Open
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 10px', fontSize: 12.5 }}
                      onClick={() => router.push(`/companies/${comp.id}`)}
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 10px', fontSize: 12.5, color: 'var(--amber)' }}
                      onClick={() => {
                        setRenameTarget({ id: comp.id, name: comp.name });
                        setRenameInput(comp.name);
                      }}
                    >
                      Rename
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 10px', fontSize: 12.5, color: 'var(--red)' }}
                      onClick={() => {
                        setDeleteTarget({ id: comp.id, name: comp.name });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  No companies match your search or filter selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </div>

      {showAddModal && (
      <Portal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 600, padding: 32, boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--line)', paddingBottom: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg, var(--cyan-light), #fff)', border: '1px solid rgba(6, 182, 212, 0.2)', color: 'var(--cyan-d)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.1)' }}>
                <Building2 size={26} strokeWidth={2.5} />
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.02em' }}>Add New Client Tenant</h3>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 2 }}>Register a new enterprise to begin configuration auditing</p>
              </div>
            </div>
            
            <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="grid-2" style={{ gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Company Name *</label>
                  <input type="text" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} required placeholder="e.g. Acme Corp" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', color: 'var(--txt)', fontSize: 14, outline: 'none', transition: 'var(--transition)' }} onFocus={e => e.target.style.borderColor = 'var(--cyan)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Industry</label>
                  <input type="text" value={newCompanyIndustry} onChange={e => setNewCompanyIndustry(e.target.value)} placeholder="e.g. Finance, Healthcare" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', color: 'var(--txt)', fontSize: 14, outline: 'none', transition: 'var(--transition)' }} onFocus={e => e.target.style.borderColor = 'var(--cyan)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Location</label>
                  <input type="text" value={newCompanyLocation} onChange={e => setNewCompanyLocation(e.target.value)} placeholder="e.g. New York, London" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', color: 'var(--txt)', fontSize: 14, outline: 'none', transition: 'var(--transition)' }} onFocus={e => e.target.style.borderColor = 'var(--cyan)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Primary Contact</label>
                  <input type="text" value={newCompanyContact} onChange={e => setNewCompanyContact(e.target.value)} placeholder="e.g. Jane Doe" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', color: 'var(--txt)', fontSize: 14, outline: 'none', transition: 'var(--transition)' }} onFocus={e => e.target.style.borderColor = 'var(--cyan)'} onBlur={e => e.target.style.borderColor = 'var(--line)'} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '12px 24px' }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px' }}><Plus size={18} /> Create Tenant</button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* Rename Modal */}
      {renameTarget && (
      <Portal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 400, padding: 32, boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
              <Building2 size={20} style={{ color: 'var(--cyan)' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>Rename Company</h3>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (renameInput.trim() && renameInput !== renameTarget.name) {
                handleRename(renameTarget.id, renameInput);
              }
              setRenameTarget(null);
            }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Company Name</label>
                <input 
                  type="text"
                  required
                  value={renameInput}
                  onChange={e => setRenameInput(e.target.value)}
                  style={{
                    padding: '12px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 14, color: 'var(--txt)', outline: 'none'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
      <Portal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 440, padding: 32, boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--crit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--crit)' }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Delete Company?</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.6, marginBottom: 32, paddingLeft: 64 }}>
              Are you sure you want to delete <b>{deleteTarget.name}</b>? This action is permanent and will remove all associated devices, configurations, and audit reports.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'var(--crit)', color: '#fff', padding: '10px 24px' }}
                onClick={() => {
                  handleDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete Company
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </>
  );
}
