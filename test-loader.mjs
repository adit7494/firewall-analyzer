import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Custom ESM loader hook to resolve extensionless TypeScript imports and JSON files for node:test
 */
export async function resolve(specifier, context, nextResolve) {
  let targetSpecifier = specifier;
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    targetSpecifier = pathToFileURL(path.resolve(process.cwd(), 'src', rel)).href;
  }

  try {
    return await nextResolve(targetSpecifier, context);
  } catch (err) {
    if (targetSpecifier.startsWith('.') || targetSpecifier.startsWith('file://')) {
      const extensions = ['.ts', '.tsx', '.js', '.json', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        try {
          const candidate = targetSpecifier + ext;
          return await nextResolve(candidate, context);
        } catch {
          // try next
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: 'json' }
    });
  }

  const result = await nextLoad(url, context);
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    let source = typeof result.source === 'string' ? result.source : result.source?.toString('utf8');
    if (source) {
      source = source.replace(/import\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"][^'"]*types\/[^'"]*['"];?/g, '// stripped types import');
      source = source.replace(/import\s*\{\s*NormalizedConfig\s*\}\s*from\s*['"][^'"]+['"];?/g, '// stripped type import');
      source = source.replace(/import\s*\{\s*AuditRule[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '// stripped type import');
      source = source.replace(/import\s*\{\s*Finding[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '// stripped type import');
      return { ...result, source };
    }
  }
  return result;
}

