import path from 'node:path';
import {fileURLToPath} from 'node:url';
import collatePosts from '../page-scripts/collatePosts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fileToScript = new Map([
  ['pages/posts/index.html', collatePosts]
]);

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function applyPageScript({
  pathToFile,
  fileCache
}) {
  const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const relativePathToFile = path.relative(projectRoot, pathToFile);

  return async tree => {
    if (fileToScript.has(relativePathToFile)) {
      await fileToScript.get(relativePathToFile)({
        pathToFile,
        fileCache,
        tree
      });
    }
  };
}
