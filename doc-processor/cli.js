import fs from 'node:fs/promises';
import {createReadStream, createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {parseArgs} from 'node:util';
import {processDocument} from './index.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  values: {
    'input-dir': inputDir,
    'output-dir': outputDir
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
    }
  }
});

const writtenAssets = new Set();

for (const inputFile of await fs.readdir(inputDir, {withFileTypes: true})) {
  if (inputFile.isDirectory() || !inputFile.name.endsWith('.html')) {
    continue;
  }
  const pathToInput = path.join(inputDir, inputFile.name);
  const fileContents = await fs.readFile(pathToInput, 'utf8');

  const {vFile, assets} = await processDocument({
    inputFile: {
      name: pathToInput,
      text: fileContents
    },
    outputDir
  });

  for (const [pathToNewAsset, pathToOldAsset] of assets) {
    if (writtenAssets.has(pathToNewAsset)) {
      continue;
    }

    await pipeline(
      createReadStream(pathToOldAsset),
      createWriteStream(pathToNewAsset)
    );

    console.log('write', pathToNewAsset);

    writtenAssets.add(pathToNewAsset);
  }

  const pathToOutput = path.join(outputDir, inputFile.name);

  await fs.writeFile(pathToOutput, String(vFile), 'utf8');

  console.log('write', pathToOutput);
}
