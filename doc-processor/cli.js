import fs from "node:fs/promises";
import {processDocument} from "./index.js";

const [pathToFile] = process.argv.slice(2);
const fileContents = await fs.readFile(pathToFile, "utf8");

const file = await processDocument(pathToFile, fileContents);

await fs.writeFile(pathToFile, String(file), "utf8");
