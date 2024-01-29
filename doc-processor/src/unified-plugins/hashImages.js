import path from 'node:path';
import {selectAll} from 'hast-util-select';
import {shasum} from '../util.js';

const tagNameToProp = {
  img: 'src',
  source: 'srcSet'
};

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function hashImages({
  pathToFile,
  outputDir,
  assets
}) {
  const pathToDir = path.dirname(pathToFile);

  return async tree => {
    for (const el of selectAll('img,picture>source', tree)) {
      const hrefProp = tagNameToProp[el.tagName];
      const href = el.properties[hrefProp];

      if (href.startsWith('http')) {
        // It's an external asset. Ignore it.
        continue;
      }

      const [pathPart, searchString] = href.split('?');
      const pathToAsset = path.resolve(pathToDir, pathPart);

      const hash = await shasum(pathToAsset);

      const extname = path.extname(pathPart);
      const basename = path.basename(pathPart, extname);

      const newName = `${basename}-${hash.substring(0, 7)}${extname}`;

      assets.set(path.join(outputDir, newName), pathToAsset);

      el.properties[hrefProp] = `${newName}${searchString ? `?${searchString}` : ''}`;
    }
  };
}
