#!/usr/bin/env node
/**
 * Adds the `tools` namespace to both message catalogs.
 *
 * Written as a script rather than by hand so the two files cannot drift: the
 * Arabic and English key sets are asserted equal before anything is written.
 *
 * Run: node scripts/add-tool-messages.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const AR = "messages/ar.json";
const EN = "messages/en.json";

const tools = {
  ar: {
    title: "أدوات المعلم",
    intro: "اختر أداة، اضبط الخيارات، واحصل على مسودة جاهزة للمراجعة.",

    picker: {
      heading: "اختر أداة",
      available: "متاح",
    },

    lessonPlan: {
      title: "خطة درس",
      description: "خطة حصة واحدة بأهداف ومراحل وتقويم.",
      grade: "الصف",
      subject: "المادة",
      duration: "مدة الحصة",
      teachingStyles: "أساليب التدريس",
      topic: "الموضوع (اختياري)",
      topicHint: "إن تركته فارغًا تختار لومورا موضوعًا مناسبًا للصف والمادة.",
    },

    questions: {
      title: "إنشاء اختبار",
      description: "أسئلة متنوعة مع مفتاح الإجابة.",
      grade: "الصف",
      subject: "المادة",
      topic: "الموضوع (اختياري)",
      topicHint: "إن تركته فارغًا تختار لومورا موضوعًا مناسبًا للصف والمادة.",
      questionTypes: "أنواع الأسئلة",
      count: "عدد الأسئلة",
      difficulty: "المستوى",
    },

    remedialPlan: {
      title: "خطة علاجية",
      description: "خطة دعم قصيرة لطالب واحد حسب نتيجته.",
      grade: "الصف",
      subject: "المادة",
      score: "النتيجة (من ١٠٠)",
      difficultyTags: "مواضع الصعوبة",
      studentName: "اسم الطالب (اختياري)",
      notes: "ملاحظات (اختياري)",
      notesHint: "اختصِر. لا تكتب تفاصيل حساسة عن الطالب أو أسرته.",
      notice: "يُرسل اسم الطالب والملاحظات إلى خدمة ذكاء اصطناعي خارجية لإنشاء الخطة. تجنّب كتابة تفاصيل حساسة أو معلومات شخصية لا تحتاجها الخطة.",
      noticeAck: "أفهم ذلك",
      noticeRequired: "يجب الإقرار قبل الإنشاء.",
    },

    actions: {
      generate: "إنشاء",
      generating: "جارٍ الإنشاء...",
      cancel: "إلغاء",
      regenerate: "إعادة الإنشاء",
      editOptions: "تعديل الخيارات",
      copy: "نسخ",
      copied: "تم النسخ",
      copyFailed: "تعذّر النسخ. انسخ النص يدويًا.",
      print: "طباعة",
      back: "رجوع",
      retry: "حاول مرة أخرى",
      dismiss: "إغلاق",
    },

    notices: {
      draft: "مسودة من الذكاء الاصطناعي — راجعها قبل الاستخدام.",
      draftLong: "أنشأها الذكاء الاصطناعي من الخيارات التي أدخلتها. راجع المحتوى وصحّحه قبل استخدامه مع الطلاب. القرار قرارك.",
      unavailable: "أداة الذكاء الاصطناعي غير مهيّأة. أضف مفتاح المزوّد لتفعيلها.",
      cancelled: "أُلغي الإنشاء.",
    },

    errors: {
      unauthorized: "انتهت الجلسة. سجّل الدخول من جديد.",
      invalid_input: "بعض الحقول غير صحيحة. تحقق منها وحاول مرة أخرى.",
      ai_not_configured: "أداة الذكاء الاصطناعي غير مهيّأة بعد.",
      rate_limited: "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم حاول.",
      quota_exceeded: "استهلكت حصتك اليومية من الإنشاء. حاول غدًا.",
      ai_output_invalid: "تعذّر إنشاء مسودة صالحة. حاول مرة أخرى.",
      truncated: "أنتج النموذج محتوى مقطوعًا. جرّب عددًا أقل من الأسئلة.",
      failed: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    },

    difficulty: {
      easy: "سهل",
      medium: "متوسط",
      hard: "صعب",
      mixed: "متنوّع",
    },

    questionTypes: {
      mcq: "اختيار من متعدد",
      "true-false": "صح / خطأ",
      short: "إجابة قصيرة",
    },

    teachingStyles: {
      direct: "شرح مباشر",
      inquiry: "استقصاء",
      collaborative: "عمل تعاوني",
      project: "مشروع",
      differentiated: "تعلّم متمايز",
    },

    subjects: {
      math: "الرياضيات",
      science: "العلوم",
      arabic: "اللغة العربية",
      english: "اللغة الإنجليزية",
      "islamic-studies": "التربية الإسلامية",
      "social-studies": "الاجتماعيات",
      ict: "تقنية المعلومات",
    },

    difficultyTags: {
      "foundational-gaps": "فجوات أساسية",
      "reading-comprehension": "فهم المقروء",
      "problem-solving": "حل المسائل",
      vocabulary: "المفردات",
      "procedural-fluency": "الطلاقة الإجرائية",
      "exam-anxiety": "قلق الاختبار",
    },

    duration: {
      "30": "٣٠ دقيقة",
      "45": "٤٥ دقيقة",
      "60": "٦٠ دقيقة",
    },

    result: {
      lessonPlanTitle: "خطة الدرس",
      questionsTitle: "الأسئلة",
      remedialTitle: "الخطة العلاجية",
      objectives: "الأهداف",
      materials: "المواد",
      stages: "مراحل الحصة",
      assessment: "التقويم",
      homework: "الواجب",
      minutes: "{count} دقيقة",
      answerKey: "مفتاح الإجابة",
      correct: "الإجابة الصحيحة",
      answer: "الإجابة",
      modelAnswer: "إجابة نموذجية",
      focusAreas: "مواضع التركيز",
      why: "السبب",
      sessions: "الجلسات",
      suggestedHomework: "واجب مقترح",
      encouragement: "كلمة تشجيعية",
      score: "النتيجة: {score} من ١٠٠",
      name: "الطالب: {name}",
      questionNumber: "سؤال {n}",
    },

    a11y: {
      picker: "قائمة أدوات المعلم",
      optionsForm: "خيارات الأداة",
      resultRegion: "نتيجة الإنشاء",
      busy: "جارٍ إنشاء المسودة",
      selectAtLeastOne: "اختر خيارًا واحدًا على الأقل.",
    },
  },

  en: {
    title: "Teacher tools",
    intro: "Pick a tool, set the options, and get a draft to review.",

    picker: {
      heading: "Choose a tool",
      available: "Available",
    },

    lessonPlan: {
      title: "Lesson plan",
      description: "One lesson with objectives, stages and assessment.",
      grade: "Grade",
      subject: "Subject",
      duration: "Lesson length",
      teachingStyles: "Teaching styles",
      topic: "Topic (optional)",
      topicHint: "Leave it empty and Lumora will choose one suited to the grade and subject.",
    },

    questions: {
      title: "Question set",
      description: "Mixed question types with an answer key.",
      grade: "Grade",
      subject: "Subject",
      topic: "Topic (optional)",
      topicHint: "Leave it empty and Lumora will choose one suited to the grade and subject.",
      questionTypes: "Question types",
      count: "Number of questions",
      difficulty: "Difficulty",
    },

    remedialPlan: {
      title: "Remedial plan",
      description: "A short support plan for one student, from their score.",
      grade: "Grade",
      subject: "Subject",
      score: "Score (out of 100)",
      difficultyTags: "Difficulty areas",
      studentName: "Student name (optional)",
      notes: "Notes (optional)",
      notesHint: "Keep it brief. Do not write sensitive details about the student or their family.",
      notice: "The student's name and your notes are sent to an external AI service to create the plan. Avoid sensitive details or personal information the plan does not need.",
      noticeAck: "I understand",
      noticeRequired: "You must acknowledge this before generating.",
    },

    actions: {
      generate: "Generate",
      generating: "Generating...",
      cancel: "Cancel",
      regenerate: "Regenerate",
      editOptions: "Edit options",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Could not copy. Select the text and copy it manually.",
      print: "Print",
      back: "Back",
      retry: "Try again",
      dismiss: "Dismiss",
    },

    notices: {
      draft: "AI draft — review before use.",
      draftLong: "Generated by AI from the options you entered. Review and correct the content before using it with students. The decision is yours.",
      unavailable: "The AI tool is not configured. Add a provider key to enable it.",
      cancelled: "Generation cancelled.",
    },

    errors: {
      unauthorized: "Your session ended. Sign in again.",
      invalid_input: "Some fields are not valid. Check them and try again.",
      ai_not_configured: "The AI tool is not configured yet.",
      rate_limited: "Too many requests in a short time. Wait a moment and try again.",
      quota_exceeded: "You have used your daily generation quota. Try again tomorrow.",
      ai_output_invalid: "A usable draft could not be produced. Try again.",
      truncated: "The model produced truncated content. Try fewer questions.",
      failed: "Something went wrong. Please try again.",
    },

    difficulty: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      mixed: "Mixed",
    },

    questionTypes: {
      mcq: "Multiple choice",
      "true-false": "True / false",
      short: "Short answer",
    },

    teachingStyles: {
      direct: "Direct instruction",
      inquiry: "Inquiry",
      collaborative: "Collaborative",
      project: "Project-based",
      differentiated: "Differentiated",
    },

    subjects: {
      math: "Mathematics",
      science: "Science",
      arabic: "Arabic",
      english: "English",
      "islamic-studies": "Islamic studies",
      "social-studies": "Social studies",
      ict: "ICT",
    },

    difficultyTags: {
      "foundational-gaps": "Foundational gaps",
      "reading-comprehension": "Reading comprehension",
      "problem-solving": "Problem solving",
      vocabulary: "Vocabulary",
      "procedural-fluency": "Procedural fluency",
      "exam-anxiety": "Exam anxiety",
    },

    duration: {
      "30": "30 minutes",
      "45": "45 minutes",
      "60": "60 minutes",
    },

    result: {
      lessonPlanTitle: "Lesson plan",
      questionsTitle: "Questions",
      remedialTitle: "Remedial plan",
      objectives: "Objectives",
      materials: "Materials",
      stages: "Lesson stages",
      assessment: "Assessment",
      homework: "Homework",
      minutes: "{count} minutes",
      answerKey: "Answer key",
      correct: "Correct answer",
      answer: "Answer",
      modelAnswer: "Model answer",
      focusAreas: "Focus areas",
      why: "Why",
      sessions: "Sessions",
      suggestedHomework: "Suggested homework",
      encouragement: "Encouragement",
      score: "Score: {score} out of 100",
      name: "Student: {name}",
      questionNumber: "Question {n}",
    },

    a11y: {
      picker: "Teacher tool list",
      optionsForm: "Tool options",
      resultRegion: "Generation result",
      busy: "Generating the draft",
      selectAtLeastOne: "Choose at least one option.",
    },
  },
};

/** Fails loudly rather than writing catalogs that disagree. */
function assertSameKeys(a, b, path = "") {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  for (const k of ka) {
    if (!kb.includes(k)) throw new Error(`key "${path}${k}" missing from the other catalog`);
  }
  for (const k of kb) {
    if (!ka.includes(k)) throw new Error(`extra key "${path}${k}"`);
  }
  for (const k of ka) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === "object" && va !== null) {
      if (typeof vb !== "object" || vb === null) throw new Error(`shape mismatch at "${path}${k}"`);
      assertSameKeys(va, vb, `${path}${k}.`);
    } else if (typeof va !== "string" || typeof vb !== "string") {
      throw new Error(`non-string at "${path}${k}"`);
    }
  }
}

function assertPlaceholdersMatch(a, b, path = "") {
  for (const k of Object.keys(a)) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === "object" && va !== null) {
      assertPlaceholdersMatch(va, vb, `${path}${k}.`);
      continue;
    }
    const pa = (va.match(/\{\w+\}/g) ?? []).sort().join(",");
    const pb = (vb.match(/\{\w+\}/g) ?? []).sort().join(",");
    if (pa !== pb) throw new Error(`placeholder mismatch at "${path}${k}": {${pa}} vs {${pb}}`);
  }
}

assertSameKeys(tools.ar, tools.en);
assertPlaceholdersMatch(tools.ar, tools.en);

for (const [file, value] of [
  [AR, tools.ar],
  [EN, tools.en],
]) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  if (json.tools) {
    console.log(`${file}: replacing the existing "tools" namespace`);
  }
  json.tools = value;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`${file}: wrote ${Object.keys(value).length} top-level groups`);
}
