'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, FileText, CheckCircle2, ShieldAlert, Cpu, ArrowRight, Building2, Server, Download, RefreshCw, Plus, Bot, WifiOff, Settings } from 'lucide-react';
import { getCompanies, getDevices, addCompany, addDevice } from '@/app/actions/data';
import { Company, Device } from '@/lib/types/audit';
import { ParserRegistry } from '@/lib/parsers/parser-registry';
import { Select } from '@/components/ui/select';
import { saveUploadData } from '@/lib/utils/large-file-storage';

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('auto');
  
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [detectedVendor, setDetectedVendor] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const comps = await getCompanies();
      setCompanies(comps);
      const devs = await getDevices();
      setDevices(devs);

      const qComp = searchParams.get('company');
      const qDev = searchParams.get('device');
      if (qComp) {
        setSelectedCompanyId(qComp);
      } else if (comps.length > 0) {
        setSelectedCompanyId(comps[0].id);
      } else {
        setSelectedCompanyId('new_company');
      }

      if (qDev) {
        setSelectedDeviceId(qDev);
      } else if (devs.length === 0) {
        setSelectedDeviceId('new_device');
      }
    }
    loadData();

    // Check AI engine status
    fetch('/api/settings/ai')
      .then(r => r.json())
      .then(d => {
        setAiConfigured(d.configured ?? false);
        setAiModel(d.config?.model ?? '');
      })
      .catch(() => setAiConfigured(false));
  }, [searchParams]);

  useEffect(() => {
    if (selectedCompanyId) {
      const compDevs = devices.filter(d => d.company_id === selectedCompanyId);
      if (compDevs.length > 0 && !compDevs.some(d => d.id === selectedDeviceId)) {
        setSelectedDeviceId(compDevs[0].id);
      }
    }
  }, [selectedCompanyId, devices, selectedDeviceId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string || '';
      setFileContent(content);
      const res = ParserRegistry.autoDetect(content);
      setDetectedVendor(res.detectedVendor);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleUseSample = async () => {
    setFileName('sample-fortigate.conf');
    setDetectedVendor('FortiGate (Auto-Detected)');
    // Fetch or use embedded sample string
    const sampleText = `# config-version=FGT60F-7.4.3-FW-build2571-240101
config system global
    set hostname "FGT-60F-HQ"
    set admintimeout 30
end
config system admin
    edit "admin"
        set accprofile "super_admin"
        set two-factor disable
    next
end
config system interface
    edit "wan1"
        set ip 203.0.113.50 255.255.255.248
        set allowaccess https ping ssh telnet http
    next
    edit "internal"
        set ip 192.168.10.1 255.255.255.0
        set allowaccess https ping ssh http
    next
end
config log syslogd setting
    set status disable
end
config firewall policy
    edit 1
        set name "WAN_to_DMZ"
        set srcintf "wan1"
        set dstintf "dmz"
        set srcaddr "all"
        set dstaddr "all"
        set service "ALL"
        set action accept
        set logtraffic disable
    next
    edit 2
        set name "LAN_Outbound"
        set srcintf "internal"
        set dstintf "wan1"
        set srcaddr "all"
        set dstaddr "all"
        set service "HTTP" "HTTPS"
        set action accept
        set logtraffic all
    next
end`;
    setFileContent(sampleText);
  };

  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent) {
      alert('Please upload a configuration file or load the sample file first.');
      return;
    }

    setIsSubmitting(true);
    try {
      let activeCompanyId = selectedCompanyId;
      if (activeCompanyId === 'new_company') {
        if (!newCompanyName.trim()) {
          alert('Please enter a new company name.');
          setIsSubmitting(false);
          return;
        }
        const createdCompany = await addCompany({
          name: newCompanyName,
          contact_person: '',
          contact_email: '',
          industry: 'Other',
          notes: '',
          avatar_initials: newCompanyName.slice(0, 2).toUpperCase(),
          devices_count: 0,
          latest_score: 0,
          latest_grade: 'N/A',
          open_findings_count: 0
        });
        activeCompanyId = createdCompany.id;
      }

      let activeDeviceId = selectedDeviceId;
      if (activeDeviceId === 'new_device' || !activeDeviceId) {
        const createdDevice = await addDevice({
          company_id: activeCompanyId,
          hostname: fileName.split('.')[0] || 'Unknown-Device',
          vendor: selectedVendor === 'auto' ? (detectedVendor.split(' ')[0] || 'FortiGate') : selectedVendor,
          model: 'Unknown',
          os_version: 'Unknown',
          serial: 'N/A',
          ha_status: 'Standalone',
          location: 'TBD',
          last_backup_date: new Date().toISOString().split('T')[0],
          latest_score: 0,
          latest_grade: 'F',
          last_audit_date: new Date().toISOString().split('T')[0]
        });
        activeDeviceId = createdDevice.id;
      }

      const vendorToUse = selectedVendor === 'auto' ? (detectedVendor.split(' ')[0] || 'FortiGate') : selectedVendor;

      // 1. Immediately store configuration in database and trigger background AI scan
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent,
          fileName: fileName || 'backup.conf',
          companyId: activeCompanyId,
          deviceId: activeDeviceId,
          vendor: vendorToUse
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to start background audit.');
      }

      const startData = await res.json();

      // 2. Cache in client storage for offline/fallback access
      await saveUploadData({
        fileContent,
        fileName: fileName || 'backup.conf',
        companyId: activeCompanyId,
        deviceId: activeDeviceId,
        vendor: vendorToUse
      });

      // 3. Navigate immediately to Audit Results directory so user can monitor progress and continue other tasks
      router.push('/audit/results');
    } catch (err) {
      console.error(err);
      alert('An error occurred while preparing the audit: ' + (err as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '900px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Upload Device Configuration Backup</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Select target client tenant and upload offline configuration backup for automated parsing and compliance grading</p>
      </div>

      {/* AI Engine Status Banner */}
      {aiConfigured === true && (
        <div className="animate-fade-in" style={{ padding: '12px 18px', background: 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(6,182,212,0.08))', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--indigo), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>AI Engine Active</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              This audit will use AI-powered block analysis{aiModel ? ` (${aiModel})` : ''} — all configuration blocks will be evaluated by the AI for maximum accuracy.
            </p>
          </div>
          <span className="pill pill-ok" style={{ marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>Ready</span>
        </div>
      )}
      {aiConfigured === false && (
        <div className="animate-fade-in" style={{ padding: '12px 18px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <WifiOff size={20} color="#a16207" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>AI Engine Not Configured</p>
            <p style={{ fontSize: 12, color: '#a16207', margin: 0 }}>The audit will use static rule evaluation which may produce inaccurate results. Configure AI for best accuracy.</p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0, borderColor: '#d97706', color: '#92400e' }} onClick={() => router.push('/settings?tab=ai')}>
            <Settings size={13} /> Configure AI
          </button>
        </div>
      )}

      <form onSubmit={handleStartAudit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Step 1: Target Tenant & Device Selection */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="step-circle" style={{ width: 26, height: 26, fontSize: 12, margin: 0, background: 'var(--navy)', color: '#fff' }}>1</span>
            Select Target Client Tenant & Appliance
          </h3>
          
          <div className="grid-2" style={{ gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 8 }}>
                Client Company Tenant
              </label>
              <Select
                value={selectedCompanyId}
                onChange={(val) => {
                  setSelectedCompanyId(val);
                  setSelectedDeviceId(''); // Reset device selection when company changes
                }}
                icon={<Building2 size={16} />}
                options={[
                  ...companies.map(c => ({ value: c.id, label: `${c.name} (${c.industry})` })),
                  { value: 'new_company', label: '[ + Add New Company ]' }
                ]}
              />
              {selectedCompanyId === 'new_company' && (
                <div style={{ marginTop: 12 }}>
                  <input 
                    type="text" 
                    placeholder="Enter new company name..." 
                    value={newCompanyName} 
                    onChange={e => setNewCompanyName(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--cyan)', outline: 'none' }} 
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', display: 'block', marginBottom: 8 }}>
                Target Firewall Appliance
              </label>
              <Select
                value={selectedDeviceId}
                onChange={setSelectedDeviceId}
                icon={<Server size={16} />}
                options={
                  devices.filter(d => d.company_id === selectedCompanyId).length > 0
                    ? devices.filter(d => d.company_id === selectedCompanyId).map(d => ({
                        value: d.id,
                        label: `${d.hostname} (${d.vendor} ${d.model})`
                      }))
                    : [{ value: 'new_device', label: 'Auto-Register New Appliance' }]
                }
              />
            </div>
          </div>
        </div>

        {/* Step 2: Upload File & Vendor Detection */}
        <div className="card">
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="step-circle" style={{ width: 26, height: 26, fontSize: 12, margin: 0, background: 'var(--navy)', color: '#fff' }}>2</span>
              Upload Backup File or Load Sample
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Vendor Parser:</label>
              <Select
                value={selectedVendor}
                onChange={setSelectedVendor}
                style={{ minWidth: 260 }}
                options={[
                  { value: 'auto', label: 'Auto-Detect Vendor (Recommended)' },
                  { value: 'FortiGate', label: 'FortiGate (FortiOS .conf)' },
                  { value: 'SonicWall', label: 'SonicWall (SonicOS .exp)' },
                  { value: 'Palo Alto', label: 'Palo Alto (PanOS .xml/.txt)' }
                ]}
              />
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            className={`upload-zone ${isDragging ? 'bg-cyan-50 border-cyan-500' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept=".conf,.exp,.cfg,.txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {fileContent ? (
              <div className="animate-fade-in" style={{ padding: '16px', background: 'var(--green-bg)', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.3)', display: 'inline-block', maxWidth: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', color: 'var(--green)', marginBottom: 8 }}>
                  <CheckCircle2 size={32} />
                  <div style={{ textAlign: 'left' }}>
                    <b style={{ fontSize: 16, display: 'block', color: 'var(--txt)' }}>{fileName}</b>
                    <span className="pill pill-ok" style={{ fontSize: 11, marginTop: 4 }}>{detectedVendor || 'Vendor Verified'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  File loaded ({Math.round(fileContent.length / 1024)} KB) • Click box to replace file
                </div>
              </div>
            ) : (
              <div>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--cyan-light)', color: 'var(--cyan-d)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Upload size={32} />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
                  Drag & Drop Configuration File Here
                </h4>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                  Supports FortiOS (.conf), SonicWall (.exp), and text backup formats
                </p>
                <span className="btn btn-ghost" style={{ fontSize: 13 }}>Browse Local Computer</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="var(--cyan-d)" />
              Don&apos;t have a file right now? Use our pre-packaged FortiGate HQ configuration backup.
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '6px 14px', borderColor: 'var(--cyan)', color: 'var(--cyan-d)' }}
              onClick={handleUseSample}
            >
              <Download size={14} /> Load Sample FortiGate HQ Backup
            </button>
          </div>
        </div>

        {/* Step 3: Submit CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push('/dashboard')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ padding: '14px 32px', fontSize: 15 }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Saving & Starting Background AI Scan...</span>
              </>
            ) : (
              <>
                {aiConfigured ? <Bot size={18} /> : <Cpu size={18} />}
                <span>{aiConfigured ? 'Start AI-Powered Audit' : 'Execute Audit Engine'}</span> <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading upload workspace...</div>}>
      <UploadContent />
    </Suspense>
  );
}
