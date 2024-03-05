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
 * @param {Buffer} buffer
 */
async function getImageSize(buffer) {
  const {info} = await sharp(buffer).toBuffer({resolveWithObject: true});
  return info;
}

/**
 * @param {Object} sourceFile
 * @param {Buffer} sourceFile.buffer
 * @param {string} sourceFile.name
 * @param {sharp.WebpOptions | sharp.AvifOptions | sharp.PngOptions} newFormat
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
  pathToFile,
  outputDir,
  assets,
  writtenAssets
}) {

  return async tree => {
    for (const imgEl of selectAll('main img', tree)) {
      const pathToImage = path.resolve(path.dirname(pathToFile), imgEl.properties.src);
      const parentEl = selectParent(imgEl, tree);

      // read in the original file and compute its hash.
      const hash = createHash('sha256');
      const bufferList = [];

      for await (const chunk of createReadStream(pathToImage)) {
        bufferList.push(chunk);
        hash.update(chunk);
      }

      const sourceBuffer = Buffer.concat(bufferList);

      const newName = toHashedFilename(imgEl.properties.src, hash.digest('hex'));
      const pathToNewImage = path.resolve(outputDir, newName);

      // tell the rest of the application we've figured out the new location.
      assets.set(pathToImage, pathToNewImage);

      // make sure the destination directory exists.
      await fs.mkdir(path.dirname(pathToNewImage), {recursive: true});

      // copy over the original file with its new hashed name.
      console.log('write', pathToNewImage);
      await fs.writeFile(pathToNewImage, sourceBuffer);

      // tell the rest of the app to not bother doing this again.
      writtenAssets.add(pathToNewImage);

      const imageInfo = await getImageSize(sourceBuffer);

      imgEl.properties.width = imageInfo.width;
      imgEl.properties.height = imageInfo.height;

      // Convert the image to webp
      console.log('convert to webp', pathToImage);
      const webpImage = await convert(
        {
          buffer: sourceBuffer,
          name: imgEl.properties.src
        },
        {
          id: 'webp',
          lossless: true
        }
      );

      const pathToWebpImage = path.resolve(outputDir, webpImage.name);

      // write the newly converted webp file
      console.log('write', pathToWebpImage);
      await fs.writeFile(pathToWebpImage, webpImage.buffer);

      // tell the rest of the app to not bother doing this again.
      writtenAssets.add(pathToWebpImage);

      const webpSourceEl = h('source', {
        srcset: webpImage.name,
        type: 'image/webp'
      });

      // Convert the image to avif
      console.log('convert to avif', pathToImage);

      const avifImage = await convert(
        {
          buffer: sourceBuffer,
          name: imgEl.properties.src
        },
        {
          id: 'avif',
          lossless: true
        }
      );

      const pathToAvifImage = path.resolve(outputDir, avifImage.name);

      // write the newly converted avif file
      console.log('write', pathToAvifImage);
      await fs.writeFile(pathToAvifImage, avifImage.buffer);

      // tell the rest of the app to not bother doing this again.
      writtenAssets.add(pathToAvifImage);

      const avifSourceEl = h('source', {
        srcset: avifImage.name,
        type: 'image/avif'
      });

      // create a containing element for original image and other file types.
      const pictureEl = h('picture', [
        avifSourceEl,
        webpSourceEl,
        imgEl
      ]);

      // wrap the picture in a link the user can click to easily view the
      // original image.
      const anchorEl = h('a', {
        href: newName,
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
