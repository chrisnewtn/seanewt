import path from 'node:path';
import {unified} from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import hashAssets from './src/unified-plugins/hashAssets.js';
import applyTemplate from './src/unified-plugins/applyTemplate.js';
import parseYamlFrontmatter from './src/unified-plugins/parseYamlFrontmatter.js';

/**
 * Applies HTML formatting and cache-busts the CSS of a given HTML file.
 * @param {Object} params
 * @param {Object} params.inputFile
 * @param {string} params.inputFile.name
 * @param {string} params.inputFile.text
 * @param {string} params.outputDir
 */
export async function processDocument({
  inputFile,
  outputDir,
  assets = new Map()
}) {
  const ext = path.extname(inputFile.name);
  const processor = unified();

  if (ext === '.html') {
    processor.use(rehypeParse, {
      fragment: false
    });
  } else if (ext === '.md') {
    processor
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(parseYamlFrontmatter)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(applyTemplate, {
        pathToFile: inputFile.name,
        outputDir,
        assets
      });
  }

  return await processor
    .use(hashAssets, {
      pathToFile: inputFile.name,
      outputDir,
      assets
    })
    .use(rehypeFormat, {
      indentInitial: false,
    })
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
      characterReferences: {
        useNamedReferences: true
      }
    })
    .process(inputFile.text);
}
