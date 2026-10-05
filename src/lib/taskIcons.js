const iconRules = [
  { icon: "prayer", pattern: /صلا[ةه]|prayer|salah/i },
  { icon: "quran", pattern: /قرآن|قران|مصحف|ورد|أذكار|اذكار|ذكر|حفظ سورة|quran|koran|adhkar|dhikr/i },
  { icon: "fitness", pattern: /نادي|تمرين|رياض[ةه]|جري|ركض|مشي|سباح[ةه]|دراج[ةه]|gym|workout|exercise|run|jog|walk|swim|cycling/i },
  { icon: "shower", pattern: /استحمام|دش|حمام|shower|bath/i },
  { icon: "cooking", pattern: /طبخ|اطبخ|إعداد الطعام|اعداد الطعام|تحضير الطعام|cook|cooking|meal prep/i },
  { icon: "meal", pattern: /فطور|إفطار|افطار|غداء|عشاء|طعام|وجب[ةه]|breakfast|lunch|dinner|meal|eat/i },
  { icon: "laundry", pattern: /غسيل الملابس|غسل الملابس|كي الملابس|laundry|wash clothes|ironing/i },
  { icon: "shopping", pattern: /تسوق|مشتريات|شراء|بقال[ةه]|سوبر ?ماركت|shopping|grocer|buy|store/i },
  { icon: "cleaning", pattern: /تنظيف|ترتيب|غرف[ةه]|منزل|بيت|مطبخ|clean|tidy|organize|room|house|home/i },
  { icon: "coding", pattern: /برمج[ةه]|كود|تطوير موقع|تطوير تطبيق|حاسوب|كمبيوتر|program|coding|code|develop|software|computer/i },
  { icon: "email", pattern: /بريد|إيميل|ايميل|email|inbox/i },
  { icon: "call", pattern: /مكالم[ةه]|اتصال|اتصل|هاتف|call|phone/i },
  { icon: "meeting", pattern: /اجتماع|مقابل[ةه]|لقاء|عرض تقديمي|meeting|interview|presentation/i },
  { icon: "travel", pattern: /سفر|طائر[ةه]|مطار|رحل[ةه]|travel|flight|airport|plane/i },
  { icon: "commute", pattern: /ذهاب|عود[ةه]|مواصلات|قياد[ةه]|سيار[ةه]|commute|drive|transport|bus|car/i },
  { icon: "medicine", pattern: /دواء|علاج|حبوب|صيدلي[ةه]|medicine|medication|pill|pharmacy/i },
  { icon: "health", pattern: /طبيب|دكتور|مستشفى|عياد[ةه]|فحص|تحاليل|doctor|hospital|clinic|checkup|medical/i },
  { icon: "sleep", pattern: /نوم|قيلول[ةه]|استيقاظ|استيقظ|sleep|nap|wake/i },
  { icon: "finance", pattern: /بنك|فاتور[ةه]|دفع|ميزاني[ةه]|حسابات|مال|bank|bill|payment|budget|finance|money/i },
  { icon: "writing", pattern: /كتاب[ةه]|مقال|تدوين|ملاحظات|بحث|write|writing|article|journal|notes|research/i },
  { icon: "creative", pattern: /تصميم|رسم|مونتاج|تصوير|موسيقى|design|draw|paint|edit video|photography|music/i },
  { icon: "family", pattern: /أسرت|اسرت|عائل|والد|والد[ةه]|أطفال|اطفال|زوج|family|parents|kids|children/i },
  { icon: "study", pattern: /مذاكر|دراس|واجب|محاضر|امتحان|اختبار|مراجع[ةه]|study|school|homework|lecture|exam|revision/i },
  { icon: "book", pattern: /كتاب|قراء[ةه]|صفح[ةه]|read|book|pages/i },
  { icon: "appointment", pattern: /موعد|حجز|مناسب[ةه]|appointment|reservation|event/i },
  { icon: "work", pattern: /عمل|دوام|وظيف[ةه]|مشروع|تقرير|عميل|مهم[ةه] العمل|work|office|job|project|report|client/i },
];

const categoryIcons = {
  worship: "quran",
  health: "fitness",
  study: "study",
  growth: "book",
  work: "work",
  family: "family",
  personal: "task",
};

export function inferTaskIcon(title, category = "personal", kind = "task") {
  if (kind === "prayer") return "prayer";
  if (kind === "adhkar") return "quran";
  const normalizedTitle = String(title || "").trim();
  const matchedRule = iconRules.find((rule) => rule.pattern.test(normalizedTitle));
  return matchedRule?.icon || categoryIcons[category] || "task";
}

export function inferTaskCategory(title) {
  const normalizedTitle = String(title || "").trim();
  if (/صلا[ةه]|قرآن|قران|مصحف|ورد|أذكار|اذكار|ذكر|quran|koran|adhkar|dhikr|prayer|salah/i.test(normalizedTitle)) return "worship";
  if (/أسرت|اسرت|عائل|والد|والد[ةه]|أطفال|اطفال|زوج|family|parents|kids|children/i.test(normalizedTitle)) return "family";
  if (/نادي|تمرين|رياض[ةه]|جري|ركض|مشي|سباح[ةه]|دراج[ةه]|طبيب|دكتور|مستشفى|عياد[ةه]|دواء|علاج|نوم|gym|workout|exercise|run|walk|swim|doctor|hospital|clinic|medicine|sleep|nap/i.test(normalizedTitle)) return "health";
  if (/مذاكر|دراس|واجب|محاضر|امتحان|اختبار|مراجع[ةه]|study|school|homework|lecture|exam|revision/i.test(normalizedTitle)) return "study";
  if (/عمل|دوام|وظيف[ةه]|مشروع|تقرير|عميل|برمج[ةه]|كود|اجتماع|بريد|إيميل|ايميل|work|office|job|project|report|client|program|coding|software|meeting|email|inbox/i.test(normalizedTitle)) return "work";
  if (/كتاب|قراء[ةه]|صفح[ةه]|كتاب[ةه]|مقال|تدوين|بحث|تصميم|رسم|read|book|pages|write|article|journal|research|design|draw|paint/i.test(normalizedTitle)) return "growth";
  return "personal";
}
