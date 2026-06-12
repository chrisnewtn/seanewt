import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { select, selectAll } from 'hast-util-select';
import { toText } from 'hast-util-to-text';

const __dirname = import.meta.dirname;
const pathToOutput = path.join(__dirname, 'output');

/**
 * @typedef {typeof filesToTest} TF
 */
/**
 * @typedef {TF[0] | TF[1] | TF[2] | TF[3]} TestFile
 */

const filesToTest = Object.freeze(/** @type {const} */ ([
  'index.html',
  'posts/index.html',
  'posts/2026-06-11-example.html',
  'posts/2026-06-12-other.html',
]));

const exec = promisify(childProcess.exec);

/** @type Map<string, import("hast").Root> */
const fileCache = new Map();

const titles = /** @type {const} */ Object.freeze({
  'index.html': 'Some Guy',
  'posts/index.html': 'Posts',
  'posts/2026-06-11-example.html': 'Example',
  'posts/2026-06-12-other.html': 'Other post',
});

const descriptions = /** @type {const} */ Object.freeze({
  'index.html': 'The personal website of Some Guy.',
  'posts/index.html': 'These are my posts.',
  'posts/2026-06-11-example.html': 'Post description',
  'posts/2026-06-12-other.html': 'Other post description',
});

const emojis = /** @type {const} */ Object.freeze({
  'posts/2026-06-11-example.html': '📝',
  'posts/2026-06-12-other.html': '🐧',
});

const createdDates = /** @type {const} */ Object.freeze({
  'posts/2026-06-11-example.html': {
    datetime: '2026-06-11',
    text: 'Thursday, 11 June 2026'
  },
  'posts/2026-06-12-other.html': {
    datetime: '2026-06-12',
    text: 'Friday, 12 June 2026'
  },
});

const updatedDates = /** @type {const} */ Object.freeze({
  'posts/2026-06-12-other.html': {
    datetime: '2026-06-13',
    text: 'Saturday, 13 June 2026'
  },
});

/** @param {TestFile} file */
async function parseDoc(file) {
  if (fileCache.has(file)) {
    return fileCache.get(file);
  }
  const text = await readFile(path.join(pathToOutput, file), 'utf8');
  const tree = unified().use(rehypeParse).parse(text);
  fileCache.set(file, tree);
  return tree;
}

