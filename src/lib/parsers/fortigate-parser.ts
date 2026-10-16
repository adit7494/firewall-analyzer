import type { FirewallParser } from './parser-interface';
import type { 
  NormalizedConfig, 
  AdminAccount, 
  NetworkInterface, 
  FirewallRule, 
  AddressObject, 
  ServiceObject 
} from '../types/normalized-config';

/**
 * Tokenizes a FortiOS CLI line, respecting quoted substrings with spaces.
 * Example: `set member "Web Server 1" "DB Server" port1`
 * Returns: `['set', 'member', 'Web Server 1', 'DB Server', 'port1']`
 */
export function tokenizeFortiLine(line: string): string[] {
  if (!line) return [];
  const matches = line.match(/"([^"]*)"|'([^']*)'|(\S+)/g);
  if (!matches) return [];
  return matches.map(token => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1);
    }
    return token;
  });
}

/**
 * Removes surrounding single or double quotes from a string.
 */
export function unquote(str: string | undefined): string {
  if (!str) return '';
  const trimmed = str.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Represents a node in the FortiOS configuration AST.
 */
export interface FortiNode {
  type: 'config' | 'edit';
  name: string;
  settings: Map<string, string>;
  children: FortiNode[];
  rawLines: string[];
}

/**
 * Builds an AST tree from raw FortiOS configuration text.
 * Single pass depth parser:
 * - `config <name>` pushes a config node.
 * - `edit <name>` pushes an edit node.
 * - `set <key> <val>` records settings on the current node.
 * - `next` pops an edit node.
 * - `end` pops a config node.
 */
export function parseFortiAST(rawConfigText: string): FortiNode {
  const root: FortiNode = {
    type: 'config',
    name: 'root',
    settings: new Map(),
    children: [],
    rawLines: []
  };

  const lines = rawConfigText.split(/\r?\n/);
  const stack: FortiNode[] = [root];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('config ') || trimmed === 'config') {
      const configName = trimmed.replace(/^config\s*/, '').trim();
      const node: FortiNode = {
        type: 'config',
        name: configName,
        settings: new Map(),
        children: [],
        rawLines: [line]
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (trimmed.startsWith('edit ') || trimmed === 'edit') {
      const rawEditName = trimmed.replace(/^edit\s*/, '').trim();
      const editName = unquote(rawEditName);
      const node: FortiNode = {
        type: 'edit',
        name: editName,
        settings: new Map(),
        children: [],
        rawLines: [line]
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (trimmed === 'next') {
      if (stack.length > 1) {
        stack[stack.length - 1].rawLines.push(line);
        // Find topmost edit node to pop
        if (stack[stack.length - 1].type === 'edit') {
          stack.pop();
        } else {
          // In case of slight syntax irregularities, search up stack for edit
          const editIdx = stack.map(s => s.type).lastIndexOf('edit');
          if (editIdx > 0) {
            stack.splice(editIdx, 1);
          }
        }
      }
    } else if (trimmed === 'end') {
      if (stack.length > 1) {
        stack[stack.length - 1].rawLines.push(line);
        // Find topmost config node to pop
        if (stack[stack.length - 1].type === 'config') {
          stack.pop();
        } else {
          const configIdx = stack.map(s => s.type).lastIndexOf('config');
          if (configIdx > 0) {
            stack.splice(configIdx);
          }
        }
      }
    } else if (trimmed.startsWith('set ')) {
      const rest = trimmed.replace(/^set\s+/, '').trim();
      const spIdx = rest.indexOf(' ');
      let key = rest;
      let val = '';
      if (spIdx !== -1) {
        key = rest.substring(0, spIdx);
        val = rest.substring(spIdx + 1).trim();
      }
      stack[stack.length - 1].settings.set(key, val);
      stack[stack.length - 1].rawLines.push(line);
    } else {
      if (stack.length > 0) {
        stack[stack.length - 1].rawLines.push(line);
      }
    }
  }

  return root;
}

/**
 * Helper to find all child config nodes matching a given name.
 */
export function findConfigs(parent: FortiNode, name: string): FortiNode[] {
  return parent.children.filter(c => c.type === 'config' && c.name.toLowerCase() === name.toLowerCase());
}

/**
 * Helper to find the first child config node matching a given name.
 */
export function findConfig(parent: FortiNode, name: string): FortiNode | undefined {
  return parent.children.find(c => c.type === 'config' && c.name.toLowerCase() === name.toLowerCase());
}

/**
 * Helper to get all direct edit children of a config node.
 */
export function getEdits(configNode: FortiNode | undefined): FortiNode[] {
  if (!configNode) return [];
  return configNode.children.filter(c => c.type === 'edit');
}

export class FortiGateParser implements FirewallParser {
  vendor = 'FortiGate';
  name = 'FortiOS Configuration Parser';
  version = '2.1.0';
  supportedFileTypes = ['.conf', '.txt', '.cfg'];

  detect(rawConfigText: string): boolean {
    const text = rawConfigText.toLowerCase();
    return (
      /#\s*config-version\s*=\s*fgt/i.test(text) ||
      text.includes('#config-version=') ||
      text.includes('# config-version=') ||
      text.includes('config system global') ||
      text.includes('config firewall policy') ||
      text.includes('fortios') ||
      text.includes('fortigate')
    );
  }

  parse(rawConfigText: string, fileName?: string): NormalizedConfig {
    const lines = rawConfigText.split(/\r?\n/);
    const ast = parseFortiAST(rawConfigText);

    // -----------------------------------------------------------------------
    // Device identity & Header Metadata
    // -----------------------------------------------------------------------
    let hostname = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'FGT-Device';
    let model = 'FortiGate';
    let os_version = 'Unknown';
    let serial = '';
    let ha_status: 'Active-Passive' | 'Active-Active' | 'Standalone' | 'Unknown' = 'Unknown';

    // Parse header lines (supporting both `#config-version=` and `# config-version=`)
    for (const line of lines.slice(0, 30)) {
      const match = line.match(/^#\s*config-version=([^\s:]+)/i);
      if (match) {
        const verStr = match[1];
        const parts = verStr.split('-');
        if (parts.length >= 2) {
          const modelRaw = parts[0];
          model = modelRaw.startsWith('FGT') ? `FortiGate-${modelRaw.replace(/^FGT-?/, '')}` : modelRaw;
          os_version = parts[1];
        }
      }
      const serialMatch = line.match(/^#\s*(?:serial[-_]?number|serial)\s*=\s*([A-Za-z0-9_-]+)/i);
      if (serialMatch && !serial) {
        serial = serialMatch[1];
      }
    }

    // Secondary serial number extraction if not in header comments:
    if (!serial) {
      // 1. Check federated-upgrade node-list
      const fedUpgrade = findConfig(ast, 'system federated-upgrade');
      if (fedUpgrade) {
        const nodeList = findConfig(fedUpgrade, 'node-list');
        const edits = getEdits(nodeList);
        if (edits.length > 0 && edits[0].name) {
          serial = edits[0].name;
        }
      }
    }
    if (!serial) {
      // 2. Check csf-device setting in dashboard widgets or csf config
      const csfMatch = rawConfigText.match(/set\s+csf-device\s+"([A-Za-z0-9_-]+)"/i);
      if (csfMatch) {
        serial = csfMatch[1];
      }
    }
    if (!serial) {
      // 3. Check system csf trusted-list
      const csf = findConfig(ast, 'system csf');
      if (csf) {
        const trustedList = findConfig(csf, 'trusted-list');
        const edits = getEdits(trustedList);
        if (edits.length > 0 && edits[0].name) {
          serial = edits[0].name;
        }
      }
    }
    if (!serial) {
      // 4. Check explicit serial-number or device-id
      const devIdMatch = rawConfigText.match(/set\s+(?:device-id|serial-number)\s+"?([A-Za-z0-9_-]+)"?/i);
      if (devIdMatch) {
        serial = devIdMatch[1];
      }
    }

    // -----------------------------------------------------------------------
    // Parse config system global
    // -----------------------------------------------------------------------
    const globalNodes = findConfigs(ast, 'system global');
    let preLoginBannerEnabled: boolean | undefined;
    let postLoginBannerEnabled: boolean | undefined;
    let adminLockoutThreshold: number | undefined;
    let adminLockoutDuration: number | undefined;
    let adminIdleTimeout: number | undefined;
    let adminPort: number | undefined;
    let adminSport: number | undefined;
    let httpsRedirectDisabled = false;
    let virtualPatchEnabled = false;
    let sslStaticKeyCiphersDisabled: boolean | undefined;
    let strongCryptoEnabled: boolean | undefined;
    let adminHttpsSslVersions: string[] | undefined;
    let guiCdnUsageEnabled: boolean | undefined;
    let logSingleCpuHighEnabled: boolean | undefined;
    let guiDisplayHostnameDisabled: boolean | undefined;
    let timezone: string | undefined;

    for (const g of globalNodes) {
      const h = g.settings.get('hostname');
      if (h) hostname = unquote(h);

      const plb = g.settings.get('pre-login-banner');
      if (plb) preLoginBannerEnabled = plb.includes('enable');

      const postlb = g.settings.get('post-login-banner');
      if (postlb) postLoginBannerEnabled = postlb.includes('enable');

      const alt = g.settings.get('admin-lockout-threshold');
      if (alt) {
        const v = parseInt(alt, 10);
        if (!isNaN(v)) adminLockoutThreshold = v;
      }

      const ald = g.settings.get('admin-lockout-duration');
      if (ald) {
        const v = parseInt(ald, 10);
        if (!isNaN(v)) adminLockoutDuration = v;
      }

      const at = g.settings.get('admintimeout');
      if (at) {
        const v = parseInt(at, 10);
        if (!isNaN(v)) adminIdleTimeout = v;
      }

      const ap = g.settings.get('admin-port');
      if (ap) {
        const v = parseInt(ap, 10);
        if (!isNaN(v)) adminPort = v;
      }

      const as = g.settings.get('admin-sport');
      if (as) {
        const v = parseInt(as, 10);
        if (!isNaN(v)) adminSport = v;
      }

      const hr = g.settings.get('https-redirect');
      if (hr) httpsRedirectDisabled = hr.includes('disable');

      const vp = g.settings.get('virtual-patch');
      if (vp) virtualPatchEnabled = vp.includes('enable');

      const ssk = g.settings.get('ssl-static-key-ciphers');
      if (ssk) sslStaticKeyCiphersDisabled = ssk.includes('disable');

      const sc = g.settings.get('strong-crypto');
      if (sc) strongCryptoEnabled = sc.includes('enable');

      const ahsv = g.settings.get('admin-https-ssl-versions');
      if (ahsv) adminHttpsSslVersions = tokenizeFortiLine(ahsv);

      const gcu = g.settings.get('gui-cdn-usage');
      if (gcu) guiCdnUsageEnabled = gcu.includes('enable');

      const lsch = g.settings.get('log-single-cpu-high');
      if (lsch) logSingleCpuHighEnabled = lsch.includes('enable');

      const gdh = g.settings.get('gui-display-hostname');
      if (gdh) guiDisplayHostnameDisabled = gdh.includes('disable');

      const tz = g.settings.get('timezone');
      if (tz) timezone = tz;
    }

    // -----------------------------------------------------------------------
    // Parse config system ha
    // -----------------------------------------------------------------------
    const haNodes = findConfigs(ast, 'system ha');
    let haMode = 'standalone';
    let haGroupName = '';
    const haHbdev: string[] = [];
    const haMonitorIntf: string[] = [];
    let haReservedMgmt = false;
    let haReservedMgmtIntf = '';
    let haReservedMgmtGw = '';
    let haGroupId: number | undefined;

    for (const h of haNodes) {
      const mode = h.settings.get('mode');
      if (mode) {
        haMode = mode.toLowerCase();
        if (haMode === 'a-p') ha_status = 'Active-Passive';
        else if (haMode === 'a-a') ha_status = 'Active-Active';
        else if (haMode === 'standalone') ha_status = 'Standalone';
      }

      const gn = h.settings.get('group-name');
      if (gn) haGroupName = unquote(gn);

      const hb = h.settings.get('hbdev');
      if (hb) haHbdev.push(...tokenizeFortiLine(hb));

      const mon = h.settings.get('monitor');
      if (mon) haMonitorIntf.push(...tokenizeFortiLine(mon));

      const hms = h.settings.get('ha-mgmt-status');
      if (hms) haReservedMgmt = hms.includes('enable');

      const hmi = h.settings.get('ha-mgmt-interface');
      if (hmi) haReservedMgmtIntf = unquote(hmi);

      const hmg = h.settings.get('ha-mgmt-interface-gateway');
      if (hmg) haReservedMgmtGw = hmg;

      const gid = h.settings.get('group-id');
      if (gid) {
        const v = parseInt(gid, 10);
        if (!isNaN(v)) haGroupId = v;
      }
    }
    if (ha_status === 'Unknown') ha_status = 'Standalone';

    // -----------------------------------------------------------------------
    // Parse config system password-policy
    // -----------------------------------------------------------------------
    const pwdNodes = findConfigs(ast, 'system password-policy');
    let pwdPolicyEnabled = false;
    let pwdMinLength = 8;
    let pwdScope = 'admin';

    for (const p of pwdNodes) {
      const st = p.settings.get('status');
      if (st) pwdPolicyEnabled = st.includes('enable');

      const ml = p.settings.get('min-length');
      if (ml) {
        const v = parseInt(ml, 10);
        if (!isNaN(v)) pwdMinLength = v;
      }

      const sc = p.settings.get('scope');
      if (sc) pwdScope = sc;
    }

    // -----------------------------------------------------------------------
    // Parse Admin Accounts (config system admin & config system api-user)
    // -----------------------------------------------------------------------
    const admin_accounts: AdminAccount[] = [];

    // Parse direct administrators under config system admin
    // CRITICAL: ONLY direct children of `config system admin` (depth 1) are parsed.
    // Dashboard widgets (e.g. config gui-dashboard -> config widget -> edit 1) are
    // children of widget config nodes, NOT direct edits of system admin.
    const sysAdminNodes = findConfigs(ast, 'system admin');
    for (const sa of sysAdminNodes) {
      const directEdits = getEdits(sa);
      for (const edit of directEdits) {
        const name = edit.name;
        if (!name) continue;

        let mfaEnabled = false;
        const twoFactor = edit.settings.get('two-factor');
        if (twoFactor && twoFactor !== 'disable' && twoFactor !== '') {
          mfaEnabled = true;
        }

        const trustedHosts: string[] = [];
        for (const [key, val] of edit.settings.entries()) {
          if (/^trusthost\d*$/i.test(key) && val) {
            const host = val.trim();
            if (host && host !== '0.0.0.0 0.0.0.0' && host !== '0.0.0.0/0') {
              trustedHosts.push(host);
            }
          }
        }

        const profile = unquote(edit.settings.get('accprofile') || 'super_admin');

        admin_accounts.push({
          name,
          mfa_enabled: mfaEnabled,
          trusted_hosts: trustedHosts,
          profile,
          password_policy_strong: pwdPolicyEnabled
        });
      }
    }

    // Parse API users under config system api-user
    const apiUserNodes = findConfigs(ast, 'system api-user');
    for (const au of apiUserNodes) {
      const directEdits = getEdits(au);
      for (const edit of directEdits) {
        const name = edit.name;
        if (!name) continue;

        const trustedHosts: string[] = [];
        // Check sub-block config trusthost
        const trusthostSub = findConfig(edit, 'trusthost');
        if (trusthostSub) {
          for (const thEdit of getEdits(trusthostSub)) {
            const ipHost = thEdit.settings.get('ipv4-trusthost');
            if (ipHost && ipHost !== '0.0.0.0 0.0.0.0' && ipHost !== '0.0.0.0/0') {
              trustedHosts.push(ipHost);
            }
          }
        }

        // Also check direct settings if any
        for (const [key, val] of edit.settings.entries()) {
          if (/^trusthost\d*$/i.test(key) && val) {
            const host = val.trim();
            if (host && host !== '0.0.0.0 0.0.0.0' && host !== '0.0.0.0/0') {
              trustedHosts.push(host);
            }
          }
        }

        const profile = unquote(edit.settings.get('accprofile') || 'super_admin_readonly');

        admin_accounts.push({
          name,
          mfa_enabled: false,
          trusted_hosts: trustedHosts,
          profile,
          password_policy_strong: pwdPolicyEnabled
        });
      }
    }

    // -----------------------------------------------------------------------
    // Parse Zones (config system zone)
    // -----------------------------------------------------------------------
    const zones: { name: string; intrazone_deny: boolean }[] = [];
    const zoneIntfMap = new Map<string, string>(); // intfName -> zoneName

    const zoneConfigs = findConfigs(ast, 'system zone');
    for (const zc of zoneConfigs) {
      for (const edit of getEdits(zc)) {
        const zName = edit.name;
        const iz = edit.settings.get('intrazone');
        const intrazoneDeny = iz !== undefined && iz.includes('deny');
        zones.push({ name: zName, intrazone_deny: intrazoneDeny });

        const intfs = tokenizeFortiLine(edit.settings.get('interface') || '');
        for (const intf of intfs) {
          zoneIntfMap.set(intf.toLowerCase(), zName);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Parse Interfaces & Management Access
    // -----------------------------------------------------------------------
    const interfaces: NetworkInterface[] = [];
    let mgmtHttp = false;
    let mgmtTelnet = false;
    let allowedFromWan = false;

    const intfConfigs = findConfigs(ast, 'system interface');
    for (const ic of intfConfigs) {
      for (const edit of getEdits(ic)) {
        const name = edit.name;
        if (!name) continue;

        const ip = edit.settings.get('ip') || '0.0.0.0';
        const access = tokenizeFortiLine(edit.settings.get('allowaccess') || '');

        // Determine Zone with refined heuristics:
        // 1. Explicit `set role wan|lan|dmz`
        // 2. Zone interface mapping from `config system zone`
        // 3. Interface name heuristic (wan, internet, upstream, untrust)
        let zone: string = 'Internal';
        const role = edit.settings.get('role')?.toLowerCase();

        if (role === 'wan') {
          zone = 'WAN';
        } else if (role === 'lan') {
          zone = 'Internal';
        } else if (role === 'dmz') {
          zone = 'DMZ';
        } else {
          // Check zone mapping
          const mappedZone = zoneIntfMap.get(name.toLowerCase());
          if (mappedZone) {
            const lz = mappedZone.toLowerCase();
            if (lz.includes('wan') || lz.includes('internet') || lz.includes('untrust')) zone = 'WAN';
            else if (lz.includes('dmz')) zone = 'DMZ';
            else if (lz.includes('lan') || lz.includes('internal')) zone = 'Internal';
          } else {
            // Check name patterns
            const ln = name.toLowerCase();
            if (ln.includes('wan') || ln.includes('internet') || ln.includes('upstream') || ln.includes('outside') || ln.includes('untrust') || ln.includes('isp')) {
              zone = 'WAN';
            } else if (ln.includes('dmz')) {
              zone = 'DMZ';
            } else {
              // Default Internal — do NOT blindly assume port1/port2 are WAN
              zone = 'Internal';
            }
          }
        }

        if (access.includes('http')) mgmtHttp = true;
        if (access.includes('telnet')) mgmtTelnet = true;

        if (zone === 'WAN' && access.some(a => ['https', 'http', 'ssh', 'telnet', 'snmp'].includes(a.toLowerCase()))) {
          allowedFromWan = true;
        }

        interfaces.push({
          name,
          zone,
          ip,
          allowaccess: access
        });
      }
    }

    const mgmtHttps = interfaces.some(i => i.allowaccess.includes('https'));
    const mgmtSsh = interfaces.some(i => i.allowaccess.includes('ssh'));
    const mgmtSnmp = interfaces.some(i => i.allowaccess.includes('snmp'));

    // -----------------------------------------------------------------------
    // Parse DNS
    // -----------------------------------------------------------------------
    const dnsServers: string[] = [];
    const dnsConfigs = findConfigs(ast, 'system dns');
    for (const dc of dnsConfigs) {
      const p = dc.settings.get('primary');
      if (p && p !== '0.0.0.0') dnsServers.push(p.trim());
      const s = dc.settings.get('secondary');
      if (s && s !== '0.0.0.0') dnsServers.push(s.trim());
    }

    // -----------------------------------------------------------------------
    // Parse NTP (CLI syntax: set ntpsync enable, child config ntpserver)
    // -----------------------------------------------------------------------
    let ntpConfigured = false;
    let ntpServer = '';
    const ntpConfigs = findConfigs(ast, 'system ntp');

    for (const nc of ntpConfigs) {
      const ntpsync = nc.settings.get('ntpsync');
      const st = nc.settings.get('status');
      const type = nc.settings.get('type');

      if (ntpsync && ntpsync.includes('enable')) ntpConfigured = true;
      if (st && st.includes('enable')) ntpConfigured = true;
      if (type && (type.includes('fortinet') || type.includes('custom'))) ntpConfigured = true;

      const directServer = nc.settings.get('ntpserver') || nc.settings.get('server');
      if (directServer) {
        ntpServer = unquote(directServer);
      }

      // Check child blocks: config ntpserver
      const ntpServersSub = findConfig(nc, 'ntpserver');
      if (ntpServersSub) {
        const customServers: string[] = [];
        for (const srvEdit of getEdits(ntpServersSub)) {
          const s = srvEdit.settings.get('server');
          if (s) customServers.push(unquote(s));
        }
        if (customServers.length > 0) {
          ntpConfigured = true;
          ntpServer = customServers.join(', ');
        }
      }
    }

    if (!ntpConfigured && rawConfigText.includes('config system ntp')) {
      if (rawConfigText.includes('set ntpsync enable') || rawConfigText.includes('set status enable')) {
        ntpConfigured = true;
      }
    }

    // -----------------------------------------------------------------------
    // Parse SNMP
    // -----------------------------------------------------------------------
    let snmpV1V2cEnabled = false;
    const snmpV3Users: { name: string; notify_hosts: string[]; queries_disabled?: boolean }[] = [];
    const snmpTrapThresholds: string[] = [];

    const snmpCommConfigs = findConfigs(ast, 'system snmp community');
    for (const sc of snmpCommConfigs) {
      if (getEdits(sc).length > 0) snmpV1V2cEnabled = true;
      for (const edit of getEdits(sc)) {
        const st = edit.settings.get('status');
        if (st && st.includes('enable')) snmpV1V2cEnabled = true;
      }
    }

    const snmpUserConfigs = findConfigs(ast, 'system snmp user');
    for (const suc of snmpUserConfigs) {
      for (const edit of getEdits(suc)) {
        const uName = edit.name;
        const notifyHosts = tokenizeFortiLine(edit.settings.get('notify-hosts') || '');
        const q = edit.settings.get('queries');
        const queriesDisabled = q ? q.includes('disable') : true;

        snmpV3Users.push({
          name: uName,
          notify_hosts: notifyHosts,
          queries_disabled: queriesDisabled
        });
      }
    }

    const snmpSysConfigs = findConfigs(ast, 'system snmp sysinfo');
    for (const ssc of snmpSysConfigs) {
      if (ssc.settings.has('trap-free-memory')) snmpTrapThresholds.push('trap-free-memory');
      if (ssc.settings.has('trap-freeable-memory')) snmpTrapThresholds.push('freeable-memory');
    }

    // -----------------------------------------------------------------------
    // Parse Logging
    // -----------------------------------------------------------------------
    let remoteLogEnabled = false;
    let fazEnabled = false;
    let fazReliable = false;
    let fazEncAlgorithm = 'low';
    let syslogEnabled = false;
    let syslogReliable = false;
    let syslogEncAlgorithm = 'disable';
    let eventLoggingEnabled: boolean | undefined;

    const fazConfigs = [...findConfigs(ast, 'log fortianalyzer setting'), ...findConfigs(ast, 'log fortianalyzer2 setting')];
    for (const fc of fazConfigs) {
      const st = fc.settings.get('status');
      if (st && st.includes('enable')) { fazEnabled = true; remoteLogEnabled = true; }
      const rel = fc.settings.get('reliable');
      if (rel && rel.includes('enable')) fazReliable = true;
      const enc = fc.settings.get('enc-algorithm');
      if (enc) fazEncAlgorithm = enc;
    }

    const syslogConfigs = findConfigs(ast, 'log syslogd setting');
    for (const sc of syslogConfigs) {
      const st = sc.settings.get('status');
      if (st && st.includes('enable')) { syslogEnabled = true; remoteLogEnabled = true; }
      const rel = sc.settings.get('reliable');
      if (rel && rel.includes('enable')) syslogReliable = true;
      const enc = sc.settings.get('enc-algorithm');
      if (enc) syslogEncAlgorithm = enc;
    }

    const eventFilterConfigs = findConfigs(ast, 'log eventfilter');
    for (const ef of eventFilterConfigs) {
      const ev = ef.settings.get('event');
      if (ev) eventLoggingEnabled = ev.includes('enable');
    }

    const trafficLogEnabled = !rawConfigText.includes('set logtraffic disable');
    const securityLogEnabled = rawConfigText.includes('set utm-status enable') ||
      rawConfigText.includes('set ips-sensor') ||
      rawConfigText.includes('set av-profile');

    const remoteTargets: string[] = [];
    if (fazEnabled) remoteTargets.push('FortiAnalyzer');
    if (syslogEnabled) remoteTargets.push('Syslog');

    // -----------------------------------------------------------------------
    // Parse Address Objects & Address Groups
    // -----------------------------------------------------------------------
    const address_objects: AddressObject[] = [];
    const addrConfigs = findConfigs(ast, 'firewall address');
    for (const ac of addrConfigs) {
      for (const edit of getEdits(ac)) {
        const name = edit.name;
        const type = edit.settings.get('type') || 'ipmask';
        const value = edit.settings.get('subnet') || edit.settings.get('fqdn') || edit.settings.get('iprange') || '';
        address_objects.push({ name, type, value, used: false });
      }
    }

    const addrGroupMap = new Map<string, string[]>(); // groupName -> memberNames
    const addrGroupConfigs = findConfigs(ast, 'firewall addrgrp');
    for (const agc of addrGroupConfigs) {
      for (const edit of getEdits(agc)) {
        const members = tokenizeFortiLine(edit.settings.get('member') || '');
        addrGroupMap.set(edit.name, members);
      }
    }

    // -----------------------------------------------------------------------
    // Parse Firewall Rules
    // -----------------------------------------------------------------------
    const firewall_rules: FirewallRule[] = [];
    const referencedAddrs = new Set<string>();
    const referencedServices = new Set<string>();

    const policyConfigs = findConfigs(ast, 'firewall policy');
    for (const pc of policyConfigs) {
      for (const edit of getEdits(pc)) {
        const id = edit.name;
        const name = unquote(edit.settings.get('name') || '');
        const src_zone = unquote(edit.settings.get('srcintf') || 'any');
        const dst_zone = unquote(edit.settings.get('dstintf') || 'any');
        const src = tokenizeFortiLine(edit.settings.get('srcaddr') || '');
        const dst = tokenizeFortiLine(edit.settings.get('dstaddr') || '');
        const service = tokenizeFortiLine(edit.settings.get('service') || '');
        const action = edit.settings.get('action') || 'accept';

        const logtraffic = edit.settings.get('logtraffic');
        const logging_enabled = logtraffic !== 'disable';

        const ips_sensor = unquote(edit.settings.get('ips-sensor'));
        const av_profile = unquote(edit.settings.get('av-profile'));
        const dnsfilter_profile = unquote(edit.settings.get('dnsfilter-profile'));
        const webfilter_profile = unquote(edit.settings.get('webfilter-profile'));
        const app_profile = unquote(edit.settings.get('application-list'));

        const profiles: string[] = [];
        if (ips_sensor) profiles.push(ips_sensor);
        if (av_profile) profiles.push(av_profile);
        if (dnsfilter_profile) profiles.push(dnsfilter_profile);
        if (webfilter_profile) profiles.push(webfilter_profile);
        if (app_profile) profiles.push(app_profile);

        const enabled = edit.settings.get('status') !== 'disable';
        const comment = unquote(edit.settings.get('comments'));
        const schedule = unquote(edit.settings.get('schedule') || 'always');

        const has_isdb = edit.settings.has('internet-service') ||
          edit.settings.has('internet-service-name') ||
          edit.rawLines.some(l => l.includes('internet-service') || l.includes('isdb'));

        // Track referenced address objects & service objects
        src.forEach(s => referencedAddrs.add(s));
        dst.forEach(d => referencedAddrs.add(d));
        service.forEach(s => referencedServices.add(s));

        firewall_rules.push(this.finalizeRule({
          id,
          name,
          src_zone,
          dst_zone,
          src,
          dst,
          service,
          action,
          logging_enabled,
          logtraffic,
          profiles,
          ips_sensor: ips_sensor || undefined,
          av_profile: av_profile || undefined,
          dnsfilter_profile: dnsfilter_profile || undefined,
          webfilter_profile: webfilter_profile || undefined,
          app_profile: app_profile || undefined,
          has_isdb,
          enabled,
          comment: comment || undefined,
          schedule
        }, edit.rawLines));
      }
    }

    // Resolve address group references (if a group is in rules, mark all its members)
    // and also mark any address object referenced in an address group as used
    for (const [groupName, members] of addrGroupMap.entries()) {
      if (referencedAddrs.has(groupName)) {
        members.forEach(m => referencedAddrs.add(m));
      }
      // Members of configured address groups are also marked as referenced
      members.forEach(m => referencedAddrs.add(m));
    }

    for (const ao of address_objects) {
      if (referencedAddrs.has(ao.name)) {
        ao.used = true;
      }
    }

    // -----------------------------------------------------------------------
    // Parse Service Objects (custom & groups)
    // -----------------------------------------------------------------------
    const service_objects: ServiceObject[] = [];
    const svcGroupMap = new Map<string, string[]>();

    const svcCustomConfigs = findConfigs(ast, 'firewall service custom');
    for (const scc of svcCustomConfigs) {
      for (const edit of getEdits(scc)) {
        const name = edit.name;
        const protocol = edit.settings.get('protocol') || 'TCP/UDP';
        const tcpPort = edit.settings.get('tcp-portrange');
        const udpPort = edit.settings.get('udp-portrange');
        const port = tcpPort ? `tcp:${tcpPort}` : (udpPort ? `udp:${udpPort}` : undefined);

        service_objects.push({
          name,
          protocol,
          port,
          used: false
        });
      }
    }

    const svcGroupConfigs = findConfigs(ast, 'firewall service group');
    for (const sgc of svcGroupConfigs) {
      for (const edit of getEdits(sgc)) {
        const name = edit.name;
        const members = tokenizeFortiLine(edit.settings.get('member') || '');
        svcGroupMap.set(name, members);

        service_objects.push({
          name,
          protocol: 'group',
          port: members.join(', '),
          used: false
        });
      }
    }

    // Resolve service groups: if a group is used in rules, mark members
    for (const [groupName, members] of svcGroupMap.entries()) {
      if (referencedServices.has(groupName)) {
        members.forEach(m => referencedServices.add(m));
      }
    }

    for (const so of service_objects) {
      if (referencedServices.has(so.name)) {
        so.used = true;
      }
    }

    // -----------------------------------------------------------------------
    // Parse Security Profiles (IPS, AV, DNS, Web, App)
    // -----------------------------------------------------------------------
    const ipsProfiles: { name: string; scan_botnet_connections: boolean; raw_snippet?: string }[] = [];
    const ipsConfigs = findConfigs(ast, 'ips sensor');
    for (const ic of ipsConfigs) {
      for (const edit of getEdits(ic)) {
        const sbc = edit.settings.get('scan-botnet-connections');
        const scanBotnet = sbc !== undefined && !sbc.includes('disable');
        ipsProfiles.push({
          name: edit.name,
          scan_botnet_connections: scanBotnet,
          raw_snippet: edit.rawLines.join('\n')
        });
      }
    }

    let avAutoupdateSchedule: string | undefined;
    let avOutbreakPrevention: string | undefined;
    let avMachineLearning: boolean | undefined;
    let avGrayware: boolean | undefined;
    let avSandboxInline: boolean | undefined;
    let avCdr: boolean | undefined;
    const avProfiles: { name: string; raw_snippet?: string }[] = [];

    const avConfigs = findConfigs(ast, 'antivirus profile');
    for (const ac of avConfigs) {
      for (const edit of getEdits(ac)) {
        const op = edit.settings.get('outbreak-prevention');
        if (op) avOutbreakPrevention = op;

        const ml = edit.settings.get('machine-learning-detection');
        if (ml) avMachineLearning = !ml.includes('disable');

        const gw = edit.settings.get('grayware');
        if (gw) avGrayware = !gw.includes('disable');

        const si = edit.settings.get('sandbox-inline');
        if (si) avSandboxInline = !si.includes('disable');

        const cdr = edit.settings.get('content-disarm');
        if (cdr) avCdr = !cdr.includes('disable');

        avProfiles.push({
          name: edit.name,
          raw_snippet: edit.rawLines.join('\n')
        });
      }
    }

    const autoUpConfigs = findConfigs(ast, 'system autoupdate schedule');
    for (const auc of autoUpConfigs) {
      const f = auc.settings.get('frequency');
      if (f) avAutoupdateSchedule = f;
    }

    const dnsfilterProfiles: { name: string; redirect_botnet: boolean; log_all_domain: boolean; raw_snippet?: string }[] = [];
    const dnsfConfigs = findConfigs(ast, 'dnsfilter profile');
    for (const dfc of dnsfConfigs) {
      for (const edit of getEdits(dfc)) {
        const bb = edit.settings.get('block-botnet') || edit.settings.get('redirect-botnet');
        const redirectBotnet = bb !== undefined && !bb.includes('disable');
        const lad = edit.settings.get('log-all-domain');
        const logAllDomain = lad !== undefined && !lad.includes('disable');

        dnsfilterProfiles.push({
          name: edit.name,
          redirect_botnet: redirectBotnet,
          log_all_domain: logAllDomain,
          raw_snippet: edit.rawLines.join('\n')
        });
      }
    }

    const webfilterProfiles: { name: string; blocks_malicious: boolean; raw_snippet?: string }[] = [];
    const webfConfigs = findConfigs(ast, 'webfilter profile');
    for (const wfc of webfConfigs) {
      for (const edit of getEdits(wfc)) {
        const raw = edit.rawLines.join('\n');
        const blocksMalicious = raw.includes('set action block') ||
          raw.includes('set malicious-categories') ||
          raw.includes('set options');

        webfilterProfiles.push({
          name: edit.name,
          blocks_malicious: blocksMalicious,
          raw_snippet: raw
        });
      }
    }

    const appProfiles: { name: string; block_high_risk: boolean; enforce_default_app_port: boolean; log_all: boolean; raw_snippet?: string }[] = [];
    const appConfigs = findConfigs(ast, 'application list');
    for (const apc of appConfigs) {
      for (const edit of getEdits(apc)) {
        const edap = edit.settings.get('enforce-default-app-port');
        const enforceDefault = edap !== undefined && !edap.includes('disable');
        const log = edit.settings.get('log');
        const logAll = log !== undefined && !log.includes('disable');
        const raw = edit.rawLines.join('\n');
        const blockHighRisk = raw.includes('set action block') || raw.includes('block');

        appProfiles.push({
          name: edit.name,
          block_high_risk: blockHighRisk,
          enforce_default_app_port: enforceDefault,
          log_all: logAll,
          raw_snippet: raw
        });
      }
    }

    // -----------------------------------------------------------------------
    // Parse VPN SSL & IPsec
    // -----------------------------------------------------------------------
    const sslVpnPresent = rawConfigText.includes('config vpn ssl settings');
    let sslVpnEnabled = false;
    let sslServercert = '';
    let sslMinTls = 'tls1-1';
    let sslMaxTls = 'tls1-3';
    let sslAlgorithm = 'high';
    let sslVpnMfa = false;

    const sslConfigs = findConfigs(ast, 'vpn ssl settings');
    for (const sc of sslConfigs) {
      const st = sc.settings.get('status');
      if (st && st.includes('enable')) sslVpnEnabled = true;

      const scert = sc.settings.get('servercert');
      if (scert) sslServercert = unquote(scert);

      const minT = sc.settings.get('ssl-min-proto-ver');
      if (minT) sslMinTls = minT;

      const maxT = sc.settings.get('ssl-max-proto-ver');
      if (maxT) sslMaxTls = maxT;

      const alg = sc.settings.get('algorithm');
      if (alg) sslAlgorithm = alg;

      const tf = sc.settings.get('two-factor');
      if (tf && !tf.includes('disable')) sslVpnMfa = true;
    }

    const ipsecEnabled = rawConfigText.includes('config vpn ipsec phase1-interface');
    const vpnEncryptionStrong = !rawConfigText.includes('set algorithm des') &&
      !rawConfigText.includes('set algorithm 3des') &&
      !rawConfigText.includes('set proposal des-md5') &&
      !rawConfigText.includes('set proposal 3des-sha1');

    // -----------------------------------------------------------------------
    // Parse Security Fabric
    // -----------------------------------------------------------------------
    const quarantineStitchEnabled = rawConfigText.includes('config system automation-stitch') &&
      rawConfigText.includes('quarantine');
    const rootFabricEnabled = rawConfigText.includes('config system csf') &&
      rawConfigText.includes('set status enable');

    // -----------------------------------------------------------------------
    // Parse Local-in Policies
    // -----------------------------------------------------------------------
    const localInPolicies: { id: string; action: string; service?: string[] }[] = [];
    const localInConfigs = findConfigs(ast, 'firewall local-in-policy');
    for (const lic of localInConfigs) {
      for (const edit of getEdits(lic)) {
        localInPolicies.push({
          id: edit.name,
          action: edit.settings.get('action') || 'accept',
          service: tokenizeFortiLine(edit.settings.get('service') || '')
        });
      }
    }

    // Firmware freshness
    const firmwareOutdated = os_version.startsWith('6.') || os_version.startsWith('7.0') || os_version === 'Unknown';

    // SNMP default community check
    const snmpCommunityDefault = rawConfigText.includes('set name "public"') ||
      rawConfigText.includes("set name 'public'") ||
      rawConfigText.includes('set name public') ||
      rawConfigText.includes('set name "private"');

    // Backup configured
    const backupConfigured = rawConfigText.includes('set backup enable');

    return {
      device: {
        vendor: 'FortiGate',
        model,
        os_version,
        hostname,
        serial,
        ha_status
      },
      admin_accounts,
      management_access: {
        https: mgmtHttps,
        http: mgmtHttp,
        ssh: mgmtSsh,
        telnet: mgmtTelnet,
        snmp: mgmtSnmp,
        snmp_community_default: snmpCommunityDefault,
        allowed_from_wan: allowedFromWan,
        trusted_hosts: []
      },
      logging: {
        traffic_log: trafficLogEnabled,
        security_log: securityLogEnabled,
        remote_log_enabled: remoteLogEnabled,
        remote_targets: remoteTargets,
        event_logging_enabled: eventLoggingEnabled,
        fortianalyzer: fazEnabled ? { enabled: fazEnabled, reliable: fazReliable, enc_algorithm: fazEncAlgorithm } : undefined,
        syslog: syslogEnabled ? { enabled: syslogEnabled, reliable: syslogReliable, enc_algorithm: syslogEncAlgorithm } : undefined,
      },
      interfaces,
      firewall_rules,
      address_objects,
      service_objects,
      vpn: {
        ssl_vpn_enabled: sslVpnPresent && sslVpnEnabled,
        ipsec_enabled: ipsecEnabled,
        users: [],
        encryption_strong: vpnEncryptionStrong,
        mfa_enabled: sslVpnMfa,
        inactive_users_retained: false,
        ssl_server_certificate: sslServercert || undefined,
        ssl_max_tls_version: sslMaxTls,
        ssl_min_tls_version: sslMinTls,
        ssl_algorithm: sslAlgorithm
      },
      system: {
        firmware_outdated: firmwareOutdated,
        ntp_configured: ntpConfigured,
        ntp_server: ntpServer || undefined,
        dns_servers: dnsServers,
        dns_is_default: false,
        backup_configured: backupConfigured,
        pre_login_banner_enabled: preLoginBannerEnabled,
        post_login_banner_enabled: postLoginBannerEnabled,
        timezone: timezone,
        usb_auto_install_disabled: !rawConfigText.includes('set auto-install-config enable'),
        ssl_static_key_ciphers_disabled: sslStaticKeyCiphersDisabled,
        strong_crypto_enabled: strongCryptoEnabled,
        admin_https_ssl_versions: adminHttpsSslVersions,
        gui_cdn_usage_enabled: guiCdnUsageEnabled,
        log_single_cpu_high_enabled: logSingleCpuHighEnabled,
        gui_display_hostname_disabled: guiDisplayHostnameDisabled,
        admin_lockout_threshold: adminLockoutThreshold,
        admin_lockout_duration: adminLockoutDuration,
        admin_idle_timeout: adminIdleTimeout,
        admin_port: adminPort,
        admin_sport: adminSport,
        https_redirect_disabled: httpsRedirectDisabled,
        virtual_patch_enabled: virtualPatchEnabled
      },
      password_policy: rawConfigText.includes('config system password-policy') ? {
        enabled: pwdPolicyEnabled,
        min_length: pwdMinLength,
        scope: pwdScope
      } : {
        enabled: false,
        min_length: 0,
        scope: 'admin'
      },
      snmp: {
        v1_v2c_enabled: snmpV1V2cEnabled || snmpCommunityDefault,
        v3_users: snmpV3Users,
        trap_thresholds: snmpTrapThresholds
      },
      ha: {
        mode: haMode,
        group_name: haGroupName || undefined,
        hbdev: haHbdev.length > 0 ? haHbdev : undefined,
        monitor_interfaces: haMonitorIntf.length > 0 ? haMonitorIntf : [],
        reserved_mgmt: { enabled: haReservedMgmt, interface: haReservedMgmtIntf || undefined, gateway: haReservedMgmtGw || undefined },
        group_id: haGroupId
      },
      security_profiles: {
        ips: ipsProfiles.length > 0 ? ipsProfiles : undefined,
        av: avProfiles.length > 0 ? {
          autoupdate_schedule: avAutoupdateSchedule,
          outbreak_prevention: avOutbreakPrevention,
          machine_learning_detection: avMachineLearning,
          grayware: avGrayware,
          sandbox_inline: avSandboxInline,
          cdr: avCdr,
          profiles: avProfiles
        } : undefined,
        dnsfilter: dnsfilterProfiles.length > 0 ? dnsfilterProfiles : undefined,
        webfilter: webfilterProfiles.length > 0 ? webfilterProfiles : undefined,
        app: appProfiles.length > 0 ? appProfiles : undefined
      },
      security_fabric: {
        quarantine_stitch_enabled: quarantineStitchEnabled,
        root_fabric_enabled: rootFabricEnabled
      },
      zones: zones.length > 0 ? zones : undefined,
      local_in_policies: localInPolicies.length > 0 ? localInPolicies : undefined,
      raw_content: rawConfigText
    };
  }

  /**
   * Finalizes rule attributes, ensuring that empty arrays properly fall back
   * to ['all'] or ['ALL'] (fixing the `[] || ['all']` bug in JavaScript).
   */
  private finalizeRule(partial: Partial<FirewallRule>, snippetLines: string[]): FirewallRule {
    return {
      id: partial.id ?? '',
      name: partial.name || `Policy_${partial.id}`,
      src_zone: partial.src_zone || 'any',
      dst_zone: partial.dst_zone || 'any',
      src: (partial.src && partial.src.length > 0) ? partial.src : ['all'],
      dst: (partial.dst && partial.dst.length > 0) ? partial.dst : ['all'],
      service: (partial.service && partial.service.length > 0) ? partial.service : ['ALL'],
      action: partial.action || 'accept',
      logging_enabled: partial.logging_enabled ?? true,
      logtraffic: partial.logtraffic,
      profiles: partial.profiles || [],
      ips_sensor: partial.ips_sensor,
      av_profile: partial.av_profile,
      dnsfilter_profile: partial.dnsfilter_profile,
      webfilter_profile: partial.webfilter_profile,
      app_profile: partial.app_profile,
      has_isdb: partial.has_isdb,
      enabled: partial.enabled ?? true,
      comment: partial.comment,
      schedule: partial.schedule || 'always',
      raw_snippet: snippetLines.join('\n')
    };
  }
}
