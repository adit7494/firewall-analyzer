/**
 * Audit Engine
 *
 * Primary method: runAuditWithAI() — evaluates ALL config blocks using the AI engine.
 * Legacy method: runAudit() — kept for fallback when AI is not configured.
 *
 * When AI is active, the engine:
 *  1. Extracts all config blocks from raw config text (block-extractor)
 *  2. Runs one AI call per block type in parallel (ai-block-evaluator)
 *  3. Aggregates all findings and converts them to the standard Finding format
 *  4. If any block evaluation fails, the entire audit is aborted (error propagated)
 *
 * The static runAudit() method (legacy) is used only if the AI engine is not configured.
 */

import { RULES_CATALOG } from './rules-catalog';
import { NormalizedConfig } from '../types/normalized-config';
import { Finding, Severity, RuleCategory, ComplianceStandard } from '../types/audit';
import { extractAllBlocks, ExtractedBlocks, countExtractedBlocks } from './block-extractor';
import { evaluateBlock, getEvaluatableBlockTypes, AIFinding, BlockEvalResult } from './ai-block-evaluator';

export function getSeverityPenalty(severity: Severity): number {
  switch (severity) {
    case 'Critical': return 25;
    case 'High': return 12;
    case 'Medium': return 5;
    case 'Low': return 2;
    case 'Info': return 0;
    default: return 0;
  }
}

export interface AuditOptions {
  profileLevel?: 'L1' | 'L1_L2';
  vendor?: string;
  section?: string;
}

/**
 * SSE progress event emitter type.
 * The audit/run API route passes this so the engine can stream real-time updates.
 */
export type ProgressEmitter = (event: AuditProgressEvent) => void;

