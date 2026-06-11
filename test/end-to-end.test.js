import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { select } from 'hast-util-select';
import { toText } from 'hast-util-to-text';

const __dirname = import.meta.dirname;
const pathToOutput = path.join(__dirname, 'output');
const pathToPosts = path.join(pathToOutput, 'posts');

const filesToTest = [
  path.join(pathToOutput, 'index.html'),
  path.join(pathToPosts, 'index.html'),
  path.join(pathToPosts, '2026-06-11-example.html'),
];

const exec = promisify(childProcess.exec);

/**
 * @param {string} pathToFile
 */
async function parseDoc(pathToFile) {
  const text = await readFile(pathToFile, 'utf8');
  return unified().use(rehypeParse).parse(text);
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

  filesToTest.forEach(file => describe(path.relative(__dirname, file), () => {
    it("writes the file to disk", async () => {
      await stat(file);
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
  }));
});
