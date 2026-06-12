import path from 'node:path';
import collatePosts from '../page-scripts/collatePosts.js';

const fileToScript = new Map([
  ['posts/index.html', collatePosts]
]);

/**
 * @typedef {Object} ApplyPageScriptOptions
 * @property {string} pathToFile
 * @property {string} rootInputDir
 * @property {import('../util.js').FileCache} fileCache
 */

/**
 * @type {import('unified').Plugin<[ApplyPageScriptOptions], import('hast').Root>}
 */
export default function applyPageScript({
  pathToFile,
  rootInputDir,
  fileCache
}) {
  return async tree => {
    const fileToScriptKey = path.relative(rootInputDir, pathToFile);

    const pageScript = fileToScript.get(fileToScriptKey);

    if (typeof pageScript === 'function') {
      await pageScript({
        pathToFile,
        fileCache,
        tree
      });
    }
  };
}
