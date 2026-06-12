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
import applyPageTemplate from './src/unified-plugins/applyPageTemplate.js';
import parseYamlFrontmatter from './src/unified-plugins/parseYamlFrontmatter.js';
import applyPageScript from './src/unified-plugins/applyPageScript.js';
import fixInternalLinks from './src/unified-plugins/fixInternalLinks.js';
import applyGitHubSha from './src/unified-plugins/applyGitHubSha.js';
import optimizeImages from './src/unified-plugins/optimizeImages.js';
import {imageTitlesToCaptions} from 'rehype-image-titles-to-captions';
import applyCopyrightDate from './src/unified-plugins/applyCopyrightDate.js';

/**
 * Applies HTML formatting and cache-busts the CSS of a given HTML file.
 * @param {Object} params
 * @param {string} params.rootInputDir
 * @param {Object} params.inputFile
 * @param {string} params.inputFile.name
 * @param {string} params.inputFile.text
 * @param {string} params.outputDir
 * @param {import('./src/util.js').FileCache} params.fileCache
 * @param {Map<string, string>} params.assets
 * @param {boolean} params.skipImageOptimization
 * @param {Set<string>} params.writtenAssets
 * @param {import('./src/configParser.js').Config} params.config
 */
export async function processDocument({
  rootInputDir,
  inputFile,
  outputDir,
  fileCache,
  assets = new Map(),
  skipImageOptimization,
  writtenAssets,
  config,
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
      .use(applyPageTemplate, {
        pathToFile: inputFile.name,
      });
  }

  return await processor
    .use(applyPageScript, {
      pathToFile: inputFile.name,
      rootInputDir,
      fileCache
    })
    .use(fixInternalLinks)
    .use(optimizeImages, {
      skip: skipImageOptimization,
      pathToFile: inputFile.name,
      outputDir,
      assets,
      writtenAssets
    })
    .use(imageTitlesToCaptions, {
      pictureSelector: 'article picture:has(img[title])'
    })
    .use(hashAssets, {
      pathToFile: inputFile.name,
      outputDir,
      assets
    })
    .use(applyCopyrightDate, {
      startYear: config.copyrightStart,
    })
    .use(applyGitHubSha)
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
