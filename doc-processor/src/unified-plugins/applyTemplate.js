import path from 'node:path';
import fs from 'node:fs/promises';
import {select} from 'hast-util-select';
import {unified} from 'unified';
import rehypeParse from 'rehype-parse';
import {selectAllAssetElements} from './shared.js';
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
    for (const {el, assetProp} of selectAllAssetElements(tree)) {
      el.properties[assetProp] = path.posix.relative(
        path.posix.dirname(pathToFile),
        path.posix.resolve(
          path.posix.dirname(pathToTemplate),
          el.properties[assetProp]
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
export default function applyTemplate({
  pathToFile
}) {

  return async (tree, file) => {
    const {title, template} = file.data.matter;

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

    const articleEl = select('article', tree);

    children.forEach(el => articleEl.children.push(el));
  };
}
