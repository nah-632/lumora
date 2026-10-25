/**
 * Privacy policy copy, both locales.
 *
 * Written against what the code actually does and verified in this repository:
 * the AI payload contains no names (guarded in generate-alerts.ts), the AI
 * provider is configurable and absent by default, and logs carry ids rather than
 * keys.
 *
 * Legal review status: see LEGAL_REVIEW. The Product Owner confirmed the legal
 * review is complete (DECISIONS.md ADR-011), so no review notice is rendered and
 * no public page claims otherwise — constitution section 9.
 *
 * The version and effective date are what remain mandatory on the page: a policy
 * without them cannot be cited in a dispute.
 */
export const LEGAL_REVIEW = {
  status: "complete",
  /** Bump when the policy changes; version and date are rendered, not stored twice. */
  version: "1.0",
  effectiveDate: "2026-10-25",
} as const;

export const PRIVACY = {
  ar: {
    title: "سياسة الخصوصية",
    sections: [
      {
        heading: "ما الذي نجمعه",
        body: "حساب المعلم: الاسم والبريد الإلكتروني، وكلمة المرور محفوظة مُشفَّرة أحاديًا في خدمة المصادقة ولا نراها. وبيانات الطلاب التي تدخلها أنت: الاسم والصف والفصل والدرجات والواجبات والتدخلات. لا نجمع جهات اتصال، ولا موقعًا، ولا معرّفات إعلانية، ولا نتتبّع سلوكك خارج التطبيق.",
      },
      {
        heading: "من يرى البيانات",
        body: "أنت فقط. كل جدول يخص الطلاب مربوط بمعرّف المعلم، وقاعدة البيانات نفسها ترفض أي قراءة أو كتابة تخصّ معلمًا آخر، حتى لو استُخدم معرّف طالب صحيح. لا أحد لديه وصول افتراضي إلى سجلاتك.",
      },
      {
        heading: "الذكاء الاصطناعي",
        body: "عند طلب التحليل تُرسل الإشارات إلى مزوّد النموذج: النسب المئوية والانخفاض وأعداد التقييمات وأعداد الواجبات غير المسلّمة، ويُشار إلى الطالب بمرجع مثل s1 بدل الاسم. الكود يفحص الحمولة قبل الإرسال ويوقف الطلب إن ظهر أي اسم. لا تُرسل ملاحظات النص الحر ولا أسماء الواجبات. وإن لم يكن المزوّد مهيّأ، لا يُرسل شيء.",
      },
      {
        heading: "مدة الاحتفاظ",
        body: "تبقى بيانات الطالب حتى تحذفه. الحذف يُخفيه وسجلاته فورًا من كل شاشة، ويحفظها 30 يومًا للاسترجاع، ثم تُحذف نهائيًا مع درجاته وواجباته وتنبيهاته. يبقى سطر تدقيق واحد بلا اسم: أن حذفًا نهائيًا نُفّذ ومتى.",
      },
      {
        heading: "حقوقك",
        body: "يمكنك تصدير سجلات طلابك أو حذفها في أي وقت، وطلب حذف حسابك كاملًا. نستجيب لطلب الوصول أو التصحيح أو الحذف خلال 30 يومًا، عدا ما يقتضيه القانون أو تدقيق أمني.",
      },
      {
        heading: "الأمان",
        body: "الاتصال مشفّر، والجلسة محفوظة في كوكي لا تقرأه جافاسكربت، ولا تُطبع مفاتيح في السجلات، ولا يُبنى التحكم في الوصول على إخفاء عناصر الواجهة.",
      },
      {
        heading: "الاتصال",
        body: "لأي سؤال عن الخصوصية راسل مالك الخدمة على العنوان المنشور في صفحة «عن لومورا»، واكتب «خصوصية» في موضوع الرسالة ليصل طلبك إلى الوجهة الصحيحة.",
      },
    ],
  },
  en: {
    title: "Privacy policy",
    sections: [
      {
        heading: "What we collect",
        body: "Your teacher account: name and email address; the password is stored hashed by the authentication service and is never visible to us. The student data you enter: name, grade, class, grades, submissions and interventions. We do not collect contacts, location, advertising identifiers, or your behaviour outside the app.",
      },
      {
        heading: "Who can see it",
        body: "You. Every student table is bound to a teacher id, and the database itself refuses any read or write belonging to another teacher, even with a valid-looking student id. No member of staff has default access to your records.",
      },
      {
        heading: "AI processing",
        body: "When you request analysis, signals are sent to the model provider: percentages, deltas, counts of assessments and counts of missing submissions, with the student referenced as s1 rather than by name. The code checks the payload before sending and aborts if any name appears. Free-text feedback and assignment names are never sent. With no provider configured, nothing is sent at all.",
      },
      {
        heading: "Retention",
        body: "Student data stays until you delete it. Deleting hides the student and their records from every screen immediately, keeps them restorable for 30 days, then removes them permanently along with their grades, submissions and alerts. One audit line remains without a name: that a permanent deletion ran, and when.",
      },
      {
        heading: "Your rights",
        body: "You can export or delete your students' records at any time, and ask for your whole account to be deleted. We answer access, correction and deletion requests within 30 days, except for what law or a security audit requires us to keep.",
      },
      {
        heading: "Security",
        body: "Traffic is encrypted, sessions live in cookies that scripts cannot read, no secrets are printed to logs, and access control is never implemented by hiding interface elements.",
      },
      {
        heading: "Contact",
        body: "For any privacy question, write to the service owner at the address published on the About page, with the word privacy in the subject line so it reaches the right place.",
      },
    ],
  },
} as const;

