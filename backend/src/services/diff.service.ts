import { createTwoFilesPatch } from 'diff';
import jsonPatch from 'fast-json-patch';
import type { ArtifactBlock, DecisionDiff, TextDiff, JsonPatch } from '@hilt-review/shared';

export class DiffService {
  /**
   * Calculate diff between original and working blocks
   */
  calculateDiff(original: ArtifactBlock[], working: ArtifactBlock[]): DecisionDiff {
    const textDiffs: TextDiff[] = [];
    const jsonPatches: JsonPatch[] = [];

    for (const origBlock of original) {
      const workBlock = working.find(b => b.id === origBlock.id);

      if (!workBlock) {
        continue; // Block was removed - could track this separately
      }

      if (origBlock.type === 'json') {
        // JSON diff
        const origContent = typeof origBlock.content === 'string'
          ? JSON.parse(origBlock.content)
          : origBlock.content;
        const workContent = typeof workBlock.content === 'string'
          ? JSON.parse(workBlock.content)
          : workBlock.content;

        const patch = jsonPatch.compare(origContent, workContent);

        // Filter out internal _get operations and map to our type
        const validOps = patch.filter(op => op.op !== '_get');

        if (validOps.length > 0) {
          jsonPatches.push({
            block_id: origBlock.id,
            patch: validOps.map(op => ({
              op: op.op as 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test',
              path: op.path,
              from: 'from' in op ? op.from : undefined,
              value: 'value' in op ? op.value : undefined,
            })),
          });
        }
      } else {
        // Text diff (plaintext or markdown)
        const origText = typeof origBlock.content === 'string'
          ? origBlock.content
          : JSON.stringify(origBlock.content);
        const workText = typeof workBlock.content === 'string'
          ? workBlock.content
          : JSON.stringify(workBlock.content);

        if (origText !== workText) {
          const unified = createTwoFilesPatch(
            `${origBlock.id}.original`,
            `${origBlock.id}.modified`,
            origText,
            workText,
            undefined,
            undefined,
            { context: 3 }
          );

          textDiffs.push({
            block_id: origBlock.id,
            unified_diff: unified,
          });
        }
      }
    }

    return {
      text_diffs: textDiffs.length > 0 ? textDiffs : undefined,
      json_patches: jsonPatches.length > 0 ? jsonPatches : undefined,
    };
  }

  /**
   * Check if there are any differences
   */
  hasDifferences(diff: DecisionDiff): boolean {
    return (diff.text_diffs?.length ?? 0) > 0 || (diff.json_patches?.length ?? 0) > 0;
  }
}

export const diffService = new DiffService();
