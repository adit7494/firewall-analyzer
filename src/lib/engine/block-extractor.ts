/**
 * Block Extractor
 *
 * Extracts ALL configuration blocks from a raw FortiGate config file in a single
 * pass. Accurately tracks nesting depth so that nested "config ... end" blocks
 * (e.g. "config ipv6 ... end", "config widget ... end") do NOT prematurely close
 * parent blocks.
 */

export interface ExtractedBlocks {
  system_global?: string;
  system_interface?: string;
  system_admin?: string;
  system_ntp?: string;
  system_dns?: string;
  system_snmp_sysinfo?: string;
  system_snmp_community?: string;
  system_password_policy?: string;
  system_zone?: string;
  system_ha?: string;
  system_csf?: string;
  system_settings?: string;
  log_fortianalyzer?: string;
  log_fortianalyzer2?: string;
  log_syslogd?: string;
  firewall_policy?: string;
  firewall_local_in_policy?: string;
  ips_sensor?: string;
  antivirus_profile?: string;
  antivirus_settings?: string;
  dnsfilter_profile?: string;
  webfilter_profile?: string;
  application_list?: string;
  vpn_ssl_settings?: string;
  vpn_ipsec_phase1?: string;
  vpn_ipsec_phase2?: string;
}

/**
 * Mapping from block name to the config keyword used in the FortiGate config file.
 */
export const BLOCK_DEFINITIONS: Record<keyof ExtractedBlocks, string> = {
  system_global:         'config system global',
  system_interface:      'config system interface',
  system_admin:          'config system admin',
  system_ntp:            'config system ntp',
  system_dns:            'config system dns',
  system_snmp_sysinfo:   'config system snmp sysinfo',
  system_snmp_community: 'config system snmp community',
  system_password_policy:'config system password-policy',
  system_zone:           'config system zone',
  system_ha:             'config system ha',
  system_csf:            'config system csf',
  system_settings:       'config system settings',
  log_fortianalyzer:     'config log fortianalyzer setting',
  log_fortianalyzer2:    'config log fortianalyzer2 setting',
  log_syslogd:           'config log syslogd setting',
  firewall_policy:       'config firewall policy',
  firewall_local_in_policy: 'config firewall local-in-policy',
  ips_sensor:            'config ips sensor',
  antivirus_profile:     'config antivirus profile',
  antivirus_settings:    'config antivirus settings',
  dnsfilter_profile:     'config dnsfilter profile',
  webfilter_profile:     'config webfilter profile',
  application_list:      'config application list',
  vpn_ssl_settings:      'config vpn ssl settings',
  vpn_ipsec_phase1:      'config vpn ipsec phase1-interface',
  vpn_ipsec_phase2:      'config vpn ipsec phase2-interface',
};

// Reverse map for O(1) header lookup
const HEADER_TO_KEY: Record<string, keyof ExtractedBlocks> = {};
for (const [k, header] of Object.entries(BLOCK_DEFINITIONS) as [keyof ExtractedBlocks, string][]) {
  HEADER_TO_KEY[header] = k;
}

/**
 * Extracts a complete top-level config block from raw config text.
 * Correctly handles nested blocks (edit...next, config...end inside a config...end block).
 *
 * @param rawContent Full raw config file content
 * @param blockStart The block header string (e.g. "config system interface")
 * @returns The complete block text including header and "end", or undefined
 */
export function extractCompleteBlock(rawContent: string, blockStart: string): string | undefined {
  if (!rawContent) return undefined;
  const lines = rawContent.split(/\r?\n/);
  const result: string[] = [];
  let insideBlock = false;
  let depth = 0;
  const normalizedStart = blockStart.trim();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!insideBlock) {
      if (trimmed === normalizedStart) {
        insideBlock = true;
        depth = 1;
        result.push(line);
      }
      continue;
    }

    result.push(line);

    // Track nesting depth
    if (trimmed.startsWith('config ') || trimmed === 'config') {
      depth++;
    } else if (trimmed === 'end') {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }

  if (result.length === 0) return undefined;
  return result.join('\n');
}

/**
 * Extracts all defined configuration blocks from a raw FortiGate config file
 * using a single-pass depth parser.
 *
 * @param rawContent Full raw config file text
 * @returns ExtractedBlocks object containing all found blocks
 */
export function extractAllBlocks(rawContent: string): ExtractedBlocks {
  const blocks: ExtractedBlocks = {};
  if (!rawContent) return blocks;

  const lines = rawContent.split(/\r?\n/);
  let currentKey: keyof ExtractedBlocks | null = null;
  let currentLines: string[] = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (depth === 0) {
      const matchedKey = HEADER_TO_KEY[trimmed];
      if (matchedKey) {
        currentKey = matchedKey;
        depth = 1;
        currentLines = [line];
      }
      continue;
    }

    currentLines.push(line);

    if (trimmed.startsWith('config ') || trimmed === 'config') {
      depth++;
    } else if (trimmed === 'end') {
      depth--;
      if (depth === 0 && currentKey) {
        const blockText = currentLines.join('\n');
        if (blocks[currentKey]) {
          blocks[currentKey] = `${blocks[currentKey]}\n\n${blockText}`;
        } else {
          blocks[currentKey] = blockText;
        }
        currentKey = null;
        currentLines = [];
      }
    }
  }

  return blocks;
}

/**
 * Returns the count of blocks successfully extracted.
 */
export function countExtractedBlocks(blocks: ExtractedBlocks): number {
  return Object.values(blocks).filter(v => v !== undefined).length;
}

/**
 * Returns a human-readable summary of which blocks were found and which are missing.
 */
export function summarizeExtractedBlocks(blocks: ExtractedBlocks): string {
  const found = Object.entries(blocks)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
  const missing = Object.keys(BLOCK_DEFINITIONS)
    .filter(k => blocks[k as keyof ExtractedBlocks] === undefined);
  return `Found ${found.length} blocks: [${found.join(', ')}]. Missing: [${missing.join(', ')}]`;
}
