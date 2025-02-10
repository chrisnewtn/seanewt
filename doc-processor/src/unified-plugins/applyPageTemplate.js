import path from 'node:path';
import fs from 'node:fs/promises';
import {select} from 'hast-util-select';
import {unified} from 'unified';
import rehypeParse from 'rehype-parse';
import {applyDateToTime, removeElement, selectAllLinkedElements} from './shared.js';
import {h} from 'hastscript';

const templateCache = new Map();

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
function correctPaths({
  pathToFile,
  pathToTemplate
}) {
  return tree => {
    for (const {el, linkProp} of selectAllLinkedElements(tree)) {
      el.properties[linkProp] = path.posix.relative(
        path.posix.dirname(pathToFile),
        path.posix.resolve(
          path.posix.dirname(pathToTemplate),
          el.properties[linkProp]
        )
      );
    }
  };
}

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
function applyPageTitle({
  pathToTemplate,
  title
}) {
  return tree => {
    const titleEl = select('title', tree);

    if (titleEl) {
      titleEl.children.push({type: 'text', 'value': title});
    } else {
      const headEl = select('head', tree);

      if (!headEl) {
        throw new Error(`No <head> found in ${pathToTemplate}`);
      }

      headEl.children.push(h('title', [title]));
    }
  };
}

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
function applyPageDescription({
  pathToTemplate,
  description
}) {
  return tree => {
    const descriptionEl = select('meta[name=description]', tree);

    if (!descriptionEl) {
      throw new Error(`meta[name=description] not found in ${pathToTemplate}`);
    }

    descriptionEl.properties.content = description;
  };
}

/**
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function applyPageTemplate({
  pathToFile
}) {

  return async (tree, file) => {
    const {
      title,
      template,
      description,
      'date-published': datePublished,
      'date-updated': dateUpdated
    } = file.data.matter;

    if (!template) {
      throw new Error(`No template specified for "${pathToFile}"`);
    }

    const pathToTemplate = path.resolve(path.dirname(pathToFile), template);

    if (!templateCache.has(pathToTemplate)) {
      templateCache.set(pathToTemplate, await fs.readFile(pathToTemplate, 'utf8'));
    }

    const templateText = templateCache.get(pathToTemplate);
    const processor = unified()
      .use(rehypeParse)
      .use(correctPaths, {pathToFile, pathToTemplate})
      .use(applyPageTitle, {title, pathToTemplate})
      .use(applyPageDescription, {description, pathToTemplate});

    const templateTree = await processor.run(processor.parse(templateText));

    const {children} = tree;

    delete tree.children;
    delete tree.position;

    Object.assign(tree, templateTree);

    // This bit is all obviously very post-specific, but since it's the only
    // use case for now, it's staying here.

    const articleEl = select('article', tree);

    if (file.data.matter.emoji) {
      articleEl.properties['data-emoji'] = file.data.matter.emoji;
    }

    children.forEach(el => articleEl.children.push(el));

    const publishedEl = select('.dt-published', tree);
    applyDateToTime(publishedEl, datePublished);

    if (dateUpdated) {
      const updatedEl = select('.dt-updated', tree);
      applyDateToTime(updatedEl, dateUpdated);
    } else {
      removeElement(select('.updated', tree), tree);
    }
  };
}
