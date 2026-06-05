import collatePosts from '../page-scripts/collatePosts.js';

const fileToScript = new Map([
  ['pages/posts/index.html', collatePosts]
]);

/**
 * @typedef {Object} ApplyPageScriptOptions
 * @property {string} pathToFile
 * @property {import('../util.js').FileCache} fileCache
 */

/**
 * @type {import('unified').Plugin<[ApplyPageScriptOptions], import('hast').Root>}
 */
export default function applyPageScript({
  pathToFile,
  fileCache
}) {
  return async tree => {
    if (fileToScript.has(pathToFile)) {
      await fileToScript.get(pathToFile)({
        pathToFile,
        fileCache,
        tree
      });
    }
  };
}
