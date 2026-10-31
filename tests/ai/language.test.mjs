/**
 * Language-detection tests.
 *
 * The detector exists to catch a real and frequent failure: a model asked for
 * Arabic answers in English because the system prompt is English. The tests below
 * separate two things that are easy to conflate — content that must be REJECTED
 * (wrong language throughout) from content that must be ACCEPTED (bilingual by
 * nature, term-heavy, short, or mostly numbers).
 *
 * Getting the second category wrong is the expensive mistake: a false mismatch
 * costs a second billed provider call and mangles a usable result.
 *
 * Run with: node --test tests/ai/language.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  checkLanguage,
  countScripts,
  countStopwords,
  collectText,
  describeLanguageIssue,
  ARABIC_STOPWORDS,
  ENGLISH_STOPWORDS,
} = await import("../../build-test/language.mjs");

/* -------------------------------------------------------------------------- */
/* Fixtures: realistic generated content                                      */
/* -------------------------------------------------------------------------- */

const ARABIC_LESSON = `
خطة درس: قسمة الكسور
الأهداف: أن يفهم الطالب معنى قسمة الكسور، وأن يحل مسائل بسيطة على القسمة.
المواد: سبورة، وأوراق عمل، وأقلام ملونة.
سير الدرس: يبدأ المعلم بمراجعة سريعة، ثم يشرح المفهوم في مجموعة صغيرة،
وبعد ذلك يوزع أوراق العمل على الطلاب في الفصل.
التقويم: يطرح المعلم سؤالًا قصيرًا في نهاية الحصة للتأكد من فهم الطلاب.
`;

const ENGLISH_LESSON = `
Lesson plan: Dividing fractions
Objectives: the student will explain what dividing by a fraction means, and solve
simple problems involving division of fractions.
Materials: a whiteboard, worksheets, and coloured pens.
Procedure: the teacher begins with a short review, then explains the concept in a
small group, and afterwards hands out the worksheets to the students in the class.
Assessment: the teacher asks a short exit question at the end of the lesson.
`;

/** A genuine bidirectional answer: an English term list inside Arabic prose. */
const ARABIC_WITH_ENGLISH_TERMS = `
خطة الدرس لمادة الرياضيات في الصف الثامن.
سنتناول مفهوم الـ fractions والـ numerator والـ denominator، ثم ننتقل إلى
الـ problem solving باستخدام الـ LCD في المسائل.
التقويم: يوضح الطالب الفرق بين الـ proper fraction والـ improper fraction.
`;

/** The reverse: Arabic key terms inside English prose. */
const ENGLISH_WITH_ARABIC_TERMS = `
Lesson plan for grade 8 Arabic language.
The students will read the text titled "الكسور في حياتنا" and identify the main idea.
They will then write a summary using the vocabulary: القسمة، والضرب، والطرح.
Assessment: a short paragraph in response to the reading.
`;

/* -------------------------------------------------------------------------- */
/* countScripts                                                               */
/* -------------------------------------------------------------------------- */

test("countScripts: separates Arabic from Latin and ignores the rest", () => {
  const counts = countScripts("abc");
  assert.equal(counts.latin, 3);
  assert.equal(counts.arabic, 0);

  const arabic = countScripts("كتب");
  assert.equal(arabic.arabic, 3);
  assert.equal(arabic.latin, 0);
});

test("countScripts: digits, punctuation and math symbols are not language signal", () => {
  // A response that is mostly numbers must not be read as either language.
  const counts = countScripts("12345 67890 + - = × ÷ 1/2 3.5 %");
  assert.equal(counts.arabic, 0);
  assert.equal(counts.latin, 0, "plain digits are not Latin letters");
});

test("countScripts: Arabic-Indic digits do not count as Arabic letters", () => {
  const counts = countScripts("١٢٣٤٥");
  assert.equal(counts.arabic, 0, "digits are ignored, not counted as script");
});

test("countScripts: harakat do not inflate the Arabic count", () => {
  const unvocalised = countScripts("كتب");
  const vocalised = countScripts("كَتَبَ");
  assert.equal(vocalised.arabic, unvocalised.arabic, "combining marks must not outweigh letters");
});

test("countScripts: tatweel is ignored", () => {
  const counts = countScripts("كتـــاب");
  assert.equal(counts.arabic, 4, "the elongation character is decorative");
});

/* -------------------------------------------------------------------------- */
/* STEP 1-2: the script ratio decides                                         */
/* -------------------------------------------------------------------------- */

test("script ratio: clean Arabic passes when Arabic was asked for", () => {
  const result = checkLanguage(ARABIC_LESSON, "ar");
  assert.equal(result.verdict, "match");
  assert.equal(result.decidedBy, "script");
  assert.ok(result.arabicRatio > 0.8);
});

test("script ratio: clean English passes when English was asked for", () => {
  const result = checkLanguage(ENGLISH_LESSON, "en");
  assert.equal(result.verdict, "match");
  assert.equal(result.decidedBy, "script");
  assert.ok(result.arabicRatio < 0.2);
});

test("script ratio: Arabic content is a mismatch when English was asked for", () => {
  const result = checkLanguage(ARABIC_LESSON, "en");
  assert.equal(result.verdict, "mismatch");
  assert.equal(result.decidedBy, "script");
});

test("script ratio: English content is a mismatch when Arabic was asked for", () => {
  const result = checkLanguage(ENGLISH_LESSON, "ar");
  assert.equal(result.verdict, "mismatch");
  assert.equal(result.decidedBy, "script");
});

test("script ratio: a numbers-and-symbols-only response is undecidable, not a mismatch", () => {
  const result = checkLanguage("1 + 2 = 3  4 × 5 = 20  (6/2) = 3", "ar");
  assert.equal(result.verdict, "undecidable");
  assert.equal(result.decidedBy, "none");
});

test("script ratio: an extremely short answer is undecidable", () => {
  assert.equal(checkLanguage("نعم", "ar").verdict, "undecidable");
  assert.equal(checkLanguage("Yes", "en").verdict, "undecidable");
});

/* -------------------------------------------------------------------------- */
/* Allowed mixed content — the cases a naive check gets wrong                  */
/* -------------------------------------------------------------------------- */

test("mixed content: Arabic prose with English technical terms still passes as Arabic", () => {
  const result = checkLanguage(ARABIC_WITH_ENGLISH_TERMS, "ar");
  assert.equal(result.verdict, "match", `ratio was ${result.arabicRatio}`);
});

test("mixed content: English prose with Arabic quotations passes as English", () => {
  const result = checkLanguage(ENGLISH_WITH_ARABIC_TERMS, "en");
  assert.equal(result.verdict, "match", `ratio was ${result.arabicRatio}`);
});

test("mixed content: a bilingual topic list is not forced to fail", () => {
  // A teacher's own topic list may be bidirectional; a plan around it should not
  // be rejected merely because the terms came back symmetric.
  const bilingual =
    "Objectives: understand الكسور and fractions, compare القسمة with division, " +
    "and use both appropriately in problem solving.";
  const result = checkLanguage(bilingual, "en");
  assert.notEqual(result.verdict, "mismatch", "an even mix must not be a confident mismatch");
});

/* -------------------------------------------------------------------------- */
/* STEP 3: stopwords decide the ambiguous band                                */
/* -------------------------------------------------------------------------- */

test("stopwords: whole words only — a substring does not count", () => {
  // "من" appears inside "مسألة" as characters but is not the word "من".
  assert.equal(countStopwords("مسألة", ARABIC_STOPWORDS), 0);
  assert.equal(countStopwords("من", ARABIC_STOPWORDS), 1);
  // The English side must not fire inside longer words either.
  assert.equal(countStopwords("therein", ENGLISH_STOPWORDS), 0);
  assert.equal(countStopwords("the and", ENGLISH_STOPWORDS), 2);
});

