/**
 * Rule Utility Functions
 *
 * Provides rule ID normalization and matching across the engine, scoring, and UI.
 */

/**
 * Normalizes a rule ID or code by stripping common prefixes ('CIS-', 'AI-')
 * and converting to lower case for consistent matching.
 *
 * Examples:
 *   "CIS-2.4.1" -> "2.4.1"
 *   "AI-2.4.1"  -> "2.4.1"
 *   "2.4.1"     -> "2.4.1"
 *   "ADM-001"   -> "adm-001"
 *   "FW-001"    -> "fw-001"
 */
export function normalizeRuleId(id: string | undefined | null): string {
  if (!id) return '';
  return id
    .trim()
    .replace(/^(AI-|CIS-)/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Checks if a finding matches a rule by normalized ID or CIS code.
 * Supports both 2-argument signature: isRuleMatch(ruleA, ruleB)
 * and 4-argument signature: isRuleMatch(findingRuleId, findingCisCode, catalogRuleId, catalogRuleCode)
 */
export function isRuleMatch(
  findingRuleId: string | undefined | null,
  findingCisCode?: string | undefined | null,
  catalogRuleId?: string | undefined | null,
  catalogRuleCode?: string | undefined | null
): boolean {
  // If called with 2 arguments: isRuleMatch(ruleA, ruleB)
  if (catalogRuleId === undefined && catalogRuleCode === undefined) {
    const normA = normalizeRuleId(findingRuleId);
    const normB = normalizeRuleId(findingCisCode);
    if (!normA || !normB) return false;
    return normA === normB;
  }

  const normF = normalizeRuleId(findingRuleId);
  const normFCis = normalizeRuleId(findingCisCode);
  const normR = normalizeRuleId(catalogRuleId);
  const normRCode = normalizeRuleId(catalogRuleCode);

  if (!normF && !normFCis) return false;
  if (!normR && !normRCode) return false;

  return Boolean(
    (normF && normR && normF === normR) ||
    (normF && normRCode && normF === normRCode) ||
    (normFCis && normR && normFCis === normR) ||
    (normFCis && normRCode && normFCis === normRCode)
  );
}
