#!/usr/bin/env node
/**
 * Manual evaluation run for the AI teacher tools.
 *
 * WHAT THIS DOES: sends a fixed set of fictional inputs to a real provider, and
 * reports for each: schema validity, the cross-field checks, the language-check
 * verdict, latency, retry count, and the finish reason. It then writes every draft
 * to a file so a human can read them.
 *
 * WHAT THIS DOES NOT DO: judge quality. It cannot tell you whether a lesson plan
 * is pedagogically sound or accurate to the Bahraini curriculum — only a teacher
 * can. This script collects the samples and measures the mechanical properties; it
 * does not score the content, and nothing in its output should be read as a
 * quality assessment. See docs/ai-data-flow.md, open item 5.
 *
 * Run manually. It is NOT part of `npm test` and never runs in CI: it costs money,
 * needs a key, and depends on a third party's availability.
 *
 *   node scripts/eval-ai.mjs                    # all tools, both languages
 *   node scripts/eval-ai.mjs --tool questions   # one tool
 *   node scripts/eval-ai.mjs --language ar      # one output language
 *   node scripts/eval-ai.mjs --label run-1      # name the output directory
 *
 * Requires AI_API_KEY or HUGGINGFACE_API_KEY. Exits non-zero if any case fails
 * schema validation, so it can gate a deliberate quality review.
 */

