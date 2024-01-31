import path from 'node:path';
import {shasum} from '../util.js';
import {selectAllAssetElements} from './shared.js';

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
    for (const {el, assetProp} of selectAllAssetElements(tree)) {
      const href = el.properties[assetProp];
      const [pathPart, searchString] = href.split('?');
      const pathToAsset = path.resolve(pathToDir, pathPart);
      let newName;

      // If the file has already been hashed, no need to repeat the work.
      if (assets.has(pathToAsset)) {
        newName = path.relative(outputDir, assets.get(pathToAsset));
      } else {
        const hash = await shasum(pathToAsset);

        const extname = path.extname(pathPart);
        const dirname = path.dirname(pathPart);
        const basename = path.basename(pathPart, extname);

        newName = path.posix.join(
          dirname,
          `${basename}-${hash.substring(0, 7)}${extname}`
        );

        assets.set(pathToAsset, path.resolve(outputDir, newName));
      }

      el.properties[assetProp] = `${newName}${searchString ? `?${searchString}` : ''}`;
    }
  };
}
