import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const t0 = process.hrtime.bigint();
const files = readdirSync("tests", { recursive: true })
  .filter(f => f.endsWith(".test.mjs"))
  .map(f => join("tests", String(f).replace("/","/")).replace("./tests/","tests/"));
// node 20+: pass each test file to node --test
const out = execSync(`node --test ${files.map(f=>JSON.stringify(f)).join(" ")}`, { encoding: "utf8" });
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(out.split("\n").filter(l => /# (pass|fail)|tests|ℹ/.test(l)).join("\n"));
console.log(`\nAll suites finished in ${ms.toFixed(0)}ms`);
