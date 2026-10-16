const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'engine', 'cis-fortigate-rules-part3.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Revert openDns replacement if any
content = content.replace(/unloggedDns\.length > 0 \? unloggedDns/g, "openDns.length > 0 ? openDns");

// Now carefully replace
content = content.replace(
  /evidence_snippet: openDns\.length > 0 \? openDns\.map\(p => `config dnsfilter profile\\n    edit "\${p\.name}"\\n        set log-all-domain disable\\n    next`\)\.join\('\\n'\) : '# No DNS Filter profiles with log-all-domain enabled',/g,
  "evidence_snippet: unloggedDns.length > 0 ? unloggedDns.map(p => `config dnsfilter profile\\n    edit \"${p.name}\"\\n        set log-all-domain disable\\n    next`).join('\\n') : '# No DNS Filter profiles with log-all-domain enabled',"
);

content = content.replace(
  /evidence_snippet: openApp\.length > 0 \? openApp\.map\(p => `config application list\\n    edit "\${p\.name}"\\n        set enforce-default-app-port disable\\n    next`\)\.join\('\\n'\) : '# No Application Control profiles enforcing default port',/g,
  "evidence_snippet: openPort.length > 0 ? openPort.map(p => `config application list\\n    edit \"${p.name}\"\\n        set enforce-default-app-port disable\\n    next`).join('\\n') : '# No Application Control profiles enforcing default port',"
);

content = content.replace(
  /evidence_snippet: openApp\.length > 0 \? openApp\.map\(p => `config application list\\n    edit "\${p\.name}"\\n        set log disable\\n    next`\)\.join\('\\n'\) : '# No Application Control profiles with logging enabled',/g,
  "evidence_snippet: unloggedApp.length > 0 ? unloggedApp.map(p => `config application list\\n    edit \"${p.name}\"\\n        set log disable\\n    next`).join('\\n') : '# No Application Control profiles with logging enabled',"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed var names accurately');
