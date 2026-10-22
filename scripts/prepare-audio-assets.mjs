import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Self-host pinned upstream assets; no runtime CDN or reference-audio upload.
const packageRoot = resolve("node_modules/essentia.js");
const { version } = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
if (version !== "0.1.3") throw new Error("Review the Essentia asset path before upgrading.");
const destination = resolve("public/vendor/essentia-0.1.3");
await mkdir(destination, { recursive: true });
for (const file of ["essentia-wasm.es.js", "essentia.js-core.es.min.js"]) {
  await copyFile(resolve(packageRoot, "dist", file), resolve(destination, file));
}
await copyFile(resolve(packageRoot, "LICENSE"), resolve(destination, "LICENSE"));
