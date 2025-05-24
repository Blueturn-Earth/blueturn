const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const btDir = "bt";
const virtualEntry = "temp/entry.js";
const outFile = "bt.js";

fs.mkdirSync("temp", { recursive: true });

// Collect input files
const jsFiles = fs.readdirSync(btDir).filter(f => f.endsWith(".js"));
const importLines = jsFiles.map(f => `import "../bt/${f}";`);

// Create virtual entry
fs.writeFileSync(virtualEntry, importLines.join("\n"));

// Bundle
esbuild.buildSync({
  entryPoints: [virtualEntry],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: "temp/bundle.js",
  minify: true,
});

// Obfuscate
const code = fs.readFileSync("temp/bundle.js", "utf8");
const obfuscated = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
}).getObfuscatedCode();

// Write to bt.js in root
fs.writeFileSync(outFile, obfuscated);
console.log("✅ Obfuscated bundle written to bt.js");
