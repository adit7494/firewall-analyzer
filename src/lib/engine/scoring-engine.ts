import { Finding, CategoryScore, RuleCategory } from '../types/audit';
import { RULES_CATALOG } from './rules-catalog';
import { normalizeRuleId } from './rule-utils';

export { normalizeRuleId };

export class ScoringEngineService {
  calculateScore(findings: Finding[], vendor?: string): { 
    score: number; 
    grade: 'A' | 'B' | 'C' | 'D' | 'F'; 
    breakdown: CategoryScore[];
    score_breakdown: Record<string, { score: number; total: number; passed: number; failed: number }>;
  } {
    let totalPenalty = 0;

    // Categorized penalties
    const categoryPenalties: Record<RuleCategory, number> = {
      'Access Control': 0,
      'Management Hardening': 0,
      'Logging & Monitoring': 0,
      'Firewall Rulebase': 0,
      'VPN Security': 0,
      'Network Segmentation': 0,
      'Network Settings': 0,
      'System Settings': 0,
      'Password Policy': 0,
      'SNMP': 0,
      'Administrators': 0,
      'High Availability': 0,
      'Policy & Objects': 0,
      'Security Profiles': 0,
      'Security Fabric': 0,
      'VPN': 0,
      'Logs & Reports': 0
    };

    for (const finding of findings) {
      // Exclude accepted risk, false positive, or resolved findings from penalty calculation!
      if (finding.status === 'accepted_risk' || finding.status === 'false_positive' || finding.status === 'resolved') {
        continue;
      }

      totalPenalty += finding.penalty_score;
      if (categoryPenalties[finding.category] !== undefined) {
        categoryPenalties[finding.category] += finding.penalty_score;
      } else {
        categoryPenalties[finding.category] = finding.penalty_score;
      }
    }

    const baseScore = 100;
    
    const categories: RuleCategory[] = Object.keys(categoryPenalties) as RuleCategory[];

    const breakdown: CategoryScore[] = categories.map(cat => {
      const pen = categoryPenalties[cat] || 0;
      return {
        category: cat,
        score: Math.max(0, 100 - pen * 2), // category score scaled
        max_score: 100
      };
    });

    const score_breakdown: Record<string, { score: number; total: number; passed: number; failed: number }> = {};

    for (const rule of RULES_CATALOG) {
      // Only count rules applicable to the audited vendor
      const targetVendor = (vendor || 'common').toLowerCase();
      const ruleApplies = rule.applies_to.includes('common') || rule.applies_to.includes(targetVendor);
      if (!ruleApplies) continue;

      const isFailed = findings.some(f => {
        if (f.status !== 'open' && f.status !== 'pending_confirmation') return false;
        const normF = normalizeRuleId(f.rule_id);
        const normFCis = normalizeRuleId(f.cis_code || '');
        const normR = normalizeRuleId(rule.id);
        const normRCode = normalizeRuleId(rule.code || '');
        return (
          (normF && normR && normF === normR) ||
          (normF && normRCode && normF === normRCode) ||
          (normFCis && normR && normFCis === normR) ||
          (normFCis && normRCode && normFCis === normRCode)
        );
      });
      
      const sectionKey = rule.section || rule.category || 'General';
      if (!score_breakdown[sectionKey]) {
        score_breakdown[sectionKey] = { score: 100, total: 0, passed: 0, failed: 0 };
      }
      score_breakdown[sectionKey].total++;
      if (isFailed) {
        score_breakdown[sectionKey].failed++;
      } else {
        score_breakdown[sectionKey].passed++;
      }

      if (rule.cis_level) {
        const levelKey = `CIS Level ${rule.cis_level.replace('L', '')}`;
        if (!score_breakdown[levelKey]) {
          score_breakdown[levelKey] = { score: 100, total: 0, passed: 0, failed: 0 };
        }
        score_breakdown[levelKey].total++;
        if (isFailed) {
          score_breakdown[levelKey].failed++;
        } else {
          score_breakdown[levelKey].passed++;
        }
      }
    }

    // Now calculate the overall score based on total evaluated CIS rules
    let totalCisRules = 0;
    let totalCisFailed = 0;
    if (score_breakdown['CIS Level 1']) {
      totalCisRules += score_breakdown['CIS Level 1'].total;
      totalCisFailed += score_breakdown['CIS Level 1'].failed;
    }
    if (score_breakdown['CIS Level 2']) {
      totalCisRules += score_breakdown['CIS Level 2'].total;
      totalCisFailed += score_breakdown['CIS Level 2'].failed;
    }

    const score = totalCisRules > 0 ? Math.round(((totalCisRules - totalCisFailed) / totalCisRules) * 100) : 100;
    const grade = this.getGrade(score);

    // Everything else remains untouched for the loop

    for (const key of Object.keys(score_breakdown)) {
      const group = score_breakdown[key];
      group.score = Math.round((group.passed / Math.max(1, group.total)) * 100);
    }

    return { score, grade, breakdown, score_breakdown };
  }

  getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}

export const ScoringEngine = new ScoringEngineService();
