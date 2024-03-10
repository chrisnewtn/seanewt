import path from 'node:path';
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import {h} from 'hastscript';
import sharp from 'sharp';
import {selectAll} from 'hast-util-select';
import {selectParent} from './shared.js';
import {toHashedFilename} from '../util.js';

/**
 * @typedef {sharp.OutputOptions | sharp.JpegOptions | sharp.PngOptions | sharp.WebpOptions | sharp.AvifOptions | sharp.HeifOptions | sharp.JxlOptions | sharp.GifOptions | sharp.Jp2Options | sharp.TiffOptions} OutputOptions
 */

const mebibyte = 1024 * 1024;

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
 * @param {Object} sourceFile
 * @param {Buffer} sourceFile.buffer
 * @param {string} sourceFile.name
 * @param {OutputOptions} newFormat
 */
async function convert({buffer, name}, newFormat) {
  const {data: newBuffer, info} = await sharp(buffer)
    .toFormat(newFormat)
    .toBuffer({resolveWithObject: true});

  const hash = createHash('sha256');
  hash.update(newBuffer);

  return {
    buffer: newBuffer,
    info,
    name: toHashedFilename(name, hash.digest('hex'), `.${newFormat.id}`)
  };
}

/**
 * @param {Object} params
 * @param {string} params.pathToFile
 * @param {string} params.outputDir
 * @param {Map} params.assets
 * @param {Set} params.writtenAssets
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function optimizeImages({
  skip,
  pathToFile,
  outputDir,
  assets,
  writtenAssets
}) {
  function toDiskPath(src) {
    return path.resolve(path.dirname(pathToFile), src);
  }

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
    if (image.info.size > 1 * mebibyte) {
      throw new Error(`Image too large (${toMiB(image.info.size)}) ${pathToNewImage}`);
    }

    // tell the rest of the app to not bother doing this again.
    writtenAssets.add(pathToNewImage);

    return image;
  }

  return async tree => {
    for (const imgEl of selectAll('main img', tree)) {
      const pathToImage = toDiskPath(imgEl.properties.src);
      const parentEl = selectParent(imgEl, tree);

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

      let primaryImage = {
        buffer: sourceBuffer,
        info: imageInfo,
        name: toHashedFilename(imgEl.properties.src, hash.digest('hex')),
      };

      // make sure the destination directory exists.
      const destDir = path.resolve(outputDir, path.dirname(imgEl.properties.src));
      console.log('mkdir -p', destDir)
      await fs.mkdir(destDir, {recursive: true});

      if (!skip && imageInfo.size > 1 * mebibyte) {
        if (imageInfo.type === "jpeg") {
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
          lossless: true
        });

        additionalFormats.push(h('source', {
          srcset: avifImage.name,
          type: 'image/avif'
        }));
      }

      if (!skip && imageInfo.format !== 'webp') {
        const webpImage = await processImage(imgEl.properties.src, sourceBuffer, {
          id: 'webp',
          lossless: true
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

      // wrap the picture in a link the user can click to easily view the
      // original image.
      const anchorEl = h('a', {
        href: primaryImage.name,
        class: 'article-image',
        target: '_blank',
        title: 'View full image'
      }, [pictureEl]);

      // overwrite the original `<img>` element in the tree.
      parentEl.children.splice(
        parentEl.children.indexOf(imgEl),
        1,
        anchorEl
      );
    }
  };
}
