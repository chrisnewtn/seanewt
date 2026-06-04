import path from 'node:path';
import {shasum, toHashedFilename} from '../util.js';
import {selectAllAssetElements} from './shared.js';

const hashPattern = /-[a-z|\d]{7}\.[\w]{3,4}$/;

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function hashCss({
  pathToFile,
  outputDir,
  assets
}) {
  const pathToDir = path.dirname(pathToFile);

  return async tree => {
    for (const {el, linkProp} of selectAllAssetElements(tree)) {
      const href = el.properties[linkProp];
      const [pathPart, searchString] = href.split('?');

      // It's already hashed. skip it.
      if (hashPattern.test(pathPart)) {
        continue;
      }

      const pathToAsset = path.resolve(pathToDir, pathPart);
      let newName;

      // The file has been hashed, but not updated in the DOM yet.
      // Update the DOM, but don't bother rehashing the file.
      if (assets.has(pathToAsset)) {
        newName = path.relative(outputDir, assets.get(pathToAsset));
      } else {
        const hash = await shasum(pathToAsset);
        newName = toHashedFilename(pathPart, hash);
        assets.set(pathToAsset, path.resolve(outputDir, newName));
      }

      el.properties[linkProp] = `${newName}${searchString ? `?${searchString}` : ''}`;
    }
  };
}
