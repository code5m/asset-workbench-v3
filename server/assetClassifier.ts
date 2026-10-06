import fs from 'node:fs';
import path from 'node:path';
import type { AssetKind, ManagedAssetType } from '../src/domain/asset.ts';
import { detectCodeLanguage, isRecognizedCodeExtension } from '../packages/language-core/src/index.ts';
import { metadataRelForContent } from './managedAssetService.ts';

/**
 * Logical asset classification.
 *
 * Physical path and logical asset type are two different things. The
 * classifier derives a logical AssetKind from the expected-skeleton top-level
 * directory and from file extension. It NEVER fabricates a physical path.
 */

const DOC_EXT = new Set(['md', 'markdown', 'txt', 'rst', 'adoc', 'org']);

export function classify(rel: string, isDir: boolean): AssetKind {
  const top = rel.split('/')[0].toLowerCase();
  switch (top) {
    case '00-introduction':
      return 'introduction';
    case '01-code':
      return 'code';
    case '02-design':
      return 'design';
    case '03-docs':
      return 'document';
    case '04-conversations':
      return 'conversation';
    case '05-derived':
      return 'derived';
    default:
      break;
  }

  const lower = rel.toLowerCase();
  if (lower.endsWith('makefile') || lower.endsWith('dockerfile') || lower.endsWith('license')) {
    return 'code';
  }
  if (!isDir) {
    const ext = extOf(rel);
    if (DOC_EXT.has(ext)) return 'document';
    if (isRecognizedCodeExtension(ext)) return 'code';
  }
  return 'other';
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  const base = name.slice(0, i).toLowerCase();
  if (base === 'makefile' || base === 'dockerfile' || base === 'license') return '';
  return name.slice(i + 1).toLowerCase();
}

/**
 * Semantic managed-asset type for a relative path. This is independent of the
 * physical `assetType` (category): a decision lives under `02-design/decisions`
 * so its category is `design`, but its `managedType` is `decision`.
 *
 * Priority: `decision` MUST be checked before generic `design`, otherwise
 * `02-design/decisions/foo.md` would be misclassified as a plain design.
 */
export function detectManagedType(rel: string): ManagedAssetType | undefined {
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts[0] === '04-conversations') return 'conversation';
  if (parts[0] === '02-design') {
    if (parts.includes('decisions')) return 'decision';
    return 'design';
  }
  return undefined;
}

/**
 * Precise managed type, resolved from the asset's own metadata sidecar.
 *
 * Path alone is NOT enough to distinguish a raw Transcript from an Agent Work
 * Record (both live under `04-conversations`). The classifier therefore reads
 * the metadata and applies the following priority (see AGENTS.md > Transcript
 * vs Work Record):
 *
 *   meta.type === 'conversation-transcript'           -> conversation-transcript
 *   meta.type === 'agent-work-record'                 -> agent-work-record
 *   meta.type === 'conversation' (legacy) + captureMode
 *       'agent-work-record'                           -> agent-work-record
 *       'full-transcript' | 'imported-transcript'     -> conversation-transcript
 *       (other)                                      -> conversation (legacy)
 *
 * Anything not under 04-conversations / 02-design returns the coarse type.
 */
export function resolveManagedType(root: string, rel: string): ManagedAssetType | undefined {
  const coarse = detectManagedType(rel);
  if (!coarse) return undefined;
  if (coarse !== 'conversation' && coarse !== 'design' && coarse !== 'decision') {
    return coarse;
  }
  try {
    const metaRel = metadataRelForContent(rel);
    const abs = path.join(root, ...metaRel.split('/').filter(Boolean));
    const meta = JSON.parse(fs.readFileSync(abs, 'utf8')) as {
      type?: string;
      captureMode?: string;
    };
    if (meta && typeof meta.type === 'string') {
      if (meta.type === 'conversation-transcript') return 'conversation-transcript';
      if (meta.type === 'agent-work-record') return 'agent-work-record';
      if (meta.type === 'conversation') {
        if (meta.captureMode === 'agent-work-record') return 'agent-work-record';
        if (meta.captureMode === 'full-transcript' || meta.captureMode === 'imported-transcript') {
          return 'conversation-transcript';
        }
        return 'conversation';
      }
    }
  } catch {
    // metadata missing / unreadable: fall back to coarse detection
  }
  return coarse;
}


export { detectCodeLanguage } from '../packages/language-core/src/index.ts';
