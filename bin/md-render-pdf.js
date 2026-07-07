#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const { marked } = require("marked");
const katex = require("katex");

let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  ({ chromium } = require("playwright"));
}

function usage() {
  console.error(`Usage:
  md-render-pdf input.md [-o output.pdf] [--html output.html] [--png output.png]
                [--chrome /path/to/chrome] [--font css-font-family]

Examples:
  md-render-pdf novel.md -o novel.pdf --html novel.html
  md-render-pdf novel.md --png novel.png`);
}

function parseArgs(argv) {
  const options = {
    input: null,
    pdf: null,
    html: null,
    png: null,
    chrome: process.env.CHROME_PATH || "",
    font:
      '-apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", "Heiti SC", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
    title: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === "-o" || arg === "--pdf") options.pdf = next();
    else if (arg === "--html") options.html = next();
    else if (arg === "--png") options.png = next();
    else if (arg === "--chrome") options.chrome = next();
    else if (arg === "--font") options.font = next();
    else if (arg === "--title") options.title = next();
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else if (!options.input) options.input = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!options.input) throw new Error("Missing input markdown file");

  const inputPath = path.resolve(options.input);
  const base = inputPath.replace(/\.[^.]+$/, "");
  if (!options.pdf && !options.html && !options.png) options.pdf = `${base}.pdf`;
  if (options.pdf) options.pdf = path.resolve(options.pdf);
  if (options.html) options.html = path.resolve(options.html);
  if (options.png) options.png = path.resolve(options.png);
  options.input = inputPath;
  if (!options.title) options.title = path.basename(base);
  return options;
}

function defaultChromePath() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function renderMath(markdown) {
  const math = [];
  const save = (html) => {
    const key = `@@MATH_${math.length}@@`;
    math.push([key, html]);
    return key;
  };

  let protectedMd = markdown.replace(/^\$\$\n([\s\S]*?)\n\$\$/gm, (_, tex) => {
    const rendered = katex.renderToString(tex.trim(), {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
    return save(`<div class="math-block">${rendered}</div>`);
  });

  protectedMd = protectedMd.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
    const rendered = katex.renderToString(tex.trim(), {
      displayMode: false,
      throwOnError: false,
      strict: false,
    });
    return save(rendered);
  });

  return { protectedMd, math };
}

function katexCss() {
  const katexRoot = path.dirname(require.resolve("katex/package.json"));
  const katexDist = path.join(katexRoot, "dist");
  return fs
    .readFileSync(path.join(katexDist, "katex.min.css"), "utf8")
    .replaceAll("url(fonts/", `url(${pathToFileURL(path.join(katexDist, "fonts")).href}/`);
}

function buildHtml(markdown, options) {
  const { protectedMd, math } = renderMath(markdown);
  marked.setOptions({ gfm: true, breaks: false });
  let body = marked.parse(protectedMd);
  for (const [key, html] of math) body = body.replaceAll(key, html);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(options.title)}</title>
<style>${katexCss()}</style>
<style>
  @page { size: A4; margin: 17mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #171717;
    background: #fff;
    font-family: ${options.font};
    font-size: 11.2pt;
    line-height: 1.78;
  }
  main { max-width: 780px; margin: 0 auto; }
  h1, h2 {
    font-family: ${options.font};
    font-weight: 700;
    line-height: 1.35;
    break-after: avoid;
  }
  h1 { margin: 0 0 8mm; text-align: center; font-size: 24pt; }
  h2 { margin: 9mm 0 5mm; font-size: 16pt; }
  p { margin: 0 0 0.76em; text-align: justify; }
  ul { margin: 0 0 1em 1.4em; padding: 0; }
  li { margin: 0.15em 0; }
  .katex { font-size: 1.02em; }
  .math-block {
    margin: 0.75em 0 1em;
    overflow: visible;
    text-align: center;
    break-inside: avoid;
  }
  .math-block .katex-display { margin: 0; overflow: visible; }
  .katex-display > .katex { max-width: 100%; white-space: normal; }
  .katex .base { margin-top: 0.08em; margin-bottom: 0.08em; }
</style>
</head>
<body><main>
${body}
</main></body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function printOutputs(htmlPath, options) {
  const chrome = options.chrome || defaultChromePath();
  if (!chrome) throw new Error("Chrome/Chromium not found. Pass --chrome /path/to/chrome.");

  const browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
  });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });

  if (options.pdf) {
    await page.pdf({
      path: options.pdf,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(`PDF: ${options.pdf}`);
  }

  if (options.png) {
    await page.screenshot({
      path: options.png,
      fullPage: true,
      type: "png",
    });
    console.log(`PNG: ${options.png}`);
  }

  await browser.close();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const markdown = fs.readFileSync(options.input, "utf8");
  const html = buildHtml(markdown, options);
  const htmlPath = options.html || path.join(path.dirname(options.input), `${path.basename(options.input, path.extname(options.input))}.rendered.html`);
  fs.writeFileSync(htmlPath, html, "utf8");
  if (options.html) console.log(`HTML: ${options.html}`);
  if (options.pdf || options.png) await printOutputs(htmlPath, options);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