export type AuditProgressEvent =
  | { type: 'extracted'; totalBlocks: number }
  | { type: 'block_start'; block: string }
  | { type: 'block_done';  block: string; findingsCount: number }
  | { type: 'block_error'; block: string; error: string }
  | { type: 'block_telemetry'; block: string; rawResponse?: string; prompt?: string; telemetry?: BlockEvalResult['telemetry'] }
  | { type: 'scoring' };

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert AIFinding → Finding (standard format used by the rest of the app)
// ─────────────────────────────────────────────────────────────────────────────
function convertAIFindingToFinding(aif: AIFinding, auditId: string): Finding {
  const severity = (aif.severity ?? 'Medium') as Severity;
  return {
    id: `${aif.rule_id}_${Math.random().toString(36).substring(2, 7)}`,
    audit_id: auditId,
    rule_id: aif.rule_id,
    title: aif.title,
    description: aif.reason,           // AI reason becomes the description
    category: (aif.category ?? 'System Settings') as RuleCategory,
    severity,
    evidence_snippet: aif.evidence,
    recommendation: aif.recommendation ?? 'Review and remediate according to CIS FortiGate Benchmark.',
    compliance_tags: (aif.compliance_tags ?? ['CIS FortiGate']) as ComplianceStandard[],
    status: 'open',
    is_manual: false,
    created_at: new Date().toISOString(),
    penalty_score: getSeverityPenalty(severity),
    cis_code: aif.cis_code ?? aif.rule_id,
    cis_level: aif.cis_level,
    cis_section: aif.cis_section,
    // AI-specific fields
    ai_evaluated: true,
    ai_reason: aif.reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Engine Service
// ─────────────────────────────────────────────────────────────────────────────
export class AuditEngineService {

  /**
   * PRIMARY: Full AI-powered audit.
   *
   * Extracts all config blocks and evaluates them using the AI engine in parallel.
   * If any block evaluation fails (AI timeout, error, malformed response),
   * the entire audit is aborted — an error is thrown.
   *
   * @param config        Normalized config (must have raw_content populated)
   * @param auditId       Unique ID for this audit run
   * @param emitProgress  Optional SSE emitter for real-time progress streaming
   * @throws              Error if AI is not configured or any block evaluation fails
   */
  async runAuditWithAI(
    config: NormalizedConfig,
    auditId: string,
    emitProgress?: ProgressEmitter
  ): Promise<{ findings: Finding[]; blocksAnalyzed: number }> {
    if (!config.raw_content) {
      throw new Error('Raw config content is missing. The parser must populate raw_content.');
    }

    // Step 1: Extract all blocks
    const blocks = extractAllBlocks(config.raw_content);
    const totalBlocks = countExtractedBlocks(blocks);
    emitProgress?.({ type: 'extracted', totalBlocks });

    // Step 2: Identify which block types are present AND have a prompt defined
    const evaluatableTypes = getEvaluatableBlockTypes();
    const blocksToEvaluate = evaluatableTypes.filter(
      bt => blocks[bt] !== undefined && blocks[bt]!.trim().length > 0
    );

    // Step 3: Evaluate blocks with a worker pool (concurrency limit = 4)
    // This avoids bursting Azure OpenAI rate limits and 500 Internal Server Errors while maintaining high throughput.
    const CONCURRENCY_LIMIT = 4;
    const allResults: BlockEvalResult[] = [];
    const queue = [...blocksToEvaluate];

    async function worker() {
      while (queue.length > 0) {
        const blockType = queue.shift();
        if (!blockType) break;

        emitProgress?.({ type: 'block_start', block: blockType });
        try {
          const result = await evaluateBlock(blockType, blocks[blockType]!);
          emitProgress?.({ type: 'block_telemetry', block: blockType, rawResponse: result.rawResponse, prompt: result.prompt, telemetry: result.telemetry });
          emitProgress?.({ type: 'block_done', block: blockType, findingsCount: result.findings.length });
          allResults.push(result);
        } catch (err) {
          const message = (err as Error).message;
          const rawResponse = (err as any).rawResponse;
          const telemetry = (err as any).telemetry;
          const prompt = (err as any).prompt;
          
          if (rawResponse || telemetry || prompt) {
            emitProgress?.({ type: 'block_telemetry', block: blockType, rawResponse, prompt, telemetry });
          }
          
          emitProgress?.({ type: 'block_error', block: blockType, error: message });
          const errorFinding: AIFinding = {
            rule_id: `ERR-${blockType}`,
            title: `AI Block Evaluation Incomplete: ${blockType}`,
            status: 'failed',
            severity: 'High',
            category: 'System Settings',
            reason: `Evaluation of configuration block "${blockType}" could not be completed: ${message}. Security rules for this section could not be verified automatically.`,
            evidence: blocks[blockType] ? blocks[blockType]!.slice(0, 1000) : '',
            recommendation: `Inspect configuration block "${blockType}" manually or re-run the audit. Error: ${message}`,
            cis_code: 'ERROR'
          };
          allResults.push({ blockType, findings: [errorFinding] });
        }
      }
    }

    const workerCount = Math.min(CONCURRENCY_LIMIT, blocksToEvaluate.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    // Step 4: Flatten and convert to standard Finding format
    const findings: Finding[] = allResults
      .flatMap(r => r.findings)
      .map(aif => convertAIFindingToFinding(aif, auditId));

    emitProgress?.({ type: 'scoring' });

    return { findings, blocksAnalyzed: blocksToEvaluate.length };
  }

  /**
   * LEGACY: Static rule-based audit (no AI).
   * Used only when AI engine is not configured.
   * Kept intact for backward compatibility.
   */
  runAudit(config: NormalizedConfig, auditId: string, options?: AuditOptions): { findings: Finding[]; rulesAnalyzed: number } {
    const findings: Finding[] = [];
    let rulesAnalyzed = 0;
    const targetVendor = options?.vendor ? options.vendor.toLowerCase() : config.device.vendor.toLowerCase();

    for (const rule of RULES_CATALOG) {
      const applies = rule.applies_to.includes('common') || rule.applies_to.includes(targetVendor);
      if (!applies) continue;

      if (options?.profileLevel === 'L1' && rule.cis_level === 'L2') continue;
      if (options?.section && rule.section && rule.section !== options.section) continue;

      rulesAnalyzed++;
      const result = rule.check(config);
      if (result) {
        findings.push({
          ...result,
          id: `${rule.id}_${Math.random().toString(36).substring(2, 7)}`,
          audit_id: auditId,
          rule_id: rule.id,
          status: 'open',
          created_at: new Date().toISOString(),
          penalty_score: getSeverityPenalty(rule.severity),
          cis_level: rule.cis_level || result.cis_level,
          cis_section: rule.section || result.cis_section || rule.category,
          system_check: rule.system_check || result.system_check,
          cis_code: rule.code || result.cis_code || rule.id,
          config_key: rule.config_key || result.config_key,
          expected_value: rule.expected_value || result.expected_value,
          audit_hint: rule.audit_hint || result.audit_hint,
          remediation: rule.remediation || result.remediation || rule.recommendation,
          default_value: rule.default_value || result.default_value,
          cis_controls: rule.cis_controls || result.cis_controls,
          rationale: rule.rationale || result.rationale,
          impact: rule.impact || result.impact,
          audit_procedure: rule.audit_procedure || result.audit_procedure,
          remediation_procedure: rule.remediation_procedure || result.remediation_procedure,
          references: rule.references || result.references || [],
          references_json: rule.references_json || rule.references || result.references_json || result.references || []
        });
      }
    }

    return { findings, rulesAnalyzed };
  }
}

export const AuditEngine = new AuditEngineService();
