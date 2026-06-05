import { selectAll } from 'hast-util-select';

const mdExt = /\.md$/;

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function fixInternalLinks() {
  return async tree => {
    for (const el of selectAll('a[href$=".md"]', tree)) {
      if (typeof el.properties.href !== 'string') {
        continue;
      }
      if (el.properties.href.startsWith('http')) {
        continue;
      }
      el.properties.href = el.properties.href.replace(mdExt, '.html');
    }
  };
}
