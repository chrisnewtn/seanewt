import {select} from 'hast-util-select';

/**
 * @typedef {Object} ApplyCopyrightDateOptions
 * @property {string} startYear
 */

/**
 * @type {import('unified').Plugin<[ApplyCopyrightDateOptions], import('hast').Root>}
 */
export default function applyCopyrightDate({startYear}) {
  return async tree => {
    const el = select('#copyright-date', tree);

    if (!el || !startYear) {
      return;
    }

    el.children = [
      {
        type: 'text',
        value: `${startYear}-${new Date().getUTCFullYear()}`
      }
    ];
  };
}