describe('end-to-end', () => {
  before(async () => {
    await exec('node ../cli.js -i fixture -o output', {
      cwd: __dirname,
      env: {
        GITHUB_SHA: 'c563c43109733cd71e65ac2b0735a88a6e0a89e3'
      }
    });
  });

  after(async () => {
    await rm(pathToOutput, {recursive: true, force: true});
  });

  it('ensures the output directory', async () => {
    await stat(pathToOutput);
  });

  filesToTest.forEach(file => describe(file, () => {
    it('writes the file to disk', async () => {
      await stat(path.join(pathToOutput, file));
    });

    it('overwrites copyright to current year', async () => {
      const tree = await parseDoc(file);
      const node = select('#copyright-date', tree);

      assert.ok(node);
      assert.equal(toText(node), `2024-${new Date().getUTCFullYear()}`);
    });

    it('creates a link to the github commit', async () => {
      const tree = await parseDoc(file);
      const node = select('#github-sha', tree);

      assert.ok(node);
      assert.equal(node.properties.href, 'https://github.com/chrisnewtn/chrisnewtn.github.io/commit/c563c43109733cd71e65ac2b0735a88a6e0a89e3');
      assert.equal(toText(node), 'c563c43');
    });

    it('links to the hashed stylesheet', async () => {
      const tree = await parseDoc(file);
      const node = select('[rel=stylesheet]', tree);

      assert.ok(node);
      assert.ok(typeof node.properties.href === 'string');
      assert.match(node.properties.href, /style-feaf30c.css$/);
    });

    it('uses a hashed svg as the page icon', async () => {
      const tree = await parseDoc(file);
      const node = select('[rel=icon]', tree);

      assert.ok(node);
      assert.ok(typeof node.properties.href === 'string');
      assert.match(node.properties.href, /newt-6b756e5.svg$/);
    });

    it('updates img[src] to refer to hashed asset', async () => {
      const tree = await parseDoc(file);
      const node = select('a[href*="github.com"] > picture > img', tree);

      assert.ok(node);
      assert.ok(typeof node.properties.src === 'string');
      assert.match(node.properties.src, /github-mark-7a0dd11.svg$/);
    });

    it('updates source[srcset] to refer to hashed asset', async () => {
      const tree = await parseDoc(file);
      const node = select('a[href*="github.com"] > picture > source', tree);

      assert.ok(node);
      assert.ok(typeof node.properties.srcSet === 'string');
      assert.match(node.properties.srcSet, /github-mark-white-fab00c2.svg$/);
    });

    it('sets the page title', async () => {
      const tree = await parseDoc(file);
      const node = select('title', tree);

      assert.ok(node);
      assert.equal(toText(node), titles[file]);
    });

    it('sets the page description', async () => {
      const tree = await parseDoc(file);
      const node = select('meta[name=description]', tree);

      assert.ok(node);
      assert.ok(typeof node.properties.content === 'string');
      assert.equal(node.properties.content, descriptions[file]);
    });

    if (file === 'posts/index.html') {
      it('lists all published posts', async () => {
        const tree = await parseDoc(file);
        const nodes = selectAll('article.snippet', tree);

        assert.ok(nodes);
        assert.equal(nodes.length, 2, 'Expected 2 posts');
      });

      it('lists posts ordered by most recent first', async () => {
        const tree = await parseDoc(file);
        const nodes = selectAll('article.snippet', tree);

        assert.deepEqual(
          [
            select('time', nodes[0]).properties.dateTime,
            select('time', nodes[1]).properties.dateTime,
          ],
          [
            '2026-06-12',
            '2026-06-11',
          ]
        );
      });

      it('writes the heading of each post', async () => {
        const tree = await parseDoc(file);
        const nodes = selectAll('article.snippet', tree);

        assert.deepEqual(
          [
            toText(select('h1', nodes[0])),
            toText(select('h1', nodes[1])),
          ],
          [
            'Other post',
            'Example',
          ],
        );
      });

      it('writes only the first paragraph of each post', async () => {
        const tree = await parseDoc(file);
        const nodes = selectAll('article.snippet', tree);

        const post1Paras = selectAll('p', nodes[0]);
        const post2Paras = selectAll('p', nodes[1]);

        assert.equal(post1Paras.length + post2Paras.length, 6);

        assert.equal(toText(post1Paras[1]), 'Here\'s another post!');
        assert.equal(toText(post2Paras[1]), 'So, I figure I\'m going to start posting to this website. Why not.');
      });

      it('renders a "Read full post" link', async () => {
        const tree = await parseDoc(file);
        const nodes = selectAll('article.snippet', tree);

        const post1Link = select('a', nodes[0]);
        const post2Link = select('a', nodes[1]);

        assert.equal(toText(post1Link), 'Read full post');
        assert.equal(toText(post2Link), 'Read full post');
        assert.equal(post1Link.properties.href, '2026-06-12-other.html');
        assert.equal(post2Link.properties.href, '2026-06-11-example.html');
      });
    }

    if (emojis[file]) {
      it('sets the post\'s emoji on article[data-emoji]', async () => {
        const tree = await parseDoc(file);
        const node = select('article[data-emoji]', tree);

        assert.ok(node);
        assert.ok(typeof node.properties.dataEmoji === 'string');
        assert.equal(node.properties.dataEmoji, emojis[file]);
      });
    }

    if (createdDates[file]) {
      it('sets the post\'s published date', async () => {
        const tree = await parseDoc(file);
        const node = select('.dt-published', tree);

        assert.ok(node);
        assert.ok(typeof node.properties.dateTime === 'string');
        assert.equal(node.properties.dateTime, createdDates[file].datetime);
        assert.equal(toText(node), createdDates[file].text);
      });
    }

    if (updatedDates[file]) {
      it('sets the post\'s updated date', async () => {
        const tree = await parseDoc(file);
        const node = select('.dt-updated', tree);

        assert.ok(node);
        assert.ok(typeof node.properties.dateTime === 'string');
        assert.equal(node.properties.dateTime, updatedDates[file].datetime);
        assert.equal(toText(node), updatedDates[file].text);
      });
    }
  }));
});
