import { Framework, FrameworkCode, ControlRuleMapping, FrameworkControl } from '../types/framework';
import frameworksSeed from '../../../supabase/seed/frameworks.json';
import mappingsSeed from '../../../supabase/seed/mappings_cis_fortigate.json';

interface SeedFrameworkItem {
  code: string;
  name: string;
  version: string;
  description?: string;
  is_technical: boolean;
  controls: {
    control_code: string;
    title: string;
    category: string;
    coverage_type: 'automated' | 'partial' | 'manual' | 'not_covered';
    guidance?: string;
  }[];
}

interface SeedMappingItem {
  framework: string;
  control_code: string;
  rules: string[];
  vendor: string;
  strength: 'full' | 'partial';
  note?: string;
}

const loadedFrameworks: Framework[] = (frameworksSeed.frameworks as SeedFrameworkItem[]).map(f => ({
  code: f.code as FrameworkCode,
  name: f.name,
  version: f.version,
  description: f.description,
  is_technical: f.is_technical,
  active: true,
  controls: f.controls.map(c => ({
    framework_code: f.code as FrameworkCode,
    control_code: c.control_code,
    title: c.title,
    category: c.category,
    coverage_type: c.coverage_type,
    guidance: c.guidance
  }))
}));

const loadedMappings: ControlRuleMapping[] = [];
for (const m of (mappingsSeed.mappings as SeedMappingItem[])) {
  if (!m.rules) continue;
  for (const rCode of m.rules) {
    loadedMappings.push({
      framework_code: m.framework as FrameworkCode,
      control_code: m.control_code,
      rule_code: rCode,
      rule_vendor: m.vendor || 'fortigate',
      mapping_strength: m.strength || 'full',
      note: m.note
    });
  }
}

/**
 * Returns the catalog of all supported non-CIS compliance frameworks.
 */
export function getFrameworksCatalog(): Framework[] {
  return loadedFrameworks;
}

/**
 * Returns a specific framework by its unique code (e.g. 'NIST_CSF').
 */
export function getFrameworkByCode(code: FrameworkCode): Framework | undefined {
  return loadedFrameworks.find(f => f.code === code);
}

/**
 * Returns crosswalk mappings from framework controls to CIS rules.
 */
export function getFrameworkMappings(frameworkCode?: FrameworkCode): ControlRuleMapping[] {
  if (!frameworkCode) return loadedMappings;
  return loadedMappings.filter(m => m.framework_code === frameworkCode);
}

/**
 * Returns mapped CIS rule codes for a specific framework control.
 */
export function getMappingsForControl(frameworkCode: FrameworkCode, controlCode: string): ControlRuleMapping[] {
  return loadedMappings.filter(m => m.framework_code === frameworkCode && m.control_code === controlCode);
}
