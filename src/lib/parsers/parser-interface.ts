import type { NormalizedConfig } from '../types/normalized-config';

export interface FirewallParser {
  vendor: string;
  name: string;
  version: string;
  supportedFileTypes: string[];
  detect(rawConfigText: string): boolean;
  parse(rawConfigText: string, fileName?: string): NormalizedConfig;
}
