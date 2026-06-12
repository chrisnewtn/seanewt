import {selectAll} from 'hast-util-select';

/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('hast').Text} Text
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Parent} Parent
 */

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
 * @param {unknown} node The node to test.
 * @returns {node is Node}
 */
function isNode(node) {
  return typeof node === 'object'
    && node !== null
    && Object.hasOwn(node, 'type');
}

/**
 * Returns `true` if the passed `node` is an {@link Parent}.
 * @param {unknown} node The node to test.
 * @returns {node is Parent}
 */
export function isParent(node) {
  /**
   * @type {any} We have to really mess about here to be allowed to test the
   * `children` property.
   */
  const withChildren = isNode(node)
    && Object.hasOwn(node, 'children')
    && node;
  return withChildren
    && Array.isArray(withChildren.children);
}

/**
 * Returns `true` if the passed `node` is an {@link Element}.
 * @param {Node} node The node to test.
 * @returns {node is Element}
 */
export function isElement(node) {
  return isParent(node) && node.type === 'element';
}

/**
 * Returns `true` if the passed `node` is {@link Text}.
 * @param {Node} node The node to test.
 * @returns {node is Text}
 */
export function isText(node) {
  return isNode(node) && node.type === 'text';
}

/**
 *
 * @param {Element} elementToRemove
 * @param {Parent} tree
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
    if (isElement(element) && element.children.length > 0) {
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
