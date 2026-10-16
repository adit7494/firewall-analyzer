import { FirewallParser } from './parser-interface';
import { FortiGateParser } from './fortigate-parser';
import { SonicWallParser } from './sonicwall-parser';
import { NormalizedConfig } from '../types/normalized-config';

class ParserRegistryService {
  private parsers: Map<string, FirewallParser> = new Map();

  constructor() {
    this.register(new FortiGateParser());
    this.register(new SonicWallParser());
  }

  register(parser: FirewallParser) {
    this.parsers.set(parser.vendor.toLowerCase(), parser);
  }

  getParser(vendor: string): FirewallParser | undefined {
    return this.parsers.get(vendor.toLowerCase());
  }

  getAllParsers(): FirewallParser[] {
    return Array.from(this.parsers.values());
  }

  autoDetect(rawConfigText: string): { parser: FirewallParser | undefined; detectedVendor: string } {
    for (const parser of this.parsers.values()) {
      if (parser.detect(rawConfigText)) {
        return { parser, detectedVendor: parser.vendor };
      }
    }
    // Fallback default to FortiGate if unable to auto-detect
    return { parser: this.getParser('fortigate'), detectedVendor: 'FortiGate (Default)' };
  }

  parseConfig(rawConfigText: string, vendor?: string, fileName?: string): { config: NormalizedConfig; vendorUsed: string } {
    let parser: FirewallParser | undefined;
    let vendorUsed = 'FortiGate';

    if (vendor && vendor !== 'auto') {
      parser = this.getParser(vendor);
      vendorUsed = vendor;
    } else {
      const detected = this.autoDetect(rawConfigText);
      parser = detected.parser;
      vendorUsed = detected.detectedVendor;
    }

    if (!parser) {
      parser = new FortiGateParser();
      vendorUsed = 'FortiGate (Fallback)';
    }

    const config = parser.parse(rawConfigText, fileName);
    return { config, vendorUsed };
  }
}

export const ParserRegistry = new ParserRegistryService();
