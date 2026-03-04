import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import { resolveShortcode } from './emoji-data';

export function remarkEmoji() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
      // Skip if parent is code or inlineCode
      if (parent && (parent.type === 'code' || parent.type === 'inlineCode')) return;

      const regex = /:([a-z0-9_+-]+):/g;
      let match;
      let lastIndex = 0;
      const newNodes: Text[] = [];

      while ((match = regex.exec(node.value)) !== null) {
        const emoji = resolveShortcode(match[1]);
        if (emoji) {
          // Add text before the match
          if (match.index > lastIndex) {
            newNodes.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
          }
          // Add the emoji
          newNodes.push({ type: 'text', value: emoji });
          lastIndex = regex.lastIndex;
        }
      }

      if (newNodes.length > 0) {
        // Add remaining text
        if (lastIndex < node.value.length) {
          newNodes.push({ type: 'text', value: node.value.slice(lastIndex) });
        }
        // Replace the node with the new nodes
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1, ...newNodes);
        }
      }
    });
  };
}