export const TERMS = {
  ar: {
    title: "شروط الاستخدام",
    sections: [
      {
        heading: "الخدمة",
        body: "لومورا أداة تنظيم وتحليل لمعلمي المرحلة الإعدادية. تسجّل الدرجات والواجبات وتقترح ما يستحق المتابعة. هي ليست جهة تقييم رسمية، ولا تصدر وثائق، ولا تحلّ محل السجل المدرسي المعتمد.",
      },
      {
        heading: "الحساب",
        body: "الحساب شخصي للمعلم المسؤول عن البيانات التي يدخلها. لا تشارك بيانات الدخول. أنت مسؤول عن دقة البيانات وعن موافقتك المؤسسية على إدخال بيانات الطلاب، حيثما كان ذلك مطلوبًا.",
      },
      {
        heading: "حدود الذكاء الاصطناعي",
        body: "التحليل يفسّر بيانات مسجّلة، وقد يخطئ في الصياغة. لا نضمن دقته التربوية، ولا يُقصد به قرارًا آليًا في شأن طالب. راجع ما يظهر لك، والقرار قرارك.",
      },
      {
        heading: "الملكية",
        body: "بيانات طلابك ملكك. نمنحك رخصة استخدام شخصية غير حصرية للأداة أثناء اشتراكك. ولنا الحق في تعليق الحساب عند إساءة الاستخدام أو محاولة الوصول إلى بيانات معلم آخر.",
      },
      {
        heading: "الاستخدام المقبول",
        body: "يُمنع محاولة تجاوز العزل بين الحسابات، أو استخراج بيانات غيرك، أو استعمال الخدمة لمراقبة أفراد خارج سياق العمل التربوي، أو أي استخدام يخالف أنظمة مملكة البحرين.",
      },
      {
        heading: "التغييرات",
        body: "قد نحدّث هذه الشروط. تُنشر التغييرات هنا قبل سريانها، ويُعطى المستخدم إشعارًا حين تكون التغييرات جوهرية.",
      },
      {
        heading: "الاتصال",
        body: "لأي مسألة تعاقدية راسل مالك الخدمة على العنوان المنشور في صفحة «عن لومورا».",
      },
    ],
  },
  en: {
    title: "Terms of use",
    sections: [
      {
        heading: "The service",
        body: "Lumora is an organisation and analysis tool for middle-school teachers. It records grades and submissions and suggests what is worth following up. It is not an official assessment authority, it does not issue documents, and it does not replace the school's official record.",
      },
      {
        heading: "Your account",
        body: "An account is personal to the teacher responsible for the data entered. Do not share credentials. You are responsible for the accuracy of the data and for any institutional approval required to enter student data.",
      },
      {
        heading: "The limits of AI",
        body: "The analysis interprets recorded data and can be wrong in how it is worded. Its educational accuracy is not guaranteed, and it is not meant to be an automated decision about a student. Review what you see; the decision is yours.",
      },
      {
        heading: "Ownership",
        body: "Your students' data belongs to you. We grant you a personal, non-exclusive licence to use the tool while your account is active. We may suspend an account for misuse or for attempts to reach another teacher's data.",
      },
      {
        heading: "Acceptable use",
        body: "Do not attempt to bypass isolation between accounts, extract data that is not yours, use the service to surveil people outside an educational relationship, or use it in breach of the laws of the Kingdom of Bahrain.",
      },
      {
        heading: "Changes",
        body: "These terms may be updated. Changes are published here before they take effect, and users are notified when a change is material.",
      },
      {
        heading: "Contact",
        body: "For any contractual question, write to the service owner at the address published on the About page.",
      },
    ],
  },
} as const;