/**
 * Copy for the public landing page, written separately in each language.
 *
 * Arabic is not a translation of the English and the reverse: each is written in
 * the register a Bahraini teacher would use. Nothing here claims a capability the
 * product does not have, and no number appears that is not computed from real
 * data, so none appears at all.
 */
export const LANDING = {
  ar: {
    eyebrow: "للمعلم البحريني .. من أجل جيل أكثر تميزاً",
    // The slogan is the headline. It states what the product is for, in the
    // teacher's own register, and it is the line the brand is built on — a
    // description of the software underneath would only repeat the eyebrow.
    headline: { lead: "نرتقي بالمعلم،", accent: "", rest: "لنرتقي بالوطن" },
    lead:
      "منصة تعمل بالعربية والإنجليزية، ترتّب لك يومك الدراسي: من يتابع، ومن يحتاج تنبيهًا، وما الدرس التالي. أنت تقرر، والمنصة تُعدّ.",
    primaryCta: "ابدأ الآن",
    secondaryCta: "شاهد عرض توضيحي",
    nav: [
      { href: "#features", label: "الميزات" },
      { href: "#how", label: "كيف تعمل" },
      { href: "/privacy", label: "الخصوصية" },
      { href: "#contact", label: "تواصل معنا" },
    ],
    loginLabel: "تسجيل الدخول",
    featuresTitle: "أدوات يومية، لا مظاهر.",
    featuresIntro: "أربع أدوات تغطي أهم ما يشغل المعلم في الإعدادية، مبنية على بيانات صفك الحقيقية.",
    features: [
      {
        key: "students",
        title: "متابعة الطلاب",
        line: "سجل الصف والحضور والدرجات في مكان واحد، مرتبًا كما تراه في دفترك.",
      },
      {
        key: "alerts",
        title: "تنبيهات مدروسة",
        line: "ننبهك حين تتغير نتيجة أو يتكرر غياب واجب — مع سند رقمي لكل جملة.",
      },
      {
        key: "plans",
        title: "خطة الدرس",
        line: "خطة كاملة قابلة للتعديل والطباعة، من أهداف الدرس حتى التقويم الختامي.",
      },
      {
        key: "exams",
        title: "إنشاء الاختبارات",
        line: "أسئلة من أنواع مختلفة، مع الإجابة النموذجية وتوزيع الدرجات.",
      },
    ],
    howTitle: "كيف تعمل",
    howSteps: [
      { title: "أضف صفك", body: "أدخل أسماء طلابك وصفوفهم. البيانات لك وحدك، ولا يراها أحد غيرك." },
      { title: "سجّل ما يجري", body: "الدرجات والواجبات والمتابعات تُسجل بأبسط صيغة ممكنة." },
      { title: "اقرأ ما يهم اليوم", body: "ملخص صباحي يقول لك من يحتاج انتباهك، ولماذا، بأرقام تُراجعها." },
    ],
    showcaseTitle: "مساحة عمل هادئة",
    showcaseBody:
      "لوحة واحدة تجمع الطلاب والتنبيهات وخطة الدرس، على الجهاز الذي تفتحه صباحًا. الصورة أعلاه رسم توضيحي لا لقطة من المنتج.",
    aboutTitle: "نبذة",
    aboutBody:
      "لومورا مبادرة مستقلة للمعلمين في مملكة البحرين، بدأت بالمرحلة الإعدادية. لا تتبع وزارة التربية والتعليم، ولا تنتحل صفتها.",
    aboutCta: "عن لومورا",
    contactTitle: "تواصل معنا",
    contactBody: "للأسئلة والملاحظات: نرد على كل رسالة نصلت إلينا.",
    footerTagline: "نرتقي بالمعلم، لنرتقي بالوطن",
  },
  en: {
    eyebrow: "For the Bahraini teacher — for a stronger generation",
    headline: { lead: "We elevate the teacher,", accent: "", rest: "to elevate the nation" },
    lead:
      "A bilingual workspace that orders your school day: who is keeping up, who needs a word, what you teach next. You decide; the platform prepares.",
    primaryCta: "Get started",
    secondaryCta: "See a walkthrough",
    nav: [
      { href: "#features", label: "Features" },
      { href: "#how", label: "How it works" },
      { href: "/privacy", label: "Privacy" },
      { href: "#contact", label: "Contact" },
    ],
    loginLabel: "Sign in",
    featuresTitle: "Daily tools, not decoration.",
    featuresIntro:
      "Four tools covering what actually fills an intermediate-stage teacher's day, built on your own class data.",
    features: [
      {
        key: "students",
        title: "Student tracking",
        line: "Roster, attendance and grades in one place, ordered the way your notebook is.",
      },
      {
        key: "alerts",
        title: "Considered alerts",
        line: "A signal when a mark slips or work goes missing — with evidence behind every sentence.",
      },
      {
        key: "plans",
        title: "Lesson plans",
        line: "A complete plan you can edit and print, from objectives to the closing task.",
      },
      {
        key: "exams",
        title: "Exam builder",
        line: "Questions of several kinds, with model answers and a mark distribution.",
      },
    ],
    howTitle: "How it works",
    howSteps: [
      { title: "Add your class", body: "Enter your students and their classes. The data is yours; nobody else reads it." },
      { title: "Record what happens", body: "Marks, homework and interventions, entered in the fewest steps possible." },
      { title: "Read what matters today", body: "A morning brief telling you who needs attention and why, in numbers you can check." },
    ],
    showcaseTitle: "A calm workspace",
    showcaseBody:
      "One screen for students, alerts and the next lesson, on the device you open in the morning. The image is an illustration, not a product screenshot.",
    aboutTitle: "About",
    aboutBody:
      "Lumora is an independent initiative for teachers in the Kingdom of Bahrain, starting with the intermediate stage. It is not affiliated with, or endorsed by, the Ministry of Education.",
    aboutCta: "About Lumora",
    contactTitle: "Contact",
    contactBody: "Questions and notes: every message reaches us.",
    footerTagline: "We elevate the teacher, to elevate the nation",
  },
} as const;

export type LandingLocale = keyof typeof LANDING;