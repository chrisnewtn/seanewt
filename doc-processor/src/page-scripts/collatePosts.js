import fs from 'node:fs/promises';
import path from 'node:path';
import {unified} from 'unified';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';
import parseYamlFrontmatter from '../unified-plugins/parseYamlFrontmatter.js';
import {select} from 'hast-util-select';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import {VFile} from 'vfile';
import {h} from 'hastscript';

function byMostRecentFirst({datePublished: a}, {datePublished: b}) {
  return b - a;
}

async function parsePostText(text) {
  const data = {};

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(parseYamlFrontmatter)
    .use(() => (tree, vFile) => {
      Object.assign(data, vFile.data.matter);
    })
    .use(remarkGfm)
    .use(remarkRehype);

  const tree = await processor.run(processor.parse(text), new VFile(text));

  return {tree, data};
}

/**
 *
 * @param {import('hast').Element} elementToRemove
 * @param {import('hast').Element} tree
 */
function removeElement(elementToRemove, tree) {
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

/**
 * Collates all the posts in the posts directory and renders the heading and
 * first paragraph of each one, along with a link to the full version.
 * @param {object} options
 * @param {string} options.pathToFile
 * @param {import('../util.js').FileCache} options.fileCache
 * @param {import('hast').Root} options.tree
 */
export default async function collatePosts({pathToFile, fileCache, tree}) {
  const pathToPosts = path.dirname(pathToFile);
  const baseTemplate = select('template#post-snippet', tree);
  const postsContainer = select('.posts', tree);

  if (!baseTemplate) {
    throw new Error(`Unable to find template#post-snippet in ${pathToFile}`);
  }
  if (!postsContainer) {
    throw new Error(`Unable to find .posts in ${pathToFile}`);
  }

  const articleTemplate = select('article', baseTemplate.content);

  removeElement(baseTemplate, tree);

  const snippets = [];

  for (const postFile of await fs.readdir(pathToPosts, {withFileTypes: true})) {
    if (!postFile.isFile() || !postFile.name.endsWith('.md')) {
      continue;
    }
    const fileText = await fileCache.get(path.join(pathToPosts, postFile.name));
    const post = await parsePostText(fileText);
    const datePublished = new Date(post.data['date-published']);

    const postContainer = structuredClone(articleTemplate);

    const timeEl = select('.date-published time', postContainer);

    timeEl.properties.datetime = post.data['date-published'];
    timeEl.children.push({
      type: 'text',
      value: datePublished.toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    });

    postContainer.children.push(
      select('h1', post.tree),
      select('p', post.tree),
      // TODO: shouldn't this link be defined in the template?
      h('p', [
        h('a', {href: postFile.name.replace('.md', '.html')}, 'Read full post')
      ])
    );

    snippets.push({datePublished, tree: postContainer});
  }

  postsContainer.children.push(
    ...snippets.sort(byMostRecentFirst).map(({tree}) => tree)
  );
}
