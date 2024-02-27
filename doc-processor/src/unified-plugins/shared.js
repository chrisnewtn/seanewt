import {selectAll} from 'hast-util-select';

const assetSelectors = new Set([
  'link[rel=stylesheet]',
  'img',
  'picture>source',
  'script[src]'
]);

const tagNameToProp = new Map([
  ['a', 'href'],
  ['link', 'href'],
  ['img', 'src'],
  ['source', 'srcSet'],
  ['script', 'src']
]);

const elementsWithLinks = new Set([
  ...assetSelectors,
  'a'
]);

const assetSelection = Array.from(assetSelectors).join(',');
const linkSelection = Array.from(elementsWithLinks).join(',');

function onlyIncludeLocalLinks(memo, el) {
  const linkProp = tagNameToProp.get(el.tagName);

  if (!linkProp) {
    throw new Error(`No prop found to overwrite for "${el.tagName}"`);
  }

  const href = el.properties[linkProp];

  if (!href || href.startsWith('http')) {
    // Empty value or it's an external asset. Ignore it.
    return memo;
  }

  return memo.concat({el, linkProp});
}

export function selectAllAssetElements(tree) {
  return selectAll(assetSelection, tree).reduce(onlyIncludeLocalLinks, []);
}

export function selectAllLinkedElements(tree) {
  return selectAll(linkSelection, tree).reduce(onlyIncludeLocalLinks, []);
}
