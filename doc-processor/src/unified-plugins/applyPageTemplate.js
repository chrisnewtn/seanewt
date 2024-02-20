import path from 'node:path';
import fs from 'node:fs/promises';
import {select} from 'hast-util-select';
import {unified} from 'unified';
import rehypeParse from 'rehype-parse';
import {selectAllLinkedElements} from './shared.js';
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
export default function applyPageTemplate({
  pathToFile
}) {

  return async (tree, file) => {
    const {title, template, 'date-published': datePublished} = file.data.matter;

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
      .use(applyPageTitle, {title, pathToTemplate});

    const templateTree = await processor.run(processor.parse(templateText));

    const {children} = tree;

    delete tree.children;
    delete tree.position;

    Object.assign(tree, templateTree);

    // This bit is all obviously very post-specific, but since it's the only
    // use case for now, it's staying here.

    const articleEl = select('article', tree);

    children.forEach(el => articleEl.children.push(el));

    const timeEl = select('.date-published time', tree);

    timeEl.properties.datetime = datePublished;
    timeEl.children.push({
      type: 'text',
      value: new Date(datePublished).toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    });
  };
}
