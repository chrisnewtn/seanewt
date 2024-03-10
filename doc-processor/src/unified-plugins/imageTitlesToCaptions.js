import {select, selectAll} from 'hast-util-select';
import {h} from 'hastscript';
import {selectParent} from './shared.js';

/**
 * A plugin that takes image titles and turns them into figcaptions.
 *
 * Markdown only lets you specify a title for an image, not a caption, but they
 * are functionally equivilant.
 *
 * Titles are only visible on mouseover, so rendering a visible caption is more
 * accessible for all users across all devices.
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function imageTitlesToCaptions() {
  return tree => {
    // Select all images with titles in the article.
    for (const pictureEl of selectAll('article picture:has(img[title])', tree)) {
      // Get the picture's img element.
      const imgEl = select('img', pictureEl);
      // Get the image's title property if it has one.
      const title = imgEl?.properties.title;

      // Ignore images with empty title properties.
      if (!title) {
        continue;
      }

      // Create the new figure element and set the title as its figcaption.
      const figureEl = h('figure', [
        pictureEl,
        h('figcaption', title)
      ]);

      const pictureParentEl = selectParent(pictureEl, tree);

      // Replace the picture element in the tree with the new figure element.
      pictureParentEl.children.splice(
        pictureParentEl.children.indexOf(pictureEl),
        1,
        figureEl
      );

      // Delete the title on the image as it is now duplicate data.
      delete imgEl.properties.title;
    }
  };
}
