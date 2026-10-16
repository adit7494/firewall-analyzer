const fs = require('fs');

let content = fs.readFileSync('src/lib/parsers/fortigate-parser.ts', 'utf8');

// We want to replace:
// if (t === 'config system XYZ') { inXYZ = true; continue; }
// if (inXYZ && t === 'end') { ... inXYZ = false; continue; }
// if (!inXYZ) continue;
//
// with:
// let xyzNested = 0;
// if (t === 'config system XYZ') { inXYZ = true; xyzNested = 0; continue; }
// if (!inXYZ) continue;
// if (t.startsWith('config ')) { xyzNested++; continue; }
// if (t === 'end') {
//   if (xyzNested > 0) { xyzNested--; continue; }
//   ...
//   inXYZ = false; continue;
// }
// if (xyzNested > 0) continue;

const loops = content.match(/let in[a-zA-Z0-9]+ = false;[\s\S]*?for \(const line of lines\) \{[\s\S]*?\}/g);

if (loops) {
  loops.forEach(loop => {
    const inVarMatch = loop.match(/let (in[a-zA-Z0-9]+) = false;/);
    if (!inVarMatch) return;
    const inVar = inVarMatch[1];
    
    // Skip if already has nested
    if (loop.includes(`${inVar}Nested`)) return;

    let newLoop = loop.replace(`let ${inVar} = false;`, `let ${inVar} = false;\n    let ${inVar}Nested = 0;`);
    
    // Fix the entry line
    newLoop = newLoop.replace(`{ ${inVar} = true; continue; }`, `{ ${inVar} = true; ${inVar}Nested = 0; continue; }`);

    // Fix the end line
    const endMatch = newLoop.match(new RegExp(`if \\(${inVar} && t === 'end'\\) \\{([\\s\\S]*?)${inVar} = false;\\s*continue;\\s*\\}`, 'm'));
    
    if (endMatch) {
      const insideEnd = endMatch[1];
      const newEnd = `if (!${inVar}) continue;\n\n      if (t.startsWith('config ')) {\n        ${inVar}Nested++;\n        continue;\n      }\n\n      if (t === 'end') {\n        if (${inVar}Nested > 0) {\n          ${inVar}Nested--;\n          continue;\n        }\n${insideEnd}${inVar} = false;\n        continue;\n      }\n\n      if (${inVar}Nested > 0) continue;\n`;
      
      newLoop = newLoop.replace(endMatch[0], newEnd);
      newLoop = newLoop.replace(new RegExp(`if \\(!${inVar}\\) continue;`, 'g'), '');
      
      content = content.replace(loop, newLoop);
    }
  });
  
  fs.writeFileSync('src/lib/parsers/fortigate-parser.ts', content);
  console.log("Refactored loops successfully.");
} else {
  console.log("No loops found.");
}
