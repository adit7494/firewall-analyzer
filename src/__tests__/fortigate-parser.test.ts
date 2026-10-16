import test from 'node:test';
import assert from 'node:assert/strict';
import { FortiGateParser, parseFortiAST, tokenizeFortiLine } from '../lib/parsers/fortigate-parser';
import { extractAllBlocks, countExtractedBlocks } from '../lib/engine/block-extractor';
import { extractSnippet } from '../lib/engine/snippet-extractor';
import { normalizeRuleId, isRuleMatch } from '../lib/engine/rule-utils';
import { ScoringEngine } from '../lib/engine/scoring-engine';
import { evaluateAuditFrameworks } from '../lib/engine/framework-evaluator';
import { parseAIResponse } from '../lib/engine/ai-block-evaluator';
import { AuditResult, Finding } from '../lib/types/audit';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('tokenizeFortiLine handles quotes, spaces, and unquoted tokens', () => {
  const line = 'set member "Engineering address" "HR address" "Mobile Devices address" simple_name';
  const tokens = tokenizeFortiLine(line);
  assert.deepEqual(tokens, [
    'set',
    'member',
    'Engineering address',
    'HR address',
    'Mobile Devices address',
    'simple_name'
  ]);
});

test('tokenizeFortiLine handles interfaces with quotes', () => {
  const line = 'set allowaccess ping https ssh "custom access"';
  const tokens = tokenizeFortiLine(line);
  assert.deepEqual(tokens, ['set', 'allowaccess', 'ping', 'https', 'ssh', 'custom access']);
});

test('normalizeRuleId normalizes CIS- and AI- prefixes to lowercase', () => {
  assert.equal(normalizeRuleId('CIS-2.4.1'), '2.4.1');
  assert.equal(normalizeRuleId('AI-2.4.1'), '2.4.1');
  assert.equal(normalizeRuleId('2.4.1'), '2.4.1');
  assert.equal(normalizeRuleId('CIS-1.3'), '1.3');
  assert.equal(normalizeRuleId('AI-1.3'), '1.3');
  assert.equal(normalizeRuleId('ADM-001'), 'adm-001');
  assert.equal(normalizeRuleId('FW-001'), 'fw-001');
  assert.equal(normalizeRuleId(''), '');
  assert.equal(normalizeRuleId(null), '');
});

test('isRuleMatch correctly compares findings to catalog rules', () => {
  assert.ok(isRuleMatch('AI-2.4.1', undefined, 'CIS-2.4.1', '2.4.1'));
  assert.ok(isRuleMatch('CIS-2.4.1', '2.4.1', 'CIS-2.4.1', '2.4.1'));
  assert.ok(isRuleMatch('2.4.1', undefined, 'CIS-2.4.1', '2.4.1'));
  assert.ok(isRuleMatch('ADM-001', undefined, 'ADM-001', undefined));
  assert.ok(!isRuleMatch('CIS-1.1', undefined, 'CIS-1.3', '1.3'));
});

test('FortiGateParser parses sample-fortigate.conf with correct metadata and no ghost admins', () => {
  const samplePath = path.join(process.cwd(), 'src/lib/samples/sample-fortigate.conf');
  const content = fs.readFileSync(samplePath, 'utf8');

  const parser = new FortiGateParser();
  assert.ok(parser.detect(content));

  const parsed = parser.parse(content, 'sample-fortigate.conf');

  assert.equal(parsed.device.model, 'FortiGate-60F');
  assert.equal(parsed.device.os_version, '7.4.3');
  assert.equal(parsed.device.hostname, 'FGT-60F-HQ');

  // Verify admin accounts: exactly 2 accounts ('admin', 'net_ops'), no ghost accounts
  assert.equal(parsed.admin_accounts.length, 2);
  assert.equal(parsed.admin_accounts[0].name, 'admin');
  assert.equal(parsed.admin_accounts[1].name, 'net_ops');

  // Verify interfaces
  assert.ok(parsed.interfaces.length >= 2);
  const wan = parsed.interfaces.find(i => i.name === 'wan1');
  assert.ok(wan);
  assert.equal(wan.zone, 'WAN');

  // Verify firewall rules
  assert.ok(parsed.firewall_rules.length >= 2);
  const rule1 = parsed.firewall_rules.find(r => r.id === '1');
  assert.ok(rule1);
  assert.equal(rule1.src_zone, 'wan1');
  assert.deepEqual(rule1.src, ['all']);
  assert.deepEqual(rule1.dst, ['DMZ_Web_Server']);
  assert.deepEqual(rule1.service, ['HTTP', 'HTTPS']);

  const rule2 = parsed.firewall_rules.find(r => r.id === '2');
  assert.ok(rule2);
  assert.equal(rule2.src_zone, 'internal');
  assert.deepEqual(rule2.src, ['LAN_Subnet']);
  assert.deepEqual(rule2.dst, ['all']);
  assert.deepEqual(rule2.service, ['ALL']);
});

