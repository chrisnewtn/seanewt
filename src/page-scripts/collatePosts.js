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
import {applyDateToTime, removeElement} from '../unified-plugins/shared.js';

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

  if (typeof articleTemplate === 'undefined') {
    throw new Error(`No <article> found in base template in ${pathToFile}`);
  }

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

    if (post.data.emoji) {
      postContainer.properties['data-emoji'] = post.data.emoji;
    }

    const timeEl = select('.dt-published', postContainer);

    if (timeEl) {
      applyDateToTime(timeEl, post.data['date-published']);
    }

    /** @type {Array<import('hast').Element>} */
    const postElements = [];

    const postH1 = select('h1', post.tree);
    const postPara = select('p', post.tree);

    if (postH1) {
      postElements.push(postH1);
    }
    if (postPara) {
      postElements.push(postPara);
    }

    postContainer.children.push(
      ...postElements,
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
