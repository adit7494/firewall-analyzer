import { RULES_CATALOG } from './src/lib/engine/rules-catalog';
import fs from 'fs';

const aiCodePath = './src/lib/engine/ai-block-evaluator.ts';
let aiCode = fs.readFileSync(aiCodePath, 'utf-8');

// Match every AI rule definition in the prompt. e.g. "- CIS-2.1.5 [L2, Medium, System Settings]: Strong crypto must be enabled..."
const ruleRegex = /- (CIS-[0-9.]+|[a-zA-Z0-9.-]+) (\[[^\]]+\]): ([^\n]+)/g;

let match;
let replacements = [];

while ((match = ruleRegex.exec(aiCode)) !== null) {
  const originalId = match[1];
  const tags = match[2];
  const description = match[3];
  
  // Find the best match in the catalog based on text similarity or keyword
  let bestMatch = null;
  let highestScore = 0;
  
  for (const catRule of RULES_CATALOG) {
    let score = 0;
    const catText = (catRule.title + ' ' + (catRule.recommendation || '') + ' ' + (catRule.config_key || '')).toLowerCase();
    const aiText = description.toLowerCase();
    
    // Simple keyword matching for common things
    if (aiText.includes('strong crypto') && catText.includes('strong-crypto')) score += 100;
    if (aiText.includes('https redirect') && catText.includes('redirect')) score += 50;
    if (aiText.includes('pre-login banner') && catText.includes('pre-login-banner')) score += 100;
    if (aiText.includes('post-login banner') && catText.includes('post-login-banner')) score += 100;
    if (aiText.includes('admin idle timeout') && catText.includes('admintimeout')) score += 100;
    if (aiText.includes('ssl static key') && catText.includes('ssl-static-key')) score += 100;
    if (aiText.includes('gui cdn usage') && catText.includes('gui-cdn-usage')) score += 100;
    if (aiText.includes('admin https ssl versions') && catText.includes('admin-https-ssl-versions')) score += 100;
    if (aiText.includes('ntp must be enabled') && catText.includes('ntpsync')) score += 100;
    if (aiText.includes('ntp servers must be') && catText.includes('ntpserver')) score += 100;
    if (aiText.includes('password policy must be enabled') && catText.includes('password policy')) score += 100;
    if (aiText.includes('minimum password length') && catText.includes('minimum-length')) score += 100;
    if (aiText.includes('ips sensor assigned') && catText.includes('ips profile')) score += 100;
    if (aiText.includes('antivirus profile assigned') && catText.includes('av profile')) score += 100;
    if (aiText.includes('dns filter profile assigned') && catText.includes('dns filter')) score += 100;
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = catRule;
    }
  }
  
  if (bestMatch && highestScore > 0) {
    if (originalId !== bestMatch.id) {
      console.log(`Will replace ${originalId} with ${bestMatch.id} for "${description.substring(0, 50)}..."`);
      replacements.push({
        from: `- ${originalId} ${tags}: ${description}`,
        to: `- ${bestMatch.id} ${tags}: ${description}`
      });
    }
  } else {
    // If no match found, prefix with AI- to prevent false collisions
    if (originalId.startsWith('CIS-')) {
      const newId = originalId.replace('CIS-', 'AI-');
      console.log(`No catalog match for ${originalId}, renaming to ${newId} for "${description.substring(0, 50)}..."`);
      replacements.push({
        from: `- ${originalId} ${tags}: ${description}`,
        to: `- ${newId} ${tags}: ${description}`
      });
    }
  }
}

// Apply replacements
for (const rep of replacements) {
  aiCode = aiCode.replace(rep.from, rep.to);
}

fs.writeFileSync(aiCodePath, aiCode, 'utf-8');
console.log(`Replaced ${replacements.length} mismatched IDs in ai-block-evaluator.ts`);
