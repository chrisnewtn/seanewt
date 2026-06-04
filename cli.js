import {minimatch} from 'minimatch';
import fs from 'node:fs/promises';
import {createReadStream, createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {parseArgs} from 'node:util';
import {processDocument} from './index.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {FileCache, ensureDirectory} from './src/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      default: path.resolve(__dirname, '..', '..', 'pages')
    },
    'output-dir': {
      type: 'string',
      short: 'o',
      default: path.resolve(__dirname, '..', '..', 'public')
    },
    'skip-image-optimization': {
      type: 'boolean',
      short: 's',
      default: false
    }
  }
});

const processable = new Set(['.html', '.md']);
const isTemplate = name => name.endsWith('.template.html');

const fileCache = new FileCache();
const assets = new Map();
const writtenAssets = new Set();

/**
 * @param {string} pathToDir
 * @param {Dirent} inputFile
 */
async function processFile(pathToDir, inputFile) {
  const ext = path.extname(inputFile.name);

  const pathToInput = path.join(pathToDir, inputFile.name);
  const pathToOutputDir = path.join(outputDir, path.relative(inputDir, pathToDir));

  console.log('processing', pathToInput);
  const fileContents = await fileCache.get(pathToInput);

  const vFile = await processDocument({
    inputFile: {
      name: pathToInput,
      text: fileContents
    },
    assets,
    skipImageOptimization,
    fileCache,
    writtenAssets,
    outputDir: pathToOutputDir
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
 * @param {string} pathToDir
 * @param {Dirent} inputFile
 */
async function copyFile(pathToDir, inputFile) {
  const pathToInput = path.join(pathToDir, inputFile.name);
  const relativeToInput = path.relative(inputDir, pathToInput);

  const copyable = toCopy.some(glob => minimatch(relativeToInput, glob));

  if (!copyable) {
    return;
  }

  const pathToOutputDir = path.join(outputDir, path.relative(inputDir, pathToDir));

  await ensureDirectory(pathToOutputDir);

  const pathToOutput = path.join(pathToOutputDir, inputFile.name);

  console.log('copy', pathToOutput);
  await fs.copyFile(pathToInput, pathToOutput);
}

async function processDirectory(pathToDir) {
  for (const inputFile of await fs.readdir(pathToDir, {withFileTypes: true})) {
    if (inputFile.isDirectory()) {
      await processDirectory(path.join(pathToDir, inputFile.name));
      continue;
    }

    const ext = path.extname(inputFile.name);

    if (processable.has(ext) && !isTemplate(inputFile.name)) {
      await processFile(pathToDir, inputFile);
    } else {
      await copyFile(pathToDir, inputFile);
    }
  }
}

await processDirectory(inputDir);
