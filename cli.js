#!/usr/bin/env node

import {minimatch} from 'minimatch';
import fs from 'node:fs/promises';
import {createReadStream, createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {parseArgs} from 'node:util';
import {processDocument} from './index.js';
import path from 'node:path';
import {FileCache, ensureDirectory} from './src/util.js';
import {tryGetConfig} from './src/configParser.js';

const {
  values: {
    'input-dir': inputDir,
    'output-dir': outputDir,
    'skip-image-optimization': skipImageOptimization
  }
} = parseArgs({
  options: {
    'input-dir': {
      type: 'string',
      short: 'i',
    },
    'output-dir': {
      type: 'string',
      short: 'o',
    },
    'skip-image-optimization': {
      type: 'boolean',
      short: 's',
      default: false
    }
  }
});

if (typeof inputDir !== 'string') {
  throw new Error('input-dir is required');
}
if (typeof outputDir !== 'string') {
  throw new Error('input-dir is required');
}

const config = await tryGetConfig(inputDir);

const processable = new Set(['.html', '.md']);
const isTemplate = name => name.endsWith('.template.html');

const fileCache = new FileCache();
const assets = new Map();
const writtenAssets = new Set();

/**
 * @typedef {{
 *  inputDir: string
 *  rootInputDir: string
 *  outputDir: string
 *  config: import('./src/configParser.js').Config
 * }} DirProcessingConfig
 */

/**
 * @typedef {{
 *  inputFile: import('node:fs').Dirent<string>
 * } & DirProcessingConfig} ProcessingOptions
 */

/**
 * @param {ProcessingOptions} options
 */
async function processFile({
  inputDir,
  rootInputDir,
  inputFile,
  outputDir,
  config,
}) {
  const ext = path.extname(inputFile.name);

  const pathToInput = path.join(inputDir, inputFile.name);
  const pathToOutputDir = path.join(outputDir, path.relative(rootInputDir, inputDir));

  console.log('processing', pathToInput);
  const fileContents = await fileCache.get(pathToInput);

  const vFile = await processDocument({
    rootInputDir,
    inputFile: {
      name: pathToInput,
      text: fileContents
    },
    assets,
    skipImageOptimization,
    fileCache,
    writtenAssets,
    outputDir: pathToOutputDir,
    config,
  });

  await ensureDirectory(pathToOutputDir);

  for (const [pathToOldAsset, pathToNewAsset] of assets) {
    if (writtenAssets.has(pathToNewAsset)) {
      continue;
    }

    await ensureDirectory(path.dirname(pathToNewAsset));

    console.log('write', pathToNewAsset);

    await pipeline(
      createReadStream(pathToOldAsset),
      createWriteStream(pathToNewAsset)
    );

    writtenAssets.add(pathToNewAsset);
  }

  const outputName = `${path.basename(inputFile.name, ext)}.html`;
  const pathToOutput = path.join(pathToOutputDir, outputName);

  console.log('write', pathToOutput);
  await fs.writeFile(pathToOutput, String(vFile), 'utf8');
}

const toCopy = [
  '**/*.ttf',
  'static/**/*.js',
  'CNAME',
  'favicon.io',
];

/**
 * @param {ProcessingOptions} options
 */
async function copyFile({inputDir, rootInputDir, inputFile, outputDir}) {
  const pathToInput = path.join(inputDir, inputFile.name);
  const relativeToInput = path.relative(rootInputDir, pathToInput);

  const copyable = toCopy.some(glob => minimatch(relativeToInput, glob));

  if (!copyable) {
    return;
  }

  const pathToOutputDir = path.join(outputDir, path.relative(rootInputDir, inputDir));

  await ensureDirectory(pathToOutputDir);

  const pathToOutput = path.join(pathToOutputDir, inputFile.name);

  console.log('copy', pathToOutput);
  await fs.copyFile(pathToInput, pathToOutput);
}

/**
 * @param {DirProcessingConfig} options
 */
async function processDirectory({
  inputDir,
  rootInputDir,
  outputDir,
  config,
}) {
  for (const inputFile of await fs.readdir(inputDir, {withFileTypes: true})) {
    if (inputFile.isDirectory()) {
      await processDirectory({
        inputDir: path.join(inputDir, inputFile.name),
        rootInputDir,
        outputDir,
        config,
      });
      continue;
    }

    const ext = path.extname(inputFile.name);

    if (processable.has(ext) && !isTemplate(inputFile.name)) {
      await processFile({
        inputDir,
        inputFile,
        rootInputDir,
        outputDir,
        config,
      });
    } else {
      await copyFile({
        inputDir,
        inputFile,
        rootInputDir,
        outputDir,
        config,
      });
    }
  }
}

await processDirectory({
  inputDir,
  rootInputDir: inputDir,
  outputDir,
  config,
});
