import { RULES_CATALOG } from './src/lib/engine/rules-catalog';
import fs from 'fs';

const aiCode = fs.readFileSync('./src/lib/engine/ai-block-evaluator.ts', 'utf-8');
const aiRules = [...aiCode.matchAll(/- (CIS-[a-zA-Z0-9.-]+) \[[^\]]+\]: (.*?)\./g)].map(m => ({ id: m[1], text: m[2] }));

for (const ai of aiRules) {
  const cat = RULES_CATALOG.find(r => r.id === ai.id);
  if (cat) {
    console.log(`AI: ${ai.id} -> ${ai.text}`);
    console.log(`CAT: ${cat.id} -> ${cat.title}`);
    console.log('---');
  } else {
    console.log(`AI ONLY: ${ai.id} -> ${ai.text}`);
    console.log('---');
  }
}
