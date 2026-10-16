import { NextRequest } from 'next/server';
import { ParserRegistry } from '@/lib/parsers/parser-registry';
import { AuditEngine, ProgressEmitter } from '@/lib/engine/audit-engine';
import { isAIConfigured } from '@/lib/engine/ai-client';
import { ScoringEngine } from '@/lib/engine/scoring-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | undefined;

  const stream = new ReadableStream({
    start(c) { controller = c; },
  });

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  function emit(data: object) {
    try {
      controller?.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Stream may be closed
    }
  }

  (async () => {
    try {
      const body = await req.json() as {
        fileContent: string;
        fileName: string;
        vendor: string;
      };

      const { fileContent, fileName, vendor } = body;

      if (!fileContent) {
        emit({ type: 'error', message: 'Missing required field: fileContent.' });
        controller?.close();
        return;
      }

      emit({ type: 'parsing', message: `Parsing configuration file: ${fileName}` });
      const { config, vendorUsed } = ParserRegistry.parseConfig(fileContent, vendor || 'auto', fileName);
      emit({ type: 'parsed', vendor: vendorUsed, hostname: config.device.hostname });

      const auditId = `diag-${Date.now().toString().slice(-8)}`;
      const aiEnabled = await isAIConfigured();

      if (!aiEnabled) {
        emit({ type: 'error', message: 'AI Engine is not configured. Diagnostic audit requires AI.' });
        controller?.close();
        return;
      }

      const progressEmitter: ProgressEmitter = (event) => {
        switch (event.type) {
          case 'extracted':
            emit({ type: 'extracted', totalBlocks: event.totalBlocks });
            break;
          case 'block_start':
            emit({ type: 'block_start', block: event.block, message: `Analyzing: ${formatBlockName(event.block)}` });
            break;
          case 'block_done':
            emit({ type: 'block_done', block: event.block, findingsCount: event.findingsCount, message: `Completed: ${formatBlockName(event.block)} — ${event.findingsCount} finding(s)` });
            break;
          case 'block_telemetry':
            // Emit telemetry directly to the frontend
            emit({ type: 'block_telemetry', block: event.block, rawResponse: event.rawResponse, prompt: event.prompt, telemetry: event.telemetry });
            break;
          case 'block_error':
            emit({ type: 'error', block: event.block, message: event.error });
            break;
          case 'scoring':
            emit({ type: 'scoring', message: 'Calculating security posture score...' });
            break;
        }
      };

      const result = await AuditEngine.runAuditWithAI(config, auditId, progressEmitter);
      
      const { score, grade } = ScoringEngine.calculateScore(result.findings, vendorUsed);
      emit({ type: 'scoring_done', score, grade });

      // Unlike run/route.ts, we DO NOT save to DB here.
      emit({ type: 'done', auditId, score, grade, findingsTotal: result.findings.length, aiEnabled });

    } catch (err) {
      const message = (err as Error).message ?? 'An unexpected error occurred during the audit.';
      emit({ type: 'error', message });
    } finally {
      try { controller?.close(); } catch { /* already closed */ }
    }
  })();

  return response;
}

function formatBlockName(blockKey: string): string {
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
