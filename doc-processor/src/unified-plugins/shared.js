import {selectAll} from 'hast-util-select';

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

function onlyIncludeLocalAssets(memo, el) {
  const assetProp = tagNameToProp.get(el.tagName);

  if (!assetProp) {
    throw new Error(`No prop found to overwrite for "${el.tagName}"`);
  }

  const href = el.properties[assetProp];

  if (!href || href.startsWith('http')) {
    // Empty value or it's an external asset. Ignore it.
    return memo;
  }

  return memo.concat({el, assetProp});
}

export function selectAllAssetElements(tree) {
  return selectAll(selection, tree).reduce(onlyIncludeLocalAssets, []);
}
