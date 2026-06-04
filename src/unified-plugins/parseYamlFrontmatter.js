import {matter} from 'vfile-matter';

/**
 * @type {import('unified').Plugin<[], import('mdast').Root>}
 */
export default function parseYamlFrontmatter() {
  return async (tree, file) => {
    matter(file);
  };
}
