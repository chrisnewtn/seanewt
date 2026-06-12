import path from 'node:path';
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import {h} from 'hastscript';
import sharp from 'sharp';
import {selectAll} from 'hast-util-select';
import {findParent} from 'hast-util-find-parent';
import {toHashedFilename} from '../util.js';
import { isParent } from './shared.js';

const mebibyte = 1024 * 1024;

/** @param {number} bytes */
function toMiB(bytes) {
  return `${(bytes / mebibyte).toFixed(4)} MiB`;
}

/**
 * @param {Buffer} buffer
 */
async function getImageInfo(buffer) {
  const {info} = await sharp(buffer).toBuffer({resolveWithObject: true});
  return info;
}

/**
 * @typedef {{id: 'jpeg'} & sharp.JpegOptions} JpegOptions
 * @typedef {{id: 'avif'} & sharp.AvifOptions} AvifOptions
 * @typedef {{id: 'webp'} & sharp.WebpOptions} WebpOptions
 * @typedef {JpegOptions | AvifOptions | WebpOptions} FormatOptions
 */

/**
 * @param {Object} sourceFile
 * @param {Buffer} sourceFile.buffer
 * @param {string} sourceFile.name
 * @param {FormatOptions} newFormat
 */
async function convert({buffer, name}, {id, ...options}) {
  const {data: newBuffer, info} = await sharp(buffer)
    .toFormat(id, options)
    .toBuffer({resolveWithObject: true});

  const hash = createHash('sha256');
  hash.update(newBuffer);

  return {
    buffer: newBuffer,
    info,
    name: toHashedFilename(name, hash.digest('hex'), `.${id}`)
  };
}

/**
 * @typedef {Object} OptimizeImagesOptions
 * @property {boolean} skip Set to true to skip the optimization process.
 * @property {string} pathToFile
 * @property {string} outputDir The path to the output directory.
 * @property {Map} assets A map from each original asset to its output asset.
 * @property {Set} writtenAssets All assets already written to disk.
 */

/**
 * @type {import('unified').Plugin<[OptimizeImagesOptions], import('hast').Root>}
 */
export default function optimizeImages({
  skip,
  pathToFile,
  outputDir,
  assets,
  writtenAssets
}) {
  /** @param {string} src */
  function toDiskPath(src) {
    return path.resolve(path.dirname(pathToFile), src);
  }

  /**
   * Converts are writes the passed image to the `destFormat`.
   * @param {string} src
   * @param {Buffer<ArrayBuffer>} srcBuffer
   * @param {FormatOptions} destFormat
   */
  async function processImage(src, srcBuffer, destFormat) {
    console.log(`convert to ${destFormat.id}`, toDiskPath(src));

    const image = await convert(
      {
        buffer: srcBuffer,
        name: src
      },
      destFormat
    );

    const pathToNewImage = path.resolve(outputDir, image.name);

    // write the newly converted image
    console.log('write', pathToNewImage);
    await fs.writeFile(pathToNewImage, image.buffer);

    // throw this after the image is written to hopefully help with diagnostics.
    if (image.info.size > 1.5 * mebibyte) {
      throw new Error(`Image too large (${toMiB(image.info.size)}) ${pathToNewImage}`);
    }

    // tell the rest of the app to not bother doing this again.
    writtenAssets.add(pathToNewImage);

    return image;
  }

  return async tree => {
    for (const imgEl of selectAll('main img', tree)) {
      if (typeof imgEl.properties.src !== 'string') {
        throw new Error(`Image on page ${pathToFile} has no src property.`);
      }
      const pathToImage = toDiskPath(imgEl.properties.src);
      const parentEl = findParent(imgEl, tree);

      if (!isParent(parentEl)) {
        throw new Error(`Image on page ${pathToFile} has no parent element.`);
      }

      // read in the original file and compute its hash.
      const hash = createHash('sha256');
      const bufferList = [];

      for await (const chunk of createReadStream(pathToImage)) {
        bufferList.push(chunk);
        hash.update(chunk);
      }

      const additionalFormats = [];
      const sourceBuffer = Buffer.concat(bufferList);

      const imageInfo = await getImageInfo(sourceBuffer);

      /** @type {Awaited<ReturnType<typeof processImage>>} */
      let primaryImage = {
        buffer: sourceBuffer,
        info: imageInfo,
        name: toHashedFilename(imgEl.properties.src, hash.digest('hex')),
      };

      // make sure the destination directory exists.
      const destDir = path.resolve(outputDir, path.dirname(imgEl.properties.src.toString()));
      console.log('mkdir -p', destDir);
      await fs.mkdir(destDir, {recursive: true});

      if (!skip && imageInfo.size > 1.1 * mebibyte) {
        if (imageInfo.format === 'jpeg') {
          throw new Error(`Image too large (${toMiB(imageInfo.size)}) ${pathToImage}`);
        }

        primaryImage = await processImage(imgEl.properties.src, sourceBuffer, {
          id: 'jpeg'
        });

        // // tell the rest of the application we've figured out the new location.
        const pathToNewImage = path.resolve(outputDir, primaryImage.name);
        assets.set(pathToImage, pathToNewImage);
      } else {
        const pathToNewImage = path.resolve(outputDir, primaryImage.name);

        // tell the rest of the application we've figured out the new location.
        assets.set(pathToImage, pathToNewImage);

        // copy over the original file with its new hashed name.
        console.log('write', pathToNewImage);
        await fs.writeFile(pathToNewImage, primaryImage.buffer);

        // tell the rest of the app to not bother doing this again.
        writtenAssets.add(pathToNewImage);
      }

      imgEl.properties.width = primaryImage.info.width;
      imgEl.properties.height = primaryImage.info.height;
      imgEl.properties.src = primaryImage.name;

      if (!skip && imageInfo.format !== 'avif') {
        const avifImage = await processImage(imgEl.properties.src, sourceBuffer, {
          id: 'avif',
          lossless: false
        });

        additionalFormats.push(h('source', {
          srcset: avifImage.name,
          type: 'image/avif'
        }));
      }

      if (!skip && imageInfo.format !== 'webp') {
        const webpImage = await processImage(imgEl.properties.src, sourceBuffer, {
          id: 'webp',
          lossless: false
        });

        additionalFormats.push(h('source', {
          srcset: webpImage.name,
          type: 'image/webp'
        }));
      }

      // If the source image is a newer format already, output a jpeg as a
      // backup for older browsers.
      if (!skip && ['avif', 'webp'].includes(imageInfo.format)) {
        const jpegImage = await processImage(imgEl.properties.src, sourceBuffer, {
          id: 'jpeg'
        });

        additionalFormats.push(h('source', {
          srcset: jpegImage.name,
          type: 'image/jpeg'
        }));
      }

      // create a containing element for original image and other file types.
      const pictureEl = h('picture', [
        ...additionalFormats,
        imgEl
      ]);

      // overwrite the original `<img>` element in the tree.
      parentEl.children.splice(
        parentEl.children.indexOf(imgEl),
        1,
        pictureEl
      );
    }
  };
}
