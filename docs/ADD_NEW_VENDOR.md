# Multi-Vendor Architecture & Adding New Firewall Vendors

The **Firewall Audit Analyzer** platform is built on an extensible, multi-vendor architecture designed to seamlessly ingest configuration backups from diverse network security appliances (Fortinet FortiGate, Palo Alto PAN-OS, Cisco ASA/FTD, Check Point R81+, Juniper SRX, etc.) and normalize them into a unified, vendor-agnostic security schema.

---

## 1. Core Architectural Concepts

The analysis pipeline consists of three decoupled layers:

```
[Raw Configuration File (ASCII/XML/JSON)]
                   │
                   ▼
     ┌───────────────────────────┐
     │  ParserRegistry Engine    │  <-- Detects vendor & routes to specific parser
     └─────────────┬─────────────┘
                   │
                   ▼
     ┌───────────────────────────┐
     │ NormalizedConfig Schema   │  <-- Unified representation (interfaces, policies, objects)
     └─────────────┬─────────────┘
                   │
                   ▼
     ┌───────────────────────────┐
     │  AuditEngine & Rules      │  <-- Evaluates 90+ CIS & NIST rules against normalized data
     └───────────────────────────┘
```

1. **Vendor Detection (`ParserRegistry`)**: Automatically identifies the appliance vendor by inspecting configuration file syntax, header comments, and structural markers.
2. **Configuration Normalization (`NormalizedConfig`)**: Translates proprietary syntax (e.g., FortiGate `config firewall policy`, Palo Alto `<security><rules>`, Cisco `access-list`) into a universal JSON data structure.
3. **Rule Evaluation (`AuditEngine`)**: Executes compliance benchmark rules against the universal data structure without needing vendor-specific regex in the core rules engine.

---

## 2. Step-by-Step Guide to Adding a New Vendor

To integrate a new firewall vendor (e.g., **Palo Alto Networks PAN-OS**), follow these 4 structured steps:

### Step 1: Define the Vendor Parser Class
Create a new file in `src/lib/parser/paloalto-parser.ts` implementing the standard parser contract:

```typescript
import { NormalizedConfig, FirewallPolicy, NetworkInterface, AddressObject } from '@/lib/types/audit';

export class PaloAltoParser {
  static parse(content: string, fileName: string): NormalizedConfig {
    const lines = content.split('\n');
    const policies: FirewallPolicy[] = [];
    const interfaces: NetworkInterface[] = [];
    const addressObjects: AddressObject[] = [];
    
    // 1. Parse Network Interfaces
    // Example: <entry name="ethernet1/1"><layer3><ip><entry name="10.0.0.1/24"/></ip>...
    
    // 2. Parse Address Objects & Groups
    // Example: <address><entry name="Web-Server"><ip-netmask>192.168.1.50/32</ip-netmask>...
    
    // 3. Parse Security Policy Rulebase
    // Example: <rule name="Allow-Web"><to><member>untrust</member></to>...
    
    return {
      vendor: 'Palo Alto',
      hostname: this.extractHostname(content) || 'PA-Appliance',
      version: 'PAN-OS 10.2+',
      interfaces,
      zones: ['trust', 'untrust', 'dmz'],
      address_objects: addressObjects,
      service_objects: [],
      policies,
      routing: [],
      vpn_tunnels: [],
      raw_lines_count: lines.length,
      // Vendor-specific deep inspection properties
      system_global: {
        admin_https_redirect: true,
        password_policy_enabled: true
      }
    };
  }
}
```

### Step 2: Register the Vendor in `ParserRegistry`
Open `src/lib/parser/parser-registry.ts` and register the detection logic and parser routing:

```typescript
import { PaloAltoParser } from './paloalto-parser';

export class ParserRegistry {
  static detectVendor(content: string, override?: string): VendorType {
    if (override && override !== 'Auto-Detect') return override as VendorType;
    if (content.includes('<panos-xml>') || content.includes('mgt-config') || content.includes('set deviceconfig')) {
      return 'Palo Alto';
    }
    // Existing checks for Fortinet, Cisco, Check Point...
  }

  static parseConfig(content: string, override?: string, fileName = 'config.txt') {
    const vendor = this.detectVendor(content, override);
    switch (vendor) {
      case 'Palo Alto':
        return { config: PaloAltoParser.parse(content, fileName), vendorUsed: vendor };
      case 'Fortinet':
      default:
        return { config: FortiGateParser.parse(content, fileName), vendorUsed: vendor };
    }
  }
}
```

### Step 3: Add Vendor-Specific or Universal CIS Rules
In `src/lib/engine/rules-catalog.ts`, you can either:
- **Write Universal Rules**: Rules that inspect `config.policies` or `config.interfaces` automatically work across all vendors!
- **Write Vendor-Specific CIS Benchmarks**: Tag rules with `vendor: 'Palo Alto'` and set `cis_code: '1.1.1'`. The `AuditEngine` automatically filters rules based on the active device vendor.

```typescript
{
  id: 'CIS-PA-1.1',
  vendor: 'Palo Alto',
  code: '1.1',
  title: 'Ensure Idle Timeout is Set to 10 Minutes or Less',
  category: 'Management Hardening',
  severity: 'Medium',
  cis_level: 'L1',
  system_check: 'auto',
  check: (config) => {
    const timeout = config.system_global?.idle_timeout || 60;
    return timeout <= 10;
  },
  recommendation: 'Configure administrative idle timeout to prevent unauthorized console access.'
}
```

### Step 4: Add UI Vendor Badges & Mock Seed Data
- Update `src/lib/types/audit.ts` to include `'Palo Alto'` in the `VendorType` union.
- In `src/lib/db/seed-data.ts`, add sample PAN-OS configuration files so users can test the new parser immediately upon deployment.

---

## 3. Best Practices for Parser Developers
1. **Defensive Parsing**: Never throw fatal exceptions on unrecognized syntax. If a line cannot be parsed, log a warning and continue.
2. **Preserve Line Numbers**: When extracting configuration snippets for finding evidence, record the line numbers from the raw file to assist administrators during remediation.
3. **Normalize Wildcards**: Translate vendor-specific any/all terms (e.g., `all` in FortiGate, `any` in Cisco/Palo Alto, `Any` in Check Point) to a standard lowercase `'any'` in `NormalizedConfig`.
