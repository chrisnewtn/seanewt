import Ajv from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {Object} Config
 * @property {number} [copyrightStart] The year the copyright of the content starts from e.g. 2024
 */

/** @type {Config} */
export const defaultConfig = {
};

/** @type {import('ajv').JSONSchemaType<Config>} */
const configSchema = JSON.parse(await readFile(path.join(
  import.meta.dirname,
  '..',
  'schemas',
  'config-schema.json'
), 'utf8'));

const ajv = new Ajv();
const validate = ajv.compile(configSchema);

/**
 * Returns the {@link Config} object at the given `pathToConfig`.
 * @param {string} pathToConfig
 */
export async function parseConfig(pathToConfig) {
  const configText = await readFile(pathToConfig, 'utf8');
  const config = JSON.parse(configText);

  if (validate(config)) {
    console.log(`config found: ${pathToConfig}`);
    return config;
  } else {
    console.log(`config invalid: ${pathToConfig}`, validate.errors);
    throw validate.errors;
  }
}

/**
 * Tries to find {@link Config} in the given `inputDir`. If no config is found,
 * then the parent directory of `inputDir` is checked too. If still nothing is
 * found, the {@link defaultConfig} object is returned.
 * @param {string} inputDir
 */
export async function tryGetConfig(inputDir) {
  try {
    return await parseConfig(path.join(inputDir, 'seanewt.json'));
  } catch {
    // do nothing
  }
  try {
    return await parseConfig(path.join(inputDir, '..', 'seanewt.json'));
  } catch {
    // do nothing
  }
  return defaultConfig;
}
