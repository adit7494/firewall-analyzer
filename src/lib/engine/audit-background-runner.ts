import { EventEmitter } from 'events';
import prisma from '@/lib/db/prisma';
import { AuditEngine, ProgressEmitter } from '@/lib/engine/audit-engine';
import { ScoringEngine } from '@/lib/engine/scoring-engine';
import { isAIConfigured } from '@/lib/engine/ai-client';
import { AuditResult, AuditGrade, Finding } from '@/lib/types/audit';
import { ParserRegistry } from '@/lib/parsers/parser-registry';
import { NormalizedConfig } from '@/lib/types/normalized-config';

export interface ScanLog {
  type: 'info' | 'success' | 'error' | 'ai' | 'system';
  message: string;
  timestamp: string;
}

export interface BackgroundScanItem {
  auditId: string;
  companyId: string;
  companyName: string;
  deviceId: string;
  deviceName: string;
  hostname: string;
  fileName: string;
  vendor: string;
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  progress: number; // 0 to 100
  currentBlock?: string;
  totalBlocks: number;
  completedBlocks: number;
  findingsCount: number;
  score?: number;
  grade?: AuditGrade;
  error?: string;
  startedAt: string;
  completedAt?: string;
  read?: boolean;
  logs: ScanLog[];
}

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatBlockName(blockKey: string): string {
  const labels: Record<string, string> = {
    system_global:          'System Global Settings',
    system_interface:       'Network Interface Configuration',
    system_admin:           'Administrator Accounts',
    system_ntp:             'NTP Time Synchronization',
    system_dns:             'DNS Configuration',
    system_snmp_sysinfo:    'SNMP System Information',
    system_snmp_community:  'SNMP Community Strings',
    system_password_policy: 'Password Policy',
    system_zone:            'Security Zones',
    system_ha:              'High Availability',
    system_csf:             'Security Fabric',
    system_settings:        'System Settings',
    log_fortianalyzer:      'FortiAnalyzer Logging',
    log_fortianalyzer2:     'FortiAnalyzer2 Logging',
    log_syslogd:            'Syslog Configuration',
    firewall_policy:        'Firewall Policy Rulebase',
    firewall_local_in_policy: 'Local-In Management Policies',
    ips_sensor:             'IPS Sensor Profiles',
    antivirus_profile:      'Antivirus Profiles',
    antivirus_settings:     'Antivirus Global Settings',
    dnsfilter_profile:      'DNS Filter Profiles',
    webfilter_profile:      'Web Filter Profiles',
    application_list:       'Application Control Profiles',
    vpn_ssl_settings:       'SSL-VPN Configuration',
    vpn_ipsec_phase1:       'IPsec VPN Tunnels (Phase 1)',
    vpn_ipsec_phase2:       'IPsec VPN Tunnels (Phase 2)',
  };
  return labels[blockKey] ?? blockKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

class AuditBackgroundRunnerService {
  private activeScans = new Map<string, BackgroundScanItem>();
  private completedScans = new Map<string, BackgroundScanItem>();
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  getActiveScans(): BackgroundScanItem[] {
    return Array.from(this.activeScans.values());
  }

  getCompletedScans(): BackgroundScanItem[] {
    return Array.from(this.completedScans.values()).sort(
      (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );
  }

  getScan(auditId: string): BackgroundScanItem | undefined {
    return this.activeScans.get(auditId) || this.completedScans.get(auditId);
  }

  markAsRead(auditId: string) {
    const scan = this.completedScans.get(auditId);
    if (scan) {
      scan.read = true;
    }
  }

  markAllAsRead() {
    for (const scan of this.completedScans.values()) {
      scan.read = true;
    }
  }

  dismiss(auditId: string) {
    this.completedScans.delete(auditId);
  }

  subscribe(auditId: string, listener: (event: any) => void): () => void {
    const eventName = `audit:${auditId}`;
    this.emitter.on(eventName, listener);
    return () => {
      this.emitter.off(eventName, listener);
    };
  }

  private emitEvent(auditId: string, event: any) {
    this.emitter.emit(`audit:${auditId}`, event);
  }

  /**
   * Starts a background scan asynchronously.
   * Immediately saves the scan state into memory and processes without blocking.
   */
  startScan(params: {
    auditId: string;
    fileContent: string;
    fileName: string;
    companyId: string;
    companyName: string;
    deviceId: string;
    deviceName: string;
    vendor?: string;
  }): BackgroundScanItem {
    const { auditId, fileContent, fileName, companyId, companyName, deviceId, deviceName, vendor } = params;

    const { config, vendorUsed } = ParserRegistry.parseConfig(fileContent, vendor || 'auto', fileName);
    const hostname = config.device?.hostname || deviceName || fileName.split('.')[0] || 'Firewall';

    const scan: BackgroundScanItem = {
      auditId,
      companyId,
      companyName,
      deviceId,
      deviceName: hostname,
      hostname,
      fileName,
      vendor: vendorUsed,
      status: 'in_progress',
      progress: 5,
      currentBlock: 'Saving configuration & initializing AI engine',
      totalBlocks: 0,
      completedBlocks: 0,
      findingsCount: 0,
      startedAt: new Date().toISOString(),
      read: false,
      logs: [
        {
          type: 'system',
          message: `Configuration backup stored for ${hostname} (${Math.round(fileContent.length / 1024)} KB)`,
          timestamp: now(),
        },
        {
          type: 'info',
          message: `Identified vendor: ${vendorUsed} — Appliance Hostname: ${hostname}`,
          timestamp: now(),
        },
      ],
    };

    this.activeScans.set(auditId, scan);
    this.emitEvent(auditId, { type: 'parsing', message: `Parsing configuration file: ${fileName}` });
    this.emitEvent(auditId, { type: 'parsed', vendor: vendorUsed, hostname });

    // Run in background without awaiting
    this.executeAuditTask(scan, config, vendorUsed).catch((err) => {
      console.error(`[AuditBackgroundRunner] Error running audit ${auditId}:`, err);
    });

    return scan;
  }

  private async executeAuditTask(
    scan: BackgroundScanItem,
    config: NormalizedConfig,
    vendorUsed: string
  ) {
    const { auditId } = scan;

    const addLog = (type: ScanLog['type'], message: string) => {
      scan.logs.push({ type, message, timestamp: now() });
    };

    try {
      const aiEnabled = await isAIConfigured();
      let findings: Finding[] = [];
      let rulesAnalyzed = 0;

      if (aiEnabled) {
        addLog('info', 'AI engine active — initializing configuration block evaluator.');
        this.emitEvent(auditId, { type: 'info', message: 'AI engine active — extracting config blocks...' });

        const progressEmitter: ProgressEmitter = (event) => {
          switch (event.type) {
            case 'extracted': {
              scan.totalBlocks = event.totalBlocks;
              scan.progress = 15;
              scan.currentBlock = `Extracted ${event.totalBlocks} config blocks`;
              addLog('info', `Extracted ${event.totalBlocks} configuration block types for AI analysis`);
              this.emitEvent(auditId, { type: 'extracted', totalBlocks: event.totalBlocks });
              break;
            }
            case 'block_start': {
              const label = formatBlockName(event.block);
              scan.currentBlock = label;
              addLog('ai', `⟳ Analyzing: ${label}`);
              this.emitEvent(auditId, { type: 'block_start', block: event.block, message: `Analyzing: ${label}` });
              break;
            }
            case 'block_done': {
              scan.completedBlocks++;
              scan.findingsCount += event.findingsCount;
              const pct = scan.totalBlocks > 0
                ? Math.min(92, Math.round(15 + (scan.completedBlocks / scan.totalBlocks) * 75))
                : 50;
              scan.progress = pct;
              const label = formatBlockName(event.block);
              addLog('ai', `✓ Completed: ${label} — ${event.findingsCount === 0 ? 'No issues found' : `${event.findingsCount} finding(s)`}`);
              this.emitEvent(auditId, {
                type: 'block_done',
                block: event.block,
                findingsCount: event.findingsCount,
                message: `Completed: ${label} — ${event.findingsCount} finding(s)`,
              });
              break;
            }
            case 'block_error': {
              addLog('error', `AI evaluation notice (${event.block}): ${event.error}`);
              this.emitEvent(auditId, { type: 'error', block: event.block, message: event.error });
              break;
            }
            case 'scoring': {
              scan.currentBlock = 'Calculating Security Posture';
              scan.progress = 95;
              addLog('info', 'Calculating security posture score...');
              this.emitEvent(auditId, { type: 'scoring', message: 'Calculating security posture score...' });
              break;
            }
          }
        };

        const result = await AuditEngine.runAuditWithAI(config, auditId, progressEmitter);
        findings = result.findings;
        rulesAnalyzed = result.blocksAnalyzed;
      } else {
        addLog('info', 'AI engine not configured — evaluating with CIS static rule engine.');
        this.emitEvent(auditId, { type: 'info', message: 'AI engine not configured — using static rule evaluation.' });
        const result = AuditEngine.runAudit(config, auditId);
        findings = result.findings;
        rulesAnalyzed = result.rulesAnalyzed;
      }

      // Step: Calculate posture score
      const { score, grade, breakdown, score_breakdown } = ScoringEngine.calculateScore(findings, vendorUsed);
      scan.score = score;
      scan.grade = grade as AuditGrade;
      scan.progress = 100;
      scan.status = 'done';
      scan.completedAt = new Date().toISOString();
      scan.currentBlock = 'Completed';

      addLog('success', `Security posture calculated — Score: ${score}/100, Grade: ${grade}`);
      addLog('success', `Audit complete! Grade: ${grade} (${score}/100) — ${findings.length} findings recorded`);

      this.emitEvent(auditId, { type: 'scoring_done', score, grade });

      // Step: Save final audit record to database
      const finalAudit: AuditResult = {
        id: auditId,
        company_id: scan.companyId,
        device_id: scan.deviceId,
        vendor: vendorUsed,
        config_file_name: scan.fileName,
        status: 'done',
        score,
        grade: grade as AuditGrade,
        created_by: 'System',
        created_at: scan.startedAt,
        findings,
        breakdown,
        score_breakdown,
        rules_analyzed: rulesAnalyzed,
        controls_checked: rulesAnalyzed,
      };

      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'done',
          score,
          grade,
          data: JSON.stringify(finalAudit),
        },
      });

      // Update Device record in database
      await prisma.device.update({
        where: { id: scan.deviceId },
        data: {
          hostname: config.device?.hostname || undefined,
          model: config.device?.model || undefined,
          os_version: config.device?.os_version || undefined,
          serial: config.device?.serial || undefined,
          last_audit_date: new Date().toISOString().split('T')[0],
          latest_score: score,
          latest_grade: grade,
        },
      });

      // Update Company average score
      const allDevices = await prisma.device.findMany({ where: { company_id: scan.companyId } });
      const devicesWithScore = allDevices.filter(d => d.latest_score != null);
      const totalScore = devicesWithScore.reduce((acc, d) => acc + (d.latest_score ?? 0), 0);
      const avgScore = devicesWithScore.length > 0 ? Math.round(totalScore / devicesWithScore.length) : score;
      const avgGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F';
      await prisma.company.update({
        where: { id: scan.companyId },
        data: { latest_score: avgScore, latest_grade: avgGrade, devices_count: allDevices.length },
      });

      // Move scan from active to completed list
      this.activeScans.delete(auditId);
      this.completedScans.set(auditId, scan);

      this.emitEvent(auditId, {
        type: 'done',
        auditId,
        score,
        grade,
        findingsTotal: findings.length,
        aiEnabled,
      });

    } catch (err) {
      const message = (err as Error).message ?? 'An unexpected error occurred during the background audit.';
      scan.status = 'failed';
      scan.error = message;
      scan.completedAt = new Date().toISOString();
      scan.progress = 100;
      addLog('error', message);

      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'failed',
          score: 0,
          grade: 'F',
        },
      }).catch(() => {});

      this.activeScans.delete(auditId);
      this.completedScans.set(auditId, scan);

      this.emitEvent(auditId, { type: 'error', message });
    }
  }
}

// Global singleton to survive Fast Refresh in Next.js development
const globalRunnerKey = '__FIREWALL_AUDIT_BACKGROUND_RUNNER__';
const runnerInstance: AuditBackgroundRunnerService =
  (globalThis as any)[globalRunnerKey] || new AuditBackgroundRunnerService();
(globalThis as any)[globalRunnerKey] = runnerInstance;

export const auditBackgroundRunner = runnerInstance;
