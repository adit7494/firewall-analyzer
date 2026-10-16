import { NormalizedConfig } from '../types/normalized-config';

/**
 * Extracts a configuration snippet from the raw config text with robust
 * depth-tracking to handle nested sub-blocks (`config ... end` inside `edit ... next`).
 *
 * @param config NormalizedConfig object with raw_content
 * @param blockStart Starting header, e.g. "config system interface"
 * @param subItem Optional sub-item prefix, e.g. 'edit "wan1"'
 * @param fallbackMsg Message returned if block or subItem is not found
 */
export function extractSnippet(
  config: NormalizedConfig,
  blockStart: string,
  subItem?: string,
  fallbackMsg: string = '# Configuration missing or disabled'
): string {
  if (!config.raw_content) {
    return fallbackMsg;
  }

  const lines = config.raw_content.split(/\r?\n/);
  const normalizedBlockStart = blockStart.trim();
  let inBlock = false;
  let blockDepth = 0;
  let inSubItem = false;
  let subConfigDepth = 0;
  const extracted: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Start of target block
    if (!inBlock) {
      if (trimmed === normalizedBlockStart || line.startsWith(normalizedBlockStart)) {
        inBlock = true;
        blockDepth = 1;
        if (!subItem) {
          extracted.push(line);
        }
      }
      continue;
    }

    // Inside target block: track block-level config/end depth
    if (trimmed.startsWith('config ') || trimmed === 'config') {
      blockDepth++;
      if (inSubItem) {
        subConfigDepth++;
      }
    } else if (trimmed === 'end') {
      blockDepth--;
      if (inSubItem && subConfigDepth > 0) {
        subConfigDepth--;
      }
      if (blockDepth === 0) {
        // Closed the top-level block
        if (!subItem) {
          extracted.push(line);
        } else if (inSubItem) {
          extracted.push('end');
        }
        break;
      }
    }

    if (subItem) {
      if (!inSubItem) {
        if (trimmed === subItem.trim() || trimmed.startsWith(subItem.trim())) {
          inSubItem = true;
          subConfigDepth = 0;
          extracted.push(normalizedBlockStart);
          extracted.push(line);
        }
      } else {
        // Inside subItem
        if (subConfigDepth === 0 && (trimmed === 'next' || (trimmed.startsWith('edit ') && trimmed !== subItem.trim()))) {
          if (trimmed === 'next') {
            extracted.push(line);
          }
          extracted.push('end');
          break;
        }
        extracted.push(line);
      }
    } else {
      // Whole block extraction
      extracted.push(line);
    }
  }

  if (extracted.length > 0) {
    return extracted.join('\n');
  }

  return fallbackMsg;
}
