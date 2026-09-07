import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const master = readFileSync("public/icon.svg", "utf8");
const maskable = readFileSync("public/icon-maskable.svg", "utf8");

mkdirSync("public/icons", { recursive: true });

const render = (svg, size, out) => {
  writeFileSync(out, new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log("wrote", out);
};

render(master, 192, "public/icons/icon-192.png");
render(master, 512, "public/icons/icon-512.png");
render(maskable, 512, "public/icons/icon-maskable-512.png");
render(maskable, 180, "public/icons/apple-touch-icon.png");

// favicon 用同一个 SVG 拷贝
writeFileSync("public/favicon.svg", master);
console.log("wrote public/favicon.svg");
