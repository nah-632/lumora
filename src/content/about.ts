/**
 * About page copy, both locales. Static content rather than a message key: it is
 * read by one page and outlives the UI catalogue.
 *
 * Claims are limited to what the product actually is. No adoption numbers, no
 * school partnerships, no ministry endorsement — none of those are true yet.
 */
export const ABOUT = {
  ar: {
    title: "عن لومورا",
    slogan: "نرتقي بالمعلم ، لنرتقي بالوطن",
    lead: "لومورا مساعد ذكي عربي-أولًا لمعلمي المرحلة الإعدادية في مدارس البحرين: يسجّل الدرجات والواجبات، ثم يلفت انتباهك إلى ما يستحق المتابعة، ويترك القرار لك.",
    sections: [
      {
        heading: "الفكرة",
        body: "المعلم يعرف طلابه أكثر من أي نظام. لكن المعلومة التي تفيد — أن درجة طالب بدأت تنحدر، أو أن واجبين لم يُسلّما — تبقى موزّعة بين أوراق وأدوات. لومورا يجمع السجل في مكان واحد، ويجعل الحساب حتميًا في الكود، ويستخدم الذكاء الاصطناعي للتفسير فقط: يصوغ التنبيه بالعربية وبالإنجليزية، ولا يحسب ولا يخمّن أسماء ولا أسبابًا.",
      },
      {
        heading: "المبادئ",
        body: "الخصوصية أولًا: اسم الطالب لا يُرسل إلى أي مزوّد ذكاء اصطناعي، والإشارات تُرسل بمراجع غير معرِّفة (s1، s2). والعزل بنيوي: كل معلم يرى طلابه فقط، والقيود مفروضة في قاعدة البيانات نفسها لا في الواجهة. والقرار للمعلم، دائمًا.",
      },
      {
        heading: "النطاق الآن",
        body: "النسخة الحالية تعمل على المرحلة الإعدادية، وباللغتين العربية والإنجليزية، على الويب بمفهوم الجوال أولًا. لا توجد إعلانات، ولا بيع بيانات، ولا وصول من جهات أخرى إلى سجلات طلابك.",
      },
    ],
  },
  en: {
    title: "About Lumora",
    slogan: "We elevate the teacher, to elevate the nation.",
    lead: "Lumora is an Arabic-first assistant for middle-school teachers in Bahrain. It records grades and submissions, points out what is worth following up, and leaves the decision to you.",
    sections: [
      {
        heading: "The idea",
        body: "A teacher knows their students better than any system does. But the information that actually helps — a student's marks have started drifting, two assignments never arrived — stays scattered across paper and tools. Lumora keeps the record in one place, does the arithmetic deterministically in code, and uses AI only to interpret: it writes the sentence, never the numbers, the names or the causes.",
      },
      {
        heading: "The principles",
        body: "Privacy first: a student's name is never sent to an AI provider; signals travel as opaque references (s1, s2). Isolation is structural: each teacher sees only their own students, enforced in the database rather than in the interface. And the decision is always the teacher's.",
      },
      {
        heading: "What exists today",
        body: "The current version covers middle school, in Arabic and English, on the web with a mobile-first layout. There are no adverts, no data sales, and no other party has access to your students' records.",
      },
    ],
  },
} as const;

export type AboutCopy = (typeof ABOUT)["ar"];
