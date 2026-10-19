// Rebuilds notes-demo.js and notes-demo.css from the real Leetcode Notes landing mocks in the
// Next app (src/app/notes/landing/templates/final: BrowserMock, WebAppMock and the floating
// SidebarMock used in the hero collage), so this page always shows the same screens as
// leetcodenotes.com.
//
// Run from the app-catalog folder:
//   node scripts/build-notes-demo.mjs                        (Next app at ../next-app)
//   NEXT_APP_DIR=/path/to/next-app node scripts/build-notes-demo.mjs
//
// It uses the esbuild, react and motion packages from the Next app's node_modules.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextApp = resolve(process.env.NEXT_APP_DIR || join(repoRoot, "..", "next-app"));
const finalDir = join(nextApp, "src/app/notes/landing/templates/final");
const inlineLogo = process.argv.includes("--inline-logo");

const requireFromNext = createRequire(join(nextApp, "package.json"));
const { build } = requireFromNext("esbuild");

// Design tokens from final.module.css (.page), scoped to the mount points.
const SCOPE_CSS = `
.ln-scope {
  --bg: #000000; --surface-header: #0A0A0A; --surface-1: #111111; --surface-2: #161616; --surface-3: #1A1A1A; --surface-4: #222222;
  --code-bg: #050505; --code-bar: #0E0E0E; --browser-bg: #0B0B0B;
  --border-subtle: #1A1A1A; --border: #1E1E1E; --border-strong: #242424; --border-control: #282828; --border-button: #2E2E2E; --border-dashed: #363636;
  --ink: #ECEAE4; --ink-body: #DAD8D2; --ink-label: #D6D4CE;
  --text-secondary: #B5B5B5; --text-tertiary: #A3A3A3; --text-muted: #8A8A8A; --text-faint: #7F7F7F; --text-gutter: #4E4E4E;
  --accent: #F5A524; --accent-ink: #1B1405; --accent-text: #F7B955; --accent-soft: rgba(245, 165, 36, 0.12); --accent-line: rgba(245, 165, 36, 0.5); --accent-ring: rgba(245, 165, 36, 0.16);
  --link: #F5B94A; --link-hover: #FFD27F;
  --easy: #34C38F; --easy-text: #4FD1A1; --easy-soft: rgba(52, 195, 143, 0.12);
  --medium: #F5A524; --medium-text: #F7B955; --medium-soft: rgba(245, 165, 36, 0.12);
  --hard: #F26D78; --hard-text: #F4959D; --hard-soft-strong: rgba(242, 109, 120, 0.1); --hard-line: rgba(242, 109, 120, 0.25); --hard-line-strong: rgba(242, 109, 120, 0.5); --hard-ring: rgba(242, 109, 120, 0.16);
  --info: #4EA1FF; --violet: #8F9CF7; --knob: #FFFFFF;
  --syn-keyword: #E58FB5; --syn-type: #7CC7E8; --syn-fn: #F2D08A; --syn-number: #F5B971; --syn-punct: #9AA0AA; --syn-plain: #D7D9DE;
  --font-sans: "Geist"; --font-mono: "JetBrains Mono";
  display: flex;
  justify-content: center;
  color: var(--ink);
  font-family: var(--font-sans), "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: normal;
  letter-spacing: normal;
  -webkit-font-smoothing: antialiased;
  color-scheme: dark;
}
.ln-scope a { color: inherit; text-decoration: none; }
.ln-scope :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.ln-scope h1, .ln-scope h2, .ln-scope h3, .ln-scope h4, .ln-scope p { margin: 0; }
.ln-scope button { font-family: inherit; }
.ln-scope > * { min-width: 0; }
`;

const tmp = mkdtempSync(join(tmpdir(), "notes-demo-"));
try {
  // next/image stand-in: a plain <img>. The only image the mocks use is the Notes logo.
  writeFileSync(
    join(tmp, "next-image.jsx"),
    (inlineLogo
      ? `import logo from ${JSON.stringify(join(nextApp, "public/notes/logo.png"))};\n`
      : `const logo = "img/notes-logo.png";\n`) +
      `export default function Image({ src, alt, width, height, className }) {
  const resolved = src === "/notes/logo.png" ? logo : src;
  return <img src={resolved} alt={alt} width={width} height={height} className={className} decoding="async" />;
}
`,
  );
  writeFileSync(join(tmp, "notes-scope.css"), SCOPE_CSS);
  writeFileSync(
    join(tmp, "entry.jsx"),
    `import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { BrowserMock, SidebarMock } from ${JSON.stringify(join(finalDir, "ExtensionSidebar.tsx"))};
import { WebAppMock } from ${JSON.stringify(join(finalDir, "WebAppMock.tsx"))};
import "./notes-scope.css";

function mount(id, node) {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(<MotionConfig reducedMotion="user">{node}</MotionConfig>);
}
mount("ln-browser", <BrowserMock />);
mount("ln-webapp", <WebAppMock />);
mount("ln-hero-sidebar", <SidebarMock floating />);
`,
  );

  await build({
    entryPoints: [join(tmp, "entry.jsx")],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    jsx: "automatic",
    loader: { ".png": "dataurl" },
    alias: { "next/image": join(tmp, "next-image.jsx") },
    nodePaths: [join(nextApp, "node_modules")],
    tsconfig: join(nextApp, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "none",
    outfile: join(repoRoot, "notes-demo.js"),
    logLevel: "info",
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
