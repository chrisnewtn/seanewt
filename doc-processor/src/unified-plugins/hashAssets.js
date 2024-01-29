import path from 'node:path';
import {selectAll} from 'hast-util-select';
import {shasum} from '../util.js';

const selectors = new Set([
  'link[rel=stylesheet]',
  'img',
  'picture>source'
]);

const tagNameToProp = new Map([
  ['link', 'href'],
  ['img', 'src'],
  ['source', 'srcSet']
]);

const selection = Array.from(selectors).join(',');

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
    for (const el of selectAll(selection, tree)) {
      const propName = tagNameToProp.get(el.tagName);

      if (!propName) {
        throw new Error(`No prop found to overwrite for "${el.tagName}"`);
      }

      const href = el.properties[propName];

      if (href.startsWith('http')) {
        // It's an external asset. Ignore it.
        continue;
      }

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

      el.properties[propName] = `${newName}${searchString ? `?${searchString}` : ''}`;
    }
  };
}
