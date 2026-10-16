import { AuditRule } from '../types/audit';
import { CIS_FORTIGATE_RULES_PART1 } from './cis-fortigate-rules-part1';
import { CIS_FORTIGATE_RULES_PART2 } from './cis-fortigate-rules-part2';
import { CIS_FORTIGATE_RULES_PART3 } from './cis-fortigate-rules-part3';

export const CIS_FORTIGATE_RULES: AuditRule[] = [
  ...CIS_FORTIGATE_RULES_PART1,
  ...CIS_FORTIGATE_RULES_PART2,
  ...CIS_FORTIGATE_RULES_PART3
];
