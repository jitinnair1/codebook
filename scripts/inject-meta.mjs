import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "toml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(process.cwd(), "dist", "index.html");

try {
  console.log("Injecting SEO meta tags...");
  const tomlContent = readFileSync(join(process.cwd(), "site.toml"), "utf-8");
  const siteConfig = parse(tomlContent);
  const { headline, description, keywords, og_image } = siteConfig;

  let html = readFileSync(distPath, "utf-8");

  if (headline) {
    html = html.replace(/<title>.*<\/title>/, `<title>${headline}</title>`);
    html = html.replace("</head>", `<meta property="og:title" content="${headline}">\n</head>`);
  }

  if (description) {
    html = html.replace("</head>", `<meta name="description" content="${description}">\n</head>`);
    html = html.replace("</head>", `<meta property="og:description" content="${description}">\n</head>`);
  }

  if (keywords) {
    html = html.replace("</head>", `<meta name="keywords" content="${keywords}">\n</head>`);
  }

  if (og_image) {
    html = html.replace("</head>", `<meta property="og:image" content="${og_image}">\n</head>`);
    html = html.replace("</head>", `<meta name="twitter:card" content="summary_large_image">\n</head>`);
  }

  writeFileSync(distPath, html);
  console.log("SEO meta tags injected");
} catch (error) {
  console.error("Failed to inject meta tags:", error);
  process.exit(1);
}
