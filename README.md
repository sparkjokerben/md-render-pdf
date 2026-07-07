# md-render-pdf

Tiny CLI for rendering Markdown with KaTeX math to PDF, HTML, or a long PNG.

## Install

```bash
npm install -g md-render-pdf
```

Or with Homebrew:

```bash
brew install sparkjokerben/tap/md-render-pdf
```

Or install from a GitHub release tarball:

```bash
npm install -g https://github.com/sparkjokerben/md-render-pdf/releases/download/v0.1.0/md-render-pdf-0.1.0.tgz
```

Install from this folder while developing:

```bash
npm install
npm link
```

## Usage

```bash
md-render-pdf input.md -o output.pdf --html output.html
md-render-pdf input.md --png output.png
```

By default it writes a PDF next to the input file.

You can also use it without global install:

```bash
npx md-render-pdf input.md -o output.pdf
```

## Chrome

The tool uses an installed Chrome/Chromium. On macOS it tries:

- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Chromium.app/Contents/MacOS/Chromium`
- `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`

Override it with:

```bash
md-render-pdf input.md --chrome "/path/to/chrome"
```

## Fonts

The default Chinese font stack is Apple-ish:

```css
-apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", "Heiti SC", "PingFang SC", "Helvetica Neue", Arial, sans-serif
```

Override it:

```bash
md-render-pdf input.md --font '"PingFang SC", "Hiragino Sans GB", sans-serif'
```

## Math

Supported math delimiters:

- Display: `$$ ... $$`
- Inline: `\\( ... \\)`
