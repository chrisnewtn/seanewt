import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";

/**
* Returns the sha256sum of the given file.
* @param {string} pathToFile
*/
export async function shasum(pathToFile) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(pathToFile)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