test('FortiGateParser handles nested config blocks in enterprise config FGT-EVT-Batam', () => {
  const configPath = path.join(process.cwd(), 'FGT-EVT-Batam_7-4_2902_202607291209.conf');
  if (!fs.existsSync(configPath)) {
    return;
  }
  const content = fs.readFileSync(configPath, 'utf8');

  const parser = new FortiGateParser();
  assert.ok(parser.detect(content));

  const parsed = parser.parse(content, 'FGT-EVT-Batam_7-4_2902_202607291209.conf');

  // 1. Header with #config-version= without spaces
  assert.equal(parsed.device.model, 'FortiGate-60F');
  assert.equal(parsed.device.os_version, '7.4.12');
  assert.equal(parsed.device.hostname, 'FGT-EVT-Batam');
  assert.equal(parsed.device.serial, 'FGT60FTK22084882');

  // 2. Prevent admin ghost accounts:
  // "adhitya" had 10 dashboard edits each with multiple widgets inside.
  // There is 1 real admin ("adhitya") and 2 API users ("ConnectSecure", "report-api").
  // Ghost accounts like "1", "2", "3" from widgets must NOT be present!
  const adminNames = parsed.admin_accounts.map(a => a.name);
  assert.ok(adminNames.includes('adhitya'), 'Must contain real admin adhitya');
  assert.ok(adminNames.includes('ConnectSecure'), 'Must contain API user ConnectSecure');
  assert.ok(adminNames.includes('report-api'), 'Must contain API user report-api');
  assert.ok(!adminNames.includes('1'), 'Must NOT contain ghost widget account 1');
  assert.ok(!adminNames.includes('2'), 'Must NOT contain ghost widget account 2');
  assert.ok(!adminNames.includes('Status'), 'Must NOT contain dashboard Status as admin');
  assert.equal(parsed.admin_accounts.length, 3, 'Must have exactly 3 admin/API accounts');

  // 3. Nested interface blocks: wan1 had config ipv6 ... end
  // Parser must NOT prematurely exit config system interface!
  assert.ok(parsed.interfaces.length > 5, `Expected multiple interfaces, got ${parsed.interfaces.length}`);
  const intfNames = parsed.interfaces.map(i => i.name);
  assert.ok(intfNames.includes('wan1'));
  assert.ok(intfNames.includes('wan2'));
  assert.ok(intfNames.includes('dmz'));
  assert.ok(intfNames.includes('internal1'));
  assert.ok(intfNames.includes('internal2'));

  // 4. WAN heuristic: wan1, wan2 must be WAN; internal1, internal2 must be Internal
  const wan1 = parsed.interfaces.find(i => i.name === 'wan1');
  assert.equal(wan1?.zone, 'WAN');
  const wan2 = parsed.interfaces.find(i => i.name === 'wan2');
  assert.equal(wan2?.zone, 'WAN');
  const int1 = parsed.interfaces.find(i => i.name === 'internal1');
  assert.equal(int1?.zone, 'Internal');

  // 5. NTP syntax: set ntpsync enable
  assert.equal(parsed.system.ntp_configured, true, 'NTP must be detected as configured via ntpsync enable');

  // 6. Address groups & service objects
  assert.ok(parsed.address_objects.length > 0);
  assert.ok(parsed.service_objects.length > 0);
  const usedAddrs = parsed.address_objects.filter(a => a.used);
  assert.ok(usedAddrs.length > 0, 'Address objects used in groups or rules should have used=true');
});

test('extractSnippet handles nested config blocks without premature termination', () => {
  const dummyConfig = {
    raw_content: `config system interface
    edit "wan1"
        set vdom "root"
        set ip 192.168.1.1 255.255.255.0
        config ipv6
            set ip6-send-adv enable
        end
        set allowaccess ping https
    next
    edit "wan2"
        set ip 10.0.0.1 255.255.255.0
    next
end`
  } as any;

  // Extract snippet of wan1 with nested config ipv6
  const snippet = extractSnippet(dummyConfig, 'config system interface', 'edit "wan1"');
  assert.ok(snippet.includes('config system interface'));
  assert.ok(snippet.includes('edit "wan1"'));
  assert.ok(snippet.includes('config ipv6'));
  assert.ok(snippet.includes('set ip6-send-adv enable'));
  assert.ok(snippet.includes('end'));
  assert.ok(snippet.includes('set allowaccess ping https'));
  assert.ok(snippet.includes('next'));
});