import { mkdirSync, writeFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const toolFilter = flag("tool", null);
const languageFilter = flag("language", null);
const label = flag("label", new Date().toISOString().replace(/[:.]/g, "-"));

/* -------------------------------------------------------------------------- */
/* Fictional inputs                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every case is invented. No real student, no real name, no data from any
 * database — this file is committed, so it must stay free of personal data.
 *
 * The Arabic names used are common first names with no surname, chosen so the
 * "name is dropped" behaviour can be observed without putting anyone's identity
 * in a repository.
 */
const CASES = [
  {
    id: "lesson-plan-ar",
    toolId: "lesson-plan",
    note: "Grade 8 science, Arabic output. The default happy path.",
    options: {
      outputLanguage: "ar",
      grade: "8",
      subject: "science",
      duration: "45",
      teachingStyles: ["inquiry", "collaborative"],
    },
  },
  {
    id: "lesson-plan-en-topic",
    toolId: "lesson-plan",
    note: "Grade 7 English, explicit topic. Checks the fenced free text survives.",
    options: {
      outputLanguage: "en",
      grade: "7",
      subject: "english",
      duration: "60",
      teachingStyles: ["direct"],
      topic: "Persuasive writing: structuring an argument",
    },
  },
  {
    id: "questions-ar-mcq",
    toolId: "questions",
    note: "Grade 9 maths, multiple choice only. The validator is strictest here.",
    options: {
      outputLanguage: "ar",
      grade: "9",
      subject: "math",
      questionTypes: ["mcq"],
      count: "5",
      difficulty: "medium",
    },
  },
  {
    id: "questions-en-mixed",
    toolId: "questions",
    note: "Grade 8 science, all three types. Exercises the true/false and short rules.",
    options: {
      outputLanguage: "en",
      grade: "8",
      subject: "science",
      questionTypes: ["mcq", "true-false", "short"],
      count: "10",
      difficulty: "mixed",
    },
  },
  {
    id: "questions-ar-max",
    toolId: "questions",
    note: "Grade 9 Arabic, 15 questions. The most likely case to hit a token ceiling.",
    options: {
      outputLanguage: "ar",
      grade: "9",
      subject: "arabic",
      questionTypes: ["mcq", "short"],
      count: "15",
      difficulty: "hard",
    },
  },
  {
    id: "remedial-ar",
    toolId: "remedial-plan",
    note: "Arabic. Carries a name to confirm it is dropped before sending.",
    options: {
      outputLanguage: "ar",
      grade: "8",
      subject: "math",
      score: 42,
      difficultyTags: ["foundational-gaps", "procedural-fluency"],
      studentName: "مريم",
      notes: "يخطئ في قسمة الكسور ويحتاج تثبيت مفهوم الكسر المتكافئ.",
    },
  },
  {
    id: "remedial-en-name",
    toolId: "remedial-plan",
    note: "English. Name present, must not appear in the outgoing prompt.",
    options: {
      outputLanguage: "en",
      grade: "7",
      subject: "english",
      score: 55,
      difficultyTags: ["reading-comprehension", "vocabulary"],
      studentName: "Sample Student",
      notes: "Reads slowly and loses the main idea in longer passages.",
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reads the provider configuration with the same precedence the app uses:
 * AI_API_KEY wins over HUGGINGFACE_API_KEY, and a missing key means "not
 * configured" rather than an error. Kept here as plain JS so this script can run
 * without a build step; it deliberately mirrors src/lib/ai/gateway.ts, and a
 * mismatch would show up as an eval that fails while the route works.
 */
function readProviderConfig() {
  const apiKey = (process.env.AI_API_KEY ?? "").trim() || (process.env.HUGGINGFACE_API_KEY ?? "").trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: (process.env.AI_BASE_URL ?? "").trim() || "https://router.huggingface.co/v1",
    model: (process.env.AI_MODEL ?? "").trim() || "tiiuae/Falcon-H1-3B-Instruct",
  };
}

function selectCases() {
  return CASES.filter((c) => {
    if (toolFilter && c.toolId !== toolFilter) return false;
    if (languageFilter && c.options.outputLanguage !== languageFilter) return false;
    return true;
  });
}

async function main() {
  // resolveConfig lives in the gateway; read it through the same env rules the app
  // uses rather than duplicating the precedence here.
  const config = readProviderConfig();
  if (!config) {
    console.error(
      "No provider key found. Set AI_API_KEY or HUGGINGFACE_API_KEY, or use\n" +
        ".env.local for a local run. This script never runs in CI.",
    );
    process.exit(2);
  }

  // The same modules the route uses. Imported dynamically because they are
  // TypeScript and this script is run through the bundler below.
  const {
    buildPrompt,
    looksTruncated,
    parseOptions,
    summariseIssues,
  } = await import("../build-test/generate.mjs");
  const { getTool } = await import("../build-test/tools.mjs");
  const { checkLanguage, collectText } = await import("../build-test/language.mjs");
  const { validateQuestions, validateAnswerAlignment, describeQuestionIssues } =
    await import("../build-test/validate.mjs");

  const cases = selectCases();
  if (cases.length === 0) {
    console.error("No cases matched the filters.");
    process.exit(2);
  }

  console.log(`Model:     ${config.model}`);
  console.log(`Endpoint:  ${config.baseURL}`);
  console.log(`Cases:     ${cases.length}`);
  console.log(`Output:    /tmp/ai-eval/${label}/`);
  console.log("");

  const outDir = `/tmp/ai-eval/${label}`;
  mkdirSync(outDir, { recursive: true });

  const rows = [];
  let failures = 0;

  for (const testCase of cases) {
    const tool = getTool(testCase.toolId);
    const parsedOptions = parseOptions(testCase.toolId, testCase.options);
    if (!parsedOptions) {
      console.error(`${testCase.id}: OPTIONS REJECTED BY THE SCHEMA — this is a bug in the case, not the model.`);
      failures += 1;
      continue;
    }

    // Mirrors the pipeline's call budget: one attempt, plus at most one retry.
    let attempts = 0;
    let raw = "";
    let truncated = false;
    let schemaOk = false;
    let crossField = "";
    let languageVerdict = "";
    let languageRatio = 0;
    let finalError = "";
    let promptSent = null;

    const startedAt = Date.now();

    while (attempts < 2) {
      attempts += 1;

      // Build the prompt exactly as the route does, so the eval measures the
      // shipped behaviour rather than a paraphrase of it.
      const prompt = buildPrompt(testCase.toolId, parsedOptions);
      if (promptSent === null) promptSent = prompt;

      const attemptStart = Date.now();
      let text;
      try {
        text = await callProvider(config, prompt, tool.maxOutputTokens(parsedOptions));
      } catch (err) {
        finalError = `provider call failed: ${err instanceof Error ? err.message : "unknown"}`;
        break;
      }
      const _attemptMs = Date.now() - attemptStart;
      void _attemptMs;

      raw = text;
      truncated = looksTruncated(text, false);

      // 1. Parse.
      let payload;
      try {
        payload = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
      } catch {
        if (attempts < 2) {
          // The same repair shape the route would send, minus any value.
          raw = await retryWithNote(
            config,
            buildPrompt(testCase.toolId, parsedOptions),
            tool.maxOutputTokens(parsedOptions),
            "the previous response was not valid JSON. Return only the JSON object.",
          );
          continue;
        }
        finalError = "not valid JSON after one retry";
        break;
      }

      // 2. Schema.
      const validated = tool.outputSchema.safeParse(payload);
      if (!validated.success) {
        if (attempts < 2) {
          raw = await retryWithNote(
            config,
            buildPrompt(testCase.toolId, parsedOptions),
            tool.maxOutputTokens(parsedOptions),
            `structural problems: ${summariseIssues(validated.error)}`,
          );
          continue;
        }
        finalError = `schema: ${summariseIssues(validated.error)}`;
        break;
      }
      schemaOk = true;

      // 3. Cross-field, for the questions tool.
      if (testCase.toolId === "questions") {
        const structural = validateQuestions(validated.data, {
          count: Number(parsedOptions.count),
          types: parsedOptions.questionTypes,
        });
        const alignment = structural.ok
          ? validateAnswerAlignment(validated.data)
          : { ok: true, issues: [] };
        if (!structural.ok || !alignment.ok) {
          crossField = describeQuestionIssues([...structural.issues, ...alignment.issues]);
          if (attempts < 2) {
            raw = await retryWithNote(
              config,
              buildPrompt(testCase.toolId, parsedOptions),
              tool.maxOutputTokens(parsedOptions),
              `structural problems: ${crossField}`,
            );
            continue;
          }
          finalError = `cross-field: ${crossField}`;
          break;
        }
      }

      // 4. Language.
      const language = checkLanguage(collectText(validated.data).join("\n"), parsedOptions.outputLanguage);
      languageVerdict = language.verdict;
      languageRatio = language.arabicRatio;
      if (language.verdict === "mismatch") {
        if (attempts < 2) {
          const target = parsedOptions.outputLanguage === "ar" ? "Arabic" : "English";
          raw = await retryWithNote(
            config,
            buildPrompt(testCase.toolId, parsedOptions),
            tool.maxOutputTokens(parsedOptions),
            `the previous response was in the wrong language. Rewrite all prose in ${target}.`,
          );
          continue;
        }
        finalError = "language mismatch after one retry";
        break;
      }

      // 5. Write the draft for a human to read.
      writeFileSync(
        `${outDir}/${testCase.id}.json`,
        JSON.stringify({ case: testCase.id, input: testCase.options, output: validated.data }, null, 2),
      );
      break;
    }

    const latencyMs = Date.now() - startedAt;
    if (finalError) failures += 1;

    rows.push({
      id: testCase.id,
      tool: testCase.toolId,
      language: testCase.options.outputLanguage,
      schemaOk,
      crossField,
      languageVerdict,
      languageRatio,
      attempts,
      truncated,
      latencyMs,
      error: finalError,
    });

    const mark = finalError ? "FAIL" : "ok  ";
    console.log(
      `${mark} ${testCase.id.padEnd(22)} ` +
        `schema=${schemaOk ? "y" : "n"} ` +
        `lang=${(languageVerdict || "-").padEnd(11)} ` +
        `ratio=${languageRatio.toFixed(2)} ` +
        `tries=${attempts} ` +
        `${truncated ? "TRUNCATED " : ""}` +
        `${latencyMs}ms` +
        `${finalError ? `\n     ${finalError}` : ""}`,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Summary                                                                  */
  /* ------------------------------------------------------------------------ */

  const ok = rows.filter((r) => !r.error);
  const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : 0);

  console.log("");
  console.log("── summary ─────────────────────────────");
  console.log(`passed            ${ok.length}/${rows.length}`);
  console.log(`schema valid      ${rows.filter((r) => r.schemaOk).length}/${rows.length}`);
  console.log(`language match    ${rows.filter((r) => r.languageVerdict === "match").length}`);
  console.log(`language undecid. ${rows.filter((r) => r.languageVerdict === "undecidable").length}`);
  console.log(`needed a retry    ${rows.filter((r) => r.attempts > 1).length}`);
  console.log(`truncated         ${rows.filter((r) => r.truncated).length}`);
  console.log(`latency p50/p95   ${pct(0.5)}ms / ${pct(0.95)}ms`);
  console.log("");

  writeFileSync(`${outDir}/summary.json`, JSON.stringify({ label, model: config.model, rows }, null, 2));

  console.log("reported metrics only — NOT a quality assessment.");
  console.log(`Drafts are in ${outDir}/ for a teacher to read.`);
  console.log("See docs/ai-data-flow.md item 5: content quality has not been evaluated.");

  if (failures > 0) process.exit(1);
}

/** One extra provider call with an appended instruction. */
async function retryWithNote(config, prompt, maxOutputTokens, note) {
  const user = `${prompt.user}\n\n${note}`;
  return callProvider(config, { system: prompt.system, user }, maxOutputTokens);
}

/**
 * The provider call.
 *
 * Uses generateText, matching the route — the router's models do not reliably
 * support structured-output mode, so JSON is requested in the prompt and
 * validated here.
 *
 * The Hugging Face router can answer HTTP 200 with an ERROR BODY (a quota or
 * billing refusal, for instance), which the SDK then reports as the opaque
 * "Invalid JSON response". That message sends you looking for a prompt bug when
 * the real problem is an exhausted account, so the body is inspected here and the
 * provider's own reason is surfaced instead.
 */
async function callProvider(config, prompt, maxOutputTokens) {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { generateText } = await import("ai");

  const client = createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
  try {
    const result = await generateText({
      model: client(config.model),
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens,
    });
    return result.text;
  } catch (err) {
    const body = err && typeof err === "object" && "responseBody" in err ? String(err.responseBody) : "";
    if (body) {
      try {
        const parsed = JSON.parse(body);
        const message = parsed?.error?.message;
        const code = parsed?.error?.code;
        if (message) {
          // Expected in the wild; the caller decides whether to continue.
          throw new Error(`provider refused the request (${code ?? "error"}): ${message}`);
        }
      } catch (inner) {
        if (inner instanceof Error && inner.message.startsWith("provider refused")) throw inner;
      }
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
