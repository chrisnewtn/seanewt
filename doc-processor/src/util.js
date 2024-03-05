import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export function toHashedFilename(pathToFile, hash, newExt = '') {
  const extname = path.extname(pathToFile);
  const dirname = path.dirname(pathToFile);
  const basename = path.basename(pathToFile, extname);

  return path.posix.join(
    dirname,
    `${basename}-${hash.substring(0, 7)}${newExt || extname}`
  );
}

/**
* Returns the sha256sum of the given file.
* @param {string} pathToFile
*/
export async function shasum(pathToFile) {
  const hash = createHash('sha256');

  for await (const chunk of createReadStream(pathToFile)) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

/**
 * Creates the given directory if it does not already exist.
 * @param {string} pathToDirectory
 */
export async function ensureDirectory(pathToDirectory) {
  try {
    await fs.stat(pathToDirectory);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    console.log('mkdir', pathToDirectory);
    await fs.mkdir(pathToDirectory, {recursive: true});
  }
}

export class FileCache extends Map {
  async get(key) {
    if (super.has(key)) {
      return super.get(key);
    }
    const text = await fs.readFile(key, 'utf8');
    super.set(key, text);
    return text;
  }
}