test('extractAllBlocks extracts blocks accurately in a single pass', () => {
  const raw = `config system global
    set hostname "Test-FW"
end
config system interface
    edit "port1"
        set role lan
        config ipv6
            set ip6-status enable
        end
    next
end
config firewall policy
    edit 1
        set name "Test"
    next
end`;

  const blocks = extractAllBlocks(raw);
  assert.equal(countExtractedBlocks(blocks), 3);
  assert.ok(blocks.system_global?.includes('set hostname "Test-FW"'));
  assert.ok(blocks.system_interface?.includes('config ipv6'));
  assert.ok(blocks.system_interface?.includes('set ip6-status enable'));
  assert.ok(blocks.system_interface?.includes('end'));
  assert.ok(blocks.firewall_policy?.includes('edit 1'));
});

test('evaluateAuditFrameworks marks controls with no violations as Compliant', () => {
  const mockAudit: AuditResult = {
    id: 'audit-test-1',
    company_id: 'comp-1',
    device_id: 'dev-1',
    vendor: 'FortiGate',
    config_file_name: 'test.conf',
    status: 'done',
    score: 100,
    grade: 'A',
    created_by: 'Test',
    created_at: new Date().toISOString(),
    findings: [], // 0 violations! Clean config!
    breakdown: [],
    rules_analyzed: 50,
    controls_checked: 50
  };

  const fwResults = evaluateAuditFrameworks(mockAudit);
  assert.ok(fwResults.length > 0);

  for (const fw of fwResults) {
    // For a clean config with 0 violations, assessable score must be 100%, NOT 0%
    assert.equal(fw.score, 100, `Framework ${fw.framework_code} score should be 100% for 0 violations`);
    if (fw.total_controls === 0) continue; // Base framework without discrete controls in seed (e.g. CIS)
    assert.ok(fw.covered_controls > 0, `Framework ${fw.framework_code} should have covered controls`);
    const nonCompliant = fw.controls.filter(c => c.status === 'Non-Compliant');
    assert.equal(nonCompliant.length, 0, `Framework ${fw.framework_code} should have 0 Non-Compliant controls`);
    const compliant = fw.controls.filter(c => c.status === 'Compliant');
    assert.ok(compliant.length > 0, `Framework ${fw.framework_code} should have Compliant controls`);
  }
});

test('evaluateAuditFrameworks marks controls with active violations as Non-Compliant and reduces score', () => {
  const mockAuditWithFinding: AuditResult = {
    id: 'audit-test-2',
    company_id: 'comp-1',
    device_id: 'dev-1',
    vendor: 'FortiGate',
    config_file_name: 'test.conf',
    status: 'done',
    score: 85,
    grade: 'B',
    created_by: 'Test',
    created_at: new Date().toISOString(),
    findings: [
      {
        id: 'f-1',
        audit_id: 'audit-test-2',
        rule_id: 'CIS-2.1.1',
        cis_code: '2.1.1',
        title: 'Pre-Login Banner must be enabled',
        description: 'Pre-login banner was not enabled',
        category: 'System Settings',
        severity: 'Medium',
        status: 'open',
        penalty_score: 5,
        is_manual: false,
        created_at: new Date().toISOString(),
        recommendation: 'Enable pre-login banner',
        compliance_tags: ['CIS FortiGate']
      }
    ],
    breakdown: [],
    rules_analyzed: 50,
    controls_checked: 50
  };

  const fwResults = evaluateAuditFrameworks(mockAuditWithFinding);
  
  // CTM-SC maps to 2.1.1
  const ctm = fwResults.find(f => f.framework_code === 'CTM');
  assert.ok(ctm);
  const ctmSc = ctm.controls.find(c => c.control_code === 'CTM-SC');
  assert.ok(ctmSc);
  assert.equal(ctmSc.status, 'Non-Compliant');
  assert.equal(ctmSc.failed_count, 1);
  assert.ok(ctm.score < 100, `CTM score should drop below 100 due to violation: got ${ctm.score}`);

  // NIST CSF PR.PS-01 also maps to 2.1.1
  const nist = fwResults.find(f => f.framework_code === 'NIST_CSF');
  assert.ok(nist);
  const nistPs = nist.controls.find(c => c.control_code === 'PR.PS-01');
  assert.ok(nistPs);
  assert.equal(nistPs.status, 'Non-Compliant');
  assert.equal(nistPs.failed_count, 1);
});

