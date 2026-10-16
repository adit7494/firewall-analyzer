const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'lib', 'engine');
const files = [
  'cis-fortigate-rules-part1.ts',
  'cis-fortigate-rules-part2.ts',
  'cis-fortigate-rules-part3.ts',
  'rules-catalog.ts'
];

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix IPS
  content = content.replace(
    /evidence_snippet:\s*`config ips sensor\\n\s*edit "default_ips"\\n\s*set scan-botnet-connections disable\\nend`,/g,
    "evidence_snippet: openIps.length > 0 ? openIps.map(p => `config ips sensor\\n    edit \"${p.name}\"\\n        set scan-botnet-connections disable\\n    next`).join('\\n') : '# No IPS sensors configured with scan-botnet-connections enabled',"
  );

  // Fix AV Outbreak Prevention
  content = content.replace(
    /evidence_snippet:\s*`config antivirus profile\\n\s*edit "default_av"\\n\s*set outbreak-prevention disable\\nend`,/g,
    "evidence_snippet: openAv.length > 0 ? openAv.map(p => `config antivirus profile\\n    edit \"${p.name}\"\\n        set outbreak-prevention disable\\n    next`).join('\\n') : '# No Antivirus profiles with outbreak-prevention enabled',"
  );

  // Fix AV ML
  content = content.replace(
    /evidence_snippet:\s*`config antivirus profile\\n\s*edit "default_av"\\n\s*set machine-learning-detection disable\\nend`,/g,
    "evidence_snippet: openAv.length > 0 ? openAv.map(p => `config antivirus profile\\n    edit \"${p.name}\"\\n        set machine-learning-detection disable\\n    next`).join('\\n') : '# No Antivirus profiles with machine-learning-detection enabled',"
  );

  // Fix AV Grayware
  content = content.replace(
    /evidence_snippet:\s*`config antivirus profile\\n\s*edit "default_av"\\n\s*set grayware disable\\nend`,/g,
    "evidence_snippet: openAv.length > 0 ? openAv.map(p => `config antivirus profile\\n    edit \"${p.name}\"\\n        set grayware disable\\n    next`).join('\\n') : '# No Antivirus profiles with grayware blocked',"
  );

  // Fix AV Sandbox
  content = content.replace(
    /evidence_snippet:\s*`config antivirus profile\\n\s*edit "default_av"\\n\s*set sandbox-inline disable\\nend`,/g,
    "evidence_snippet: openAv.length > 0 ? openAv.map(p => `config antivirus profile\\n    edit \"${p.name}\"\\n        set sandbox-inline disable\\n    next`).join('\\n') : '# No Antivirus profiles with sandbox-inline enabled',"
  );

  // Fix AV CDR
  content = content.replace(
    /evidence_snippet:\s*`config antivirus profile\\n\s*edit "default_av"\\n\s*set content-disarm disable\\nend`,/g,
    "evidence_snippet: openAv.length > 0 ? openAv.map(p => `config antivirus profile\\n    edit \"${p.name}\"\\n        set content-disarm disable\\n    next`).join('\\n') : '# No Antivirus profiles with content-disarm enabled',"
  );

  // Fix DNS Botnet
  content = content.replace(
    /evidence_snippet:\s*`config dnsfilter profile\\n\s*edit "default_dns"\\n\s*set block-botnet disable\\nend`,/g,
    "evidence_snippet: openDns.length > 0 ? openDns.map(p => `config dnsfilter profile\\n    edit \"${p.name}\"\\n        set block-botnet disable\\n    next`).join('\\n') : '# No DNS Filter profiles with block-botnet enabled',"
  );

  // Fix DNS Log
  content = content.replace(
    /evidence_snippet:\s*`config dnsfilter profile\\n\s*edit "default_dns"\\n\s*set log-all-domain disable\\nend`,/g,
    "evidence_snippet: openDns.length > 0 ? openDns.map(p => `config dnsfilter profile\\n    edit \"${p.name}\"\\n        set log-all-domain disable\\n    next`).join('\\n') : '# No DNS Filter profiles with log-all-domain enabled',"
  );

  // Fix App Action
  content = content.replace(
    /evidence_snippet:\s*`config application list\\n\s*edit "default_app"\\n\s*set action monitor\\nend`,/g,
    "evidence_snippet: openApp.length > 0 ? openApp.map(p => `config application list\\n    edit \"${p.name}\"\\n        set action monitor\\n    next`).join('\\n') : '# No Application Control profiles blocking high risk apps',"
  );

  // Fix App Default Port
  content = content.replace(
    /evidence_snippet:\s*`config application list\\n\s*edit "default_app"\\n\s*set enforce-default-app-port disable\\nend`,/g,
    "evidence_snippet: openApp.length > 0 ? openApp.map(p => `config application list\\n    edit \"${p.name}\"\\n        set enforce-default-app-port disable\\n    next`).join('\\n') : '# No Application Control profiles enforcing default port',"
  );

  // Fix App Log
  content = content.replace(
    /evidence_snippet:\s*`config application list\\n\s*edit "default_app"\\n\s*set log disable\\nend`,/g,
    "evidence_snippet: openApp.length > 0 ? openApp.map(p => `config application list\\n    edit \"${p.name}\"\\n        set log disable\\n    next`).join('\\n') : '# No Application Control profiles with logging enabled',"
  );

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Done fixing snippets');
