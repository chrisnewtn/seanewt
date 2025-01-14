import {selectAll} from 'hast-util-select';

/**
 * @param {import('hast').Element} timeEl
 * @param {string} date
 */
export function applyDateToTime(timeEl, date) {
  timeEl.properties.datetime = date;
  timeEl.children.push({
    type: 'text',
    value: new Date(date).toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  });
}

/**
 *
 * @param {import('hast').Element} elementToRemove
 * @param {import('hast').Element} tree
 */
export function removeElement(elementToRemove, tree) {
  for (const element of tree.children) {
    if (element === elementToRemove) {
      tree.children.splice(
        tree.children.indexOf(element),
        1
      );
      return true;
    }
    if (Array.isArray(element.children) && element.children.length > 0) {
      if (removeElement(elementToRemove, element)) {
        return true;
      }
    }
  }
  return false;
}

const assetSelectors = new Set([
  'link[rel=stylesheet]',
  'link[rel=icon]',
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
