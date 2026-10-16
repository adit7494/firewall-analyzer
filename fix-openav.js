const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'lib', 'engine');
const filePath = path.join(dir, 'cis-fortigate-rules-part3.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Replace openAv.length > 0 ? openAv.map... with (config.security_profiles?.av?.profiles || []).length > 0 ...
const replacer = (configKey) => `(config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => \`config antivirus profile\\n    edit "\${p.name}"\\n        set ${configKey} disable\\n    next\`).join('\\n')`;

content = content.replace(
  /openAv\.length > 0 \? openAv\.map\(p => `config antivirus profile\\n    edit "\${p\.name}"\\n        set outbreak-prevention disable\\n    next`\)\.join\('\\n'\)/g,
  replacer('outbreak-prevention')
);

content = content.replace(
  /openAv\.length > 0 \? openAv\.map\(p => `config antivirus profile\\n    edit "\${p\.name}"\\n        set machine-learning-detection disable\\n    next`\)\.join\('\\n'\)/g,
  replacer('machine-learning-detection')
);

content = content.replace(
  /openAv\.length > 0 \? openAv\.map\(p => `config antivirus profile\\n    edit "\${p\.name}"\\n        set grayware disable\\n    next`\)\.join\('\\n'\)/g,
  replacer('grayware')
);

content = content.replace(
  /openAv\.length > 0 \? openAv\.map\(p => `config antivirus profile\\n    edit "\${p\.name}"\\n        set sandbox-inline disable\\n    next`\)\.join\('\\n'\)/g,
  replacer('sandbox-inline')
);

content = content.replace(
  /openAv\.length > 0 \? openAv\.map\(p => `config antivirus profile\\n    edit "\${p\.name}"\\n        set content-disarm disable\\n    next`\)\.join\('\\n'\)/g,
  replacer('content-disarm')
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed openAv references');
