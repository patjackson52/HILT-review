import { describe, it, expect } from 'vitest';
import { diffService } from '../../src/services/diff.service.js';
import type { ArtifactBlock } from '@hilt-review/shared';

describe('DiffService', () => {
  describe('calculateDiff', () => {
    it('should return empty diff for identical blocks', () => {
      const blocks: ArtifactBlock[] = [
        { id: 'b1', type: 'plaintext', content: 'Hello', editable: true },
      ];

      const diff = diffService.calculateDiff(blocks, blocks);

      expect(diff.text_diffs).toBeUndefined();
      expect(diff.json_patches).toBeUndefined();
    });

    it('should detect text changes in plaintext blocks', () => {
      const original: ArtifactBlock[] = [
        { id: 'b1', type: 'plaintext', content: 'Hello World', editable: true },
      ];
      const working: ArtifactBlock[] = [
        { id: 'b1', type: 'plaintext', content: 'Hello Universe', editable: true },
      ];

      const diff = diffService.calculateDiff(original, working);

      expect(diff.text_diffs).toHaveLength(1);
      expect(diff.text_diffs![0].block_id).toBe('b1');
      expect(diff.text_diffs![0].unified_diff).toContain('-Hello World');
      expect(diff.text_diffs![0].unified_diff).toContain('+Hello Universe');
    });

    it('should detect changes in markdown blocks', () => {
      const original: ArtifactBlock[] = [
        { id: 'b1', type: 'markdown', content: '# Title\n\nOld content', editable: true },
      ];
      const working: ArtifactBlock[] = [
        { id: 'b1', type: 'markdown', content: '# Title\n\nNew content', editable: true },
      ];

      const diff = diffService.calculateDiff(original, working);

      expect(diff.text_diffs).toHaveLength(1);
      expect(diff.text_diffs![0].unified_diff).toContain('-Old content');
      expect(diff.text_diffs![0].unified_diff).toContain('+New content');
    });

    it('should detect JSON patches in json blocks', () => {
      const original: ArtifactBlock[] = [
        { id: 'b1', type: 'json', content: { name: 'Alice', age: 30 }, editable: true },
      ];
      const working: ArtifactBlock[] = [
        { id: 'b1', type: 'json', content: { name: 'Alice', age: 31 }, editable: true },
      ];

      const diff = diffService.calculateDiff(original, working);

      expect(diff.json_patches).toHaveLength(1);
      expect(diff.json_patches![0].block_id).toBe('b1');
      expect(diff.json_patches![0].patch).toEqual([
        { op: 'replace', path: '/age', value: 31 },
      ]);
    });

    it('should handle multiple blocks with mixed changes', () => {
      const original: ArtifactBlock[] = [
        { id: 'b1', type: 'plaintext', content: 'unchanged', editable: true },
        { id: 'b2', type: 'plaintext', content: 'will change', editable: true },
        { id: 'b3', type: 'json', content: { x: 1 }, editable: true },
      ];
      const working: ArtifactBlock[] = [
        { id: 'b1', type: 'plaintext', content: 'unchanged', editable: true },
        { id: 'b2', type: 'plaintext', content: 'has changed', editable: true },
        { id: 'b3', type: 'json', content: { x: 2 }, editable: true },
      ];

      const diff = diffService.calculateDiff(original, working);

      expect(diff.text_diffs).toHaveLength(1); // Only b2 changed
      expect(diff.json_patches).toHaveLength(1); // Only b3 changed
    });
  });

  describe('hasDifferences', () => {
    it('should return false for empty diff', () => {
      expect(diffService.hasDifferences({})).toBe(false);
      expect(diffService.hasDifferences({ text_diffs: [], json_patches: [] })).toBe(false);
    });

    it('should return true when text diffs exist', () => {
      expect(diffService.hasDifferences({
        text_diffs: [{ block_id: 'b1', unified_diff: '...' }],
      })).toBe(true);
    });

    it('should return true when json patches exist', () => {
      expect(diffService.hasDifferences({
        json_patches: [{ block_id: 'b1', patch: [{ op: 'replace', path: '/x', value: 1 }] }],
      })).toBe(true);
    });
  });
});