test("stopwords: Arabic prefixed forms are recognised as the word", () => {
  // "والكسور" contains "ال" but the function word we look for is not there;
  // "ومن" does contain "من" at a word boundary after the prefix.
  assert.ok(countStopwords("ومن هنا", ARABIC_STOPWORDS) >= 1);
});

test("stopwords: an ambiguous ratio is resolved toward the dominant function words", () => {
  // Roughly balanced scripts, but the sentence structure is unmistakably Arabic.
  const text =
    "الهدف من الدرس أن يفهم الطالب أن الكسور هي أجزاء من كل، " +
    "والدرس في الصف الثامن مع أمثلة من الحياة اليومية " +
    "where students practise and review and discuss the ideas together as a class.";
  const result = checkLanguage(text, "ar");
  assert.notEqual(result.verdict, "mismatch", `decidedBy=${result.decidedBy} ratio=${result.arabicRatio}`);
});

test("stopwords: a balanced text with no dominant function words is undecidable", () => {
  // 50/50 script mix and no clear function-word winner.
  const text = "alpha beta gamma delta الكسور القسمة الضرب الطرح";
  const result = checkLanguage(text, "en");
  assert.equal(result.verdict, "undecidable");
});

test("stopwords: a decisive script ratio is not overridden by stopwords", () => {
  // Mostly Arabic script, which alone decides it — stopwords must not be
  // consulted and the verdict must be a match for Arabic.
  const text = ARABIC_LESSON + " the and of to in";
  const result = checkLanguage(text, "ar");
  assert.equal(result.decidedBy, "script");
  assert.equal(result.verdict, "match");
});

/* -------------------------------------------------------------------------- */
/* collectText                                                                */
/* -------------------------------------------------------------------------- */

test("collectText: gathers strings from a nested payload, ignoring keys", () => {
  const payload = {
    title: "قسمة الكسور",
    objectives: ["يفهم الطالب", "يحل مسائل"],
    stages: [{ name: "تمهيد", minutes: 5, description: "مراجعة سريعة" }],
  };
  const strings = collectText(payload);
  assert.ok(strings.includes("قسمة الكسور"));
  assert.ok(strings.includes("مراجعة سريعة"));
  assert.equal(
    strings.some((s) => s === "correctIndex" || s === "objectives"),
    false,
    "schema keys are English by construction and must not be counted",
  );
});

test("collectText: a realistic question payload is judgeable as Arabic", () => {
  const payload = {
    questions: [
      {
        type: "mcq",
        prompt: "ما ناتج قسمة الكسر على الكسر؟",
        options: ["ثلاثة أرباع", "نصف", "ربع", "كسر"], 
        correctIndex: 0,
        answer: "ثلاثة أرباع",
      },
    ],
  };
  const text = collectText(payload).join("\n");
  assert.equal(checkLanguage(text, "ar").verdict, "match");
});

/* -------------------------------------------------------------------------- */
/* The repair description                                                     */
/* -------------------------------------------------------------------------- */

test("describeLanguageIssue: names the target language and carries no content", () => {
  const result = checkLanguage(ENGLISH_LESSON, "ar");
  const description = describeLanguageIssue(result, "ar");
  assert.match(description, /Arabic/);
  assert.equal(description.includes("Lesson plan"), false, "no generated content in the description");
  assert.equal(description.includes("dividing"), false);
});

test("describeLanguageIssue: is directionally correct for both targets", () => {
  const asArabic = describeLanguageIssue(checkLanguage(ENGLISH_LESSON, "ar"), "ar");
  const asEnglish = describeLanguageIssue(checkLanguage(ARABIC_LESSON, "en"), "en");
  assert.match(asArabic, /English, not in Arabic/);
  assert.match(asEnglish, /Arabic, not in English/);
});
