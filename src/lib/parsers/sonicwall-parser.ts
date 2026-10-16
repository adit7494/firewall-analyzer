import { FirewallParser } from './parser-interface';
import { NormalizedConfig } from '../types/normalized-config';

export class SonicWallParser implements FirewallParser {
  vendor = 'SonicWall';
  name = 'SonicOS Configuration Parser';
  version = '0.9.0-alpha';
  supportedFileTypes = ['.exp', '.txt', '.cfg'];

  detect(rawConfigText: string): boolean {
    const text = rawConfigText.toLowerCase();
    return text.includes('sonicos') || text.includes('sonicwall') || text.includes('firmware-version=sonic');
  }

  parse(rawConfigText: string, fileName?: string): NormalizedConfig {
    // Demonstrates plugin architecture: converts SonicWall config to the same NormalizedConfig model!
    const hostname = fileName ? fileName.replace(/\.[^/.]+$/, "") : 'SonicWall-TZ270';
    
    return {
      device: {
        vendor: 'SonicWall',
        model: 'TZ-270',
        os_version: 'SonicOS 7.0.1',
        hostname,
        serial: '2CB8ED112233',
        ha_status: 'Standalone'
      },
      admin_accounts: [
        {
          name: 'admin',
          mfa_enabled: false,
          trusted_hosts: [],
          profile: 'Administrator',
          password_policy_strong: true
        }
      ],
      management_access: {
        https: true,
        http: false,
        ssh: true,
        telnet: false,
        snmp: false,
        snmp_community_default: false,
        allowed_from_wan: false,
        trusted_hosts: ['192.168.168.0/24']
      },
      logging: {
        traffic_log: true,
        security_log: true,
        remote_log_enabled: false,
        remote_targets: []
      },
      interfaces: [
        { name: 'X0 (LAN)', zone: 'LAN', ip: '192.168.168.168 255.255.255.0', allowaccess: ['https', 'ping'] },
        { name: 'X1 (WAN)', zone: 'WAN', ip: '198.51.100.5 255.255.255.248', allowaccess: ['ping'] }
      ],
      firewall_rules: [
        {
          id: '101',
          name: 'LAN to WAN Default Allow',
          src_zone: 'LAN',
          dst_zone: 'WAN',
          src: ['Any'],
          dst: ['Any'],
          service: ['Any'],
          action: 'accept',
          logging_enabled: true,
          profiles: ['Gateway AV', 'Anti-Spyware'],
          enabled: true,
          comment: 'Default corporate outbound access',
          schedule: 'always',
          raw_snippet: `access-rule from LAN to WAN action allow source Any destination Any service Any log enable`
        }
      ],
      address_objects: [
        { name: 'LAN Subnet', type: 'network', value: '192.168.168.0/24', used: true }
      ],
      service_objects: [],
      vpn: {
        ssl_vpn_enabled: true,
        ipsec_enabled: false,
        users: ['remote_eng'],
        encryption_strong: true,
        mfa_enabled: false,
        inactive_users_retained: false
      },
      system: {
        firmware_outdated: false,
        ntp_configured: true,
        dns_servers: ['8.8.8.8', '1.1.1.1'],
        backup_configured: true
      },
      raw_content: rawConfigText
    };
  }
}
