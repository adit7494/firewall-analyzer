'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Portal } from '@/components/Portal';
import { Server, Search, ArrowRight, ShieldCheck, Upload, Building2, MapPin, Trash2 } from 'lucide-react';
import { getCompanies, getDevices, deleteDevice } from '@/app/actions/data';
import { Device, Company } from '@/lib/types/audit';

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [deleteTarget, setDeleteTarget] = useState<{id: string, hostname: string} | null>(null);

  useEffect(() => {
    async function load() {
      const devs = await getDevices();
      setDevices(devs);
      const comps = await getCompanies();
      setCompanies(comps);
    }
    load();
  }, []);

  const vendors = ['ALL', 'FortiGate', 'SonicWall', 'Palo Alto'];

  const getCompanyById = (id: string) => companies.find(c => c.id === id);

  const executeDelete = async (id: string) => {
    await deleteDevice(id);
    const devs = await getDevices();
    setDevices(devs);
    const comps = await getCompanies();
    setCompanies(comps);
  };

  const filtered = devices.filter(d => {
    const matchSearch = d.hostname.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        d.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        d.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchVendor = vendorFilter === 'ALL' || d.vendor === vendorFilter;
    return matchSearch && matchVendor;
  });

  return (
    <>
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <div className="flex-row">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>Firewall Device Gateway Inventory</h2>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Cross-tenant monitoring of hardware models, firmware versions, and High Availability configurations</p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => router.push('/upload')}
        >
          <Upload size={16} /> Audit Device Configuration
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div className="search-box" style={{ width: '300px' }}>
            <Search size={16} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search hostname, serial SN, location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginRight: 4 }}>Vendor:</span>
            {vendors.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVendorFilter(v)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: vendorFilter === v ? 'var(--navy)' : 'transparent',
                  color: vendorFilter === v ? '#fff' : 'var(--slate)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <b>{filtered.length}</b> of <b>{devices.length}</b> devices
        </div>
      </div>

      {/* Devices Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Appliance Hostname</th>
              <th>Tenant Company</th>
              <th>Vendor & Model</th>
              <th>OS / Firmware</th>
              <th>HA Mode</th>
              <th>Data Center Location</th>
              <th>Last Backup</th>
              <th>Posture Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(dev => {
              const comp = getCompanyById(dev.company_id);
              return (
                <tr key={dev.id}>
                  <td>
                    <div className="flex-start">
                      <div className="stat-icon" style={{ width: 36, height: 36, background: 'var(--navy2)', color: '#fff', borderRadius: 10 }}>
                        <Server size={18} />
                      </div>
                      <div>
                        <b style={{ fontSize: 14, display: 'block', color: 'var(--navy)' }}>{dev.hostname}</b>
                        <small className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>SN: {dev.serial}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex-start" style={{ gap: 6 }}>
                      <Building2 size={14} color="var(--muted2)" />
                      <b style={{ fontSize: 13 }}>{comp?.name || 'Unknown'}</b>
                    </div>
                  </td>
                  <td>
                    <b style={{ fontSize: 13.5 }}>{dev.vendor}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Model {dev.model}</div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{dev.os_version}</span>
                  </td>
                  <td>
                    <span className="pill" style={{ background: dev.ha_status.includes('Active') ? 'var(--indigo-light)' : 'var(--bg)', color: dev.ha_status.includes('Active') ? 'var(--indigo)' : 'var(--slate)', border: '1px solid var(--line)' }}>
                      {dev.ha_status}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate)' }}>
                      <MapPin size={14} color="var(--muted2)" /> {dev.location}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {new Date(dev.last_backup_date).toLocaleDateString()}
                  </td>
                  <td>
                    {dev.latest_score ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontSize: 14 }}>{dev.latest_score}</b>
                        <span className={`grade-badge grade-${dev.latest_grade?.toLowerCase()}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                          Grade {dev.latest_grade}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>Not Audited</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="btn btn-ghost" 
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => router.push(`/upload?device=${dev.id}`)}
                      >
                        <Upload size={13} /> Audit
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-ghost" 
                        style={{ padding: '6px 14px', fontSize: 12, color: 'var(--red)' }}
                        onClick={() => setDeleteTarget({ id: dev.id, hostname: dev.hostname })}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* Delete Device Modal */}
      {deleteTarget && (
      <Portal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 440, padding: 32, boxShadow: 'var(--shadow-lg)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--crit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--crit)' }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Delete Device?</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.6, marginBottom: 32, paddingLeft: 64 }}>
              Are you sure you want to delete the firewall gateway <b>{deleteTarget.hostname}</b>? This action is permanent and will remove all associated audits for this device.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'var(--crit)', color: '#fff', padding: '10px 24px' }}
                onClick={() => {
                  executeDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </>
  );
}