test('Rule ID normalization handles mixed prefixes, whitespace, and case sensitivity', () => {
  assert.equal(normalizeRuleId('CIS-2.1.1'), '2.1.1');
  assert.equal(normalizeRuleId('cis-2.1.1'), '2.1.1');
  assert.equal(normalizeRuleId('AI-2.1.1'), '2.1.1');
  assert.equal(normalizeRuleId('ai-2.1.1'), '2.1.1');
  assert.equal(normalizeRuleId('  CIS-1.1  '), '1.1');
  assert.equal(normalizeRuleId(''), '');
  assert.equal(normalizeRuleId(undefined), '');

  assert.equal(isRuleMatch('AI-2.1.1', 'CIS-2.1.1'), true);
  assert.equal(isRuleMatch('2.1.1', 'CIS-2.1.1'), true);
  assert.equal(isRuleMatch('cis-2.1.1', 'ai-2.1.1'), true);
  assert.equal(isRuleMatch('CIS-2.1.1', 'CIS-2.1.2'), false);
});

test('parseAIResponse flexibly parses array, findings wrapper, and markdown fences', () => {
  // 1. Top-level array format
  const arrayPayload = JSON.stringify([
    {
      rule_id: 'CIS-2.1.1',
      title: 'Pre-Login Banner must be enable',
      status: 'failed',
      severity: 'Low',
      category: 'System Settings',
      reason: 'Banner is disabled',
      evidence: 'set pre-login-banner disable',
      recommendation: 'set pre-login-banner enable'
    }
  ]);
  const res1 = parseAIResponse(arrayPayload, 'system_global');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].rule_id, 'CIS-2.1.1');

  // 2. Object with "findings" wrapper
  const findingsObjPayload = JSON.stringify({
    findings: [
      {
        rule_id: 'CIS-2.4.4',
        title: 'Admin idle timeout must be 5 minutes or less',
        status: 'failed',
        severity: 'Medium',
        category: 'System Settings',
        reason: 'admintimeout is 30',
        evidence: 'set admintimeout 30',
        recommendation: 'set admintimeout 5'
      }
    ]
  });
  const res2 = parseAIResponse(findingsObjPayload, 'system_global');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].rule_id, 'CIS-2.4.4');

  // 3. Wrapped with markdown code fences (```json ... ```)
  const markdownFenced = `\`\`\`json\n{\n  "findings": [\n    {\n      "rule_id": "CIS-2.1.8",\n      "title": "SSL static key ciphers must be disabled",\n      "status": "failed",\n      "severity": "Medium",\n      "category": "System Settings",\n      "reason": "Enabled",\n      "evidence": "set ssl-static-key-ciphers enable",\n      "recommendation": "set ssl-static-key-ciphers disable"\n    }\n  ]\n}\n\`\`\``;
  const res3 = parseAIResponse(markdownFenced, 'system_global');
  assert.equal(res3.length, 1);
  assert.equal(res3[0].rule_id, 'CIS-2.1.8');

  // 4. Object with "results" wrapper
  const resultsObjPayload = JSON.stringify({
    results: [
      {
        rule_id: 'AI-2.1.4',
        title: 'HTTPS redirect must be enabled',
        status: 'failed',
        severity: 'High',
        category: 'System Settings',
        reason: 'Disabled',
        evidence: 'set https-redirect disable',
        recommendation: 'set https-redirect enable'
      }
    ]
  });
  const res4 = parseAIResponse(resultsObjPayload, 'system_global');
  assert.equal(res4.length, 1);
  assert.equal(res4[0].rule_id, 'AI-2.1.4');

  // 5. Empty findings when all rules pass
  const emptyObj = JSON.stringify({ findings: [] });
  const res5 = parseAIResponse(emptyObj, 'system_global');
  assert.equal(res5.length, 0);

  const emptyArray = '[]';
  const res6 = parseAIResponse(emptyArray, 'system_global');
  assert.equal(res6.length, 0);

  // 6. Truncated JSON recovery
  const truncated = `[{"rule_id":"CIS-2.1.1","title":"Banner","status":"failed","severity":"Low","category":"System Settings","reason":"r","evidence":"e","recommendation":"rec"`;
  const res7 = parseAIResponse(truncated, 'system_global');
  assert.equal(res7.length, 1);
  assert.equal(res7[0].rule_id, 'CIS-2.1.1');
});


