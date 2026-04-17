import { useState, useEffect } from 'react';

const T = {
  // ── Role selection ─────────────────────────────────────────────────────────
  chooseRole: { en: 'Who are you?', ml: 'നിങ്ങൾ ആരാണ്?', ar: 'من أنت؟' },
  chooseRoleSub: {
    en: 'Select your role to continue. This choice is saved on this device.',
    ml: 'തുടരാൻ നിങ്ങളുടെ റോൾ തിരഞ്ഞെടുക്കുക. ഈ ഉപകരണത്തിൽ സേവ് ചെയ്യും.',
    ar: 'اختر دورك للمتابعة. سيتم حفظ هذا الاختيار على هذا الجهاز.'
  },
  rolePicker: { en: 'Picker', ml: 'പിക്കർ', ar: 'المستلم' },
  rolePickerSub: { en: 'I handle goods on the floor', ml: 'ഞാൻ ഗോഡൗണിൽ സാധനങ്ങൾ കൈകാര്യം ചെയ്യുന്നു', ar: 'أتعامل مع البضائع في المستودع' },
  roleAccountant: { en: 'Accountant', ml: 'അക്കൗണ്ടന്റ്', ar: 'المحاسب' },
  roleAccountantSub: { en: 'I verify and match items to the catalog', ml: 'ഞാൻ ഇനങ്ങൾ കാറ്റലോഗുമായി ഒത്തുനോക്കുന്നു', ar: 'أتحقق من الأصناف وأطابقها بالكتالوج' },
  roleManager: { en: 'Manager', ml: 'മാനേജർ', ar: 'المدير' },
  roleManagerSub: { en: 'I monitor throughput and queue', ml: 'ഞാൻ ഔട്ട്പുട്ടും ക്യൂവും നിരീക്ഷിക്കുന്നു', ar: 'أراقب الإنتاجية وقائمة الانتظار' },
  switchRole: { en: 'Switch Role', ml: 'റോൾ മാറ്റുക', ar: 'تغيير الدور' },

  // ── Picker — Step 1 ────────────────────────────────────────────────────────
  scanBill: { en: 'Scan the Bill', ml: 'ബിൽ സ്കാൻ ചെയ്യുക', ar: 'صوّر الفاتورة' },
  scanSub: {
    en: 'Take a photo of the physical bill. The Bill ID and customer name will be read automatically.',
    ml: 'ബില്ലിന്റെ ഫോട്ടോ എടുക്കുക. ബിൽ ID ഞങ്ങൾ വായിക്കും.',
    ar: 'التقط صورة للفاتورة. سنقرأ رقمها واسم العميل تلقائياً.'
  },
  noTypingNeeded: { en: 'No typing needed', ml: 'ടൈപ്പ് ചെയ്യേണ്ട', ar: 'لا حاجة للكتابة' },
  readingBill: { en: 'Reading bill...', ml: 'ബിൽ വായിക്കുന്നു...', ar: 'جارٍ قراءة الفاتورة...' },
  confirmStart: { en: 'Confirm & Start Recording', ml: 'സ്ഥിരീകരിക്കുക', ar: 'تأكيد وابدأ التسجيل' },
  retake: { en: 'Retake', ml: 'വീണ്ടും എടുക്കുക', ar: 'إعادة التصوير' },
  billId: { en: 'Bill ID', ml: 'ബിൽ ID', ar: 'رقم الفاتورة' },
  customer: { en: 'Customer / Company', ml: 'കസ്റ്റമർ / കമ്പനി', ar: 'العميل / الشركة' },
  locationPhone: { en: 'Location · Phone (optional)', ml: 'സ്ഥലം · ഫോൺ', ar: 'الموقع · الهاتف' },
  fieldsExtracted: { en: 'Fields extracted — please verify', ml: 'ഫീൽഡുകൾ വായിച്ചു — ഒന്ന് പരിശോധിക്കുക', ar: 'تم استخراج البيانات — يرجى التحقق' },
  couldNotRead: { en: 'Could not read bill — please fill in', ml: 'ബിൽ വായിക്കാൻ ആകുന്നില്ല — ദയവായി പൂരിപ്പിക്കൂ', ar: 'تعذّر قراءة الفاتورة — يرجى الإدخال يدوياً' },
  uploadingReading: { en: 'Uploading & reading bill...', ml: 'അപ്‌ലോഡ് ചെയ്ത് വായിക്കുന്നു...', ar: 'جارٍ الرفع والقراءة...' },

  // ── Picker — Step 2 ────────────────────────────────────────────────────────
  newBill: { en: 'New Bill', ml: 'പുതിയ ബിൽ', ar: 'فاتورة جديدة' },
  recordHint: {
    en: 'Say what changed — you can list multiple items in one recording',
    ml: 'എന്ത് മാറ്റമുണ്ടായോ അത് പറയൂ — ഒരു റെക്കോർഡിങ്ങിൽ ഒന്നിൽ കൂടുതൽ ഇനങ്ങൾ പറയാം',
    ar: 'قل ما تغيّر — يمكنك ذكر عدة أصناف في تسجيل واحد'
  },
  tapRecord: { en: 'Tap to Record', ml: 'ടാപ്പ് ചെയ്ത് റെക്കോർഡ്', ar: 'اضغط للتسجيل' },
  recording: { en: 'Recording... tap to stop', ml: 'റെക്കോർഡ് ചെയ്യുന്നു... നിർത്താൻ ടാപ്പ്', ar: 'جارٍ التسجيل... اضغط للإيقاف' },
  processing: { en: 'Processing...', ml: 'പ്രോസസ്സ്...', ar: 'معالجة...' },
  added: { en: 'items added', ml: 'ഇനങ്ങൾ ചേർത്തു', ar: 'أُضيفت' },
  clearRecording: { en: 'Clear', ml: 'മായ്ക്കുക', ar: 'مسح' },
  queue: { en: 'Queue', ml: 'ക്യൂ', ar: 'قائمة الانتظار' },
  clearAll: { en: 'Clear All', ml: 'എല്ലാം മായ്ക്കുക', ar: 'مسح الكل' },
  deleteItem: { en: 'Del', ml: 'ഡിൽ', ar: 'حذف' },
  noItemsYet: { en: 'No items yet — record above', ml: 'ഒന്നും ഇല്ല — മുകളിൽ റെക്കോർഡ് ചെയ്യൂ', ar: 'لا توجد عناصر — سجّل أعلاه' },
  items: { en: 'items', ml: 'ഇനങ്ങൾ', ar: 'عناصر' },
  micDenied: { en: 'Microphone access denied', ml: 'മൈക്രോഫോൺ ആക്സസ് നിഷേധിച്ചു', ar: 'تم رفض الوصول إلى الميكروفون' },
  listenHint: { en: 'Listening...', ml: 'ശ്രദ്ധിക്കുന്നു...', ar: 'جارٍ الاستماع...' },

  // ── Picker — Step 3 ────────────────────────────────────────────────────────
  sendAll: { en: 'Send All to Accountant', ml: 'അക്കൗണ്ടന്റിനു അയക്കുക', ar: 'إرسال الكل للمحاسب' },
  sent: { en: 'Sent!', ml: 'അയച്ചു!', ar: 'تم الإرسال!' },
  sendFailed: { en: 'Failed to send. Try again.', ml: 'അയക്കൽ പരാജയപ്പെട്ടു. വീണ്ടും ശ്രമിക്കൂ.', ar: 'فشل الإرسال. حاول مرة أخرى.' },

  // ── New Bill Modal ──────────────────────────────────────────────────────────
  newBillTitle: { en: 'Start New Bill', ml: 'പുതിയ ബിൽ ആരംഭിക്കുക', ar: 'بدء فاتورة جديدة' },
  newBillSub: { en: 'Resets the current session.', ml: 'നിലവിലെ സെഷൻ റീസെറ്റ് ചെയ്യും.', ar: 'سيتم إعادة تعيين الجلسة الحالية.' },
  cancel: { en: 'Cancel', ml: 'റദ്ദാക്കുക', ar: 'إلغاء' },
  startBill: { en: 'Start Bill', ml: 'ആരംഭിക്കുക', ar: 'بدء' },

  // ── Accountant ─────────────────────────────────────────────────────────────
  bills: { en: 'Bills', ml: 'ബില്ലുകൾ', ar: 'الفواتير' },
  live: { en: 'Live', ml: 'ലൈവ്', ar: 'مباشر' },
  pending: { en: 'Pending', ml: 'തീർക്കാത്തവ', ar: 'معلّق' },
  resolved: { en: 'Resolved', ml: 'തീർന്നവ', ar: 'محلول' },
  noPendingBills: { en: 'No pending bills', ml: 'ബില്ലുകൾ ഒന്നും ഇല്ല', ar: 'لا توجد فواتير معلّقة' },
  noResolvedItems: { en: 'No resolved items in last 24h', ml: 'കഴിഞ്ഞ 24 മണിക്കൂറിൽ ഒന്നും ഇല്ل', ar: 'لا توجد عناصر محلولة في آخر 24 ساعة' },
  staleAlert: { en: 'modifications untouched >2h', ml: 'മോഡിഫിക്കേഷനുകൾ 2 മണിക്കൂറിൽ കൂടുതൽ ആയി', ar: 'تعديلات لم تُعالج منذ أكثر من ساعتين' },
  mods: { en: 'mods', ml: 'ഇനം', ar: 'تعديل' },
  left: { en: 'left', ml: 'ബാക്കി', ar: 'متبقٍ' },
  done: { en: 'done', ml: 'പൂർത്തിയായി', ar: 'منتهٍ' },
  verified: { en: 'verified', ml: 'വെരിഫൈ', ar: 'تم التحقق' },
  unknownPicker: { en: 'Unknown picker', ml: 'അജ്ഞാത പിക്കർ', ar: 'مستلم غير معروف' },
  billPhoto: { en: 'Bill photo', ml: 'ബിൽ ഫോട്ടോ', ar: 'صورة الفاتورة' },
  tapToViewFull: { en: 'tap to view full', ml: 'മുഴുവൻ കാണാൻ ടാപ്പ്', ar: 'اضغط لعرض كاملاً' },
  noPhoto: { en: 'No photo', ml: 'ഫോട്ടോ ഇല്ല', ar: 'لا توجد صورة' },
  pickerSkipped: { en: 'picker skipped', ml: 'പിക്കർ ഒഴിവാക്കി', ar: 'تجاوزه المستلم' },
  autoPurge: { en: 'auto-purge', ml: 'ഓട്ടോ ഡിലീറ്റ്', ar: 'حذف تلقائي' },
  autoPurgeOnResolve: { en: 'auto-purge on resolve', ml: 'തീർക്കുമ്പോൾ ഡിലീറ്റ്', ar: 'يُحذف عند الحل' },
  ocrSource: { en: 'Bill photo — OCR source', ml: 'ബിൽ ഫോട്ടോ — OCR ഉറവിടം', ar: 'صورة الفاتورة — مصدر OCR' },
  ocrExtracted: { en: 'OCR extracted', ml: 'OCR ഫലം', ar: 'مستخرج بـ OCR' },
  customerOcr: { en: 'Customer (OCR)', ml: 'ഉപഭോക്താവ് (OCR)', ar: 'العميل (OCR)' },
  noPhotoAttached: { en: 'No photo attached', ml: 'ഫോട്ടോ ഇല്ല', ar: 'لا توجد صورة مرفقة' },
  selectModToVerify: { en: 'Select a modification to verify', ml: 'വെരിഫൈ ചെയ്യാൻ ഒരു ഇനം തിരഞ്ഞെടുക്കൂ', ar: 'اختر تعديلاً للتحقق منه' },
  matchToCatalog: { en: 'Match to product catalog', ml: 'കാറ്റലോഗുമായി ഒത്തുനോക്കൂ', ar: 'طابق مع كتالوج المنتجات' },
  searchCatalog: { en: 'Search name, code, category...', ml: 'പേര്, കോഡ്, കാറ്റഗറി...', ar: 'ابحث عن اسم أو رمز أو فئة...' },
  selectProductFirst: { en: 'Select a product first', ml: 'ആദ്യം ഒരു ഉൽപ്പന്നം തിരഞ്ഞെടുക്കൂ', ar: 'اختر منتجاً أولاً' },
  confirmProduct: { en: 'Confirm', ml: 'ശരിവെക്കുക', ar: 'تأكيد' },
  skip: { en: 'Skip', ml: 'ഒഴിവാക്കുക', ar: 'تخطّ' },
  allCaughtUp: { en: 'All caught up!', ml: 'എല്ലാം തീർന്നു!', ar: 'انتهى الكل!' },
  copyBillId: { en: 'Copy Bill ID', ml: 'ബിൽ ID കോപ്പി', ar: 'نسخ رقم الفاتورة' },
  copied: { en: '✓ Copied!', ml: '✓ കോപ്പി ആയി!', ar: '✓ تم النسخ!' },
  billNumber: { en: 'BILL NUMBER', ml: 'ബിൽ നമ്പർ', ar: 'رقم الفاتورة' },
  duplicatesHidden: { en: 'duplicate recording hidden', ml: 'ഡ്യൂപ്ലിക്കേറ്റ് ഒഴിവാക്കി', ar: 'تسجيل مكرر مخفي' },
  duplicatesHiddenPlural: { en: 'duplicate recordings hidden', ml: 'ഡ്യൂപ്ലിക്കേറ്റുകൾ ഒഴിവാക്കി', ar: 'تسجيلات مكررة مخفية' },
  resolveFailed: { en: 'Failed to resolve. Try again.', ml: 'പരിഹരിക്കൽ പരാജയപ്പെട്ടു.', ar: 'فشل الحل. حاول مجدداً.' },
  photoAutoPurged: { en: 'Photo auto-purged', ml: 'ഫോട്ടോ ഡിലീറ്റ് ആയി', ar: 'تم حذف الصورة تلقائياً' },

  // ── Manager ────────────────────────────────────────────────────────────────
  loadingMetrics: { en: 'Loading metrics...', ml: 'ഡേറ്റ ലോഡ് ചെയ്യുന്നു...', ar: 'جارٍ تحميل البيانات...' },
  billsToday: { en: 'Bills Today', ml: 'ഇന്ന് ബില്ലുകൾ', ar: 'فواتير اليوم' },
  billsProcessedToday: { en: 'bills processed today', ml: 'ഇന്ന് പ്രോസസ് ചെയ്ത ബില്ലുകൾ', ar: 'فواتير معالجة اليوم' },
  resolvedLabel: { en: 'Resolved', ml: 'പൂർത്തിയായി', ar: 'محلول' },
  clearanceRate: { en: 'clearance rate', ml: 'ക്ലിയറൻസ് നിരക്ക്', ar: 'معدل التخليص' },
  pendingMods: { en: 'Pending Mods', ml: 'ബാക്കി ഇനങ്ങൾ', ar: 'تعديلات معلّقة' },
  staleMore2h: { en: 'stale >2h', ml: '2 മണിക്കൂറിലധികം', ar: 'متأخرة >2س' },
  allFresh: { en: 'all fresh', ml: 'എല്ലാം പുതിയതാണ്', ar: 'كلها حديثة' },
  avgResolveTime: { en: 'Avg Resolve Time', ml: 'ശരാശരി സമയം', ar: 'متوسط وقت الحل' },
  goodPace: { en: 'good pace', ml: 'നല്ല വേഗം', ar: 'وتيرة جيدة' },
  needsAttention: { en: 'needs attention', ml: 'ശ്രദ്ധ വേണം', ar: 'يحتاج اهتماماً' },
  needsIntervention: { en: '⚠ Needs intervention', ml: '⚠ ഇടപെടൽ ആവശ്യം', ar: '⚠ يحتاج تدخلاً' },
  throughputByHour: { en: 'Throughput — resolved / hour', ml: 'ഔട്ട്പുട്ട് — ഒരു മണിക്കൂറിൽ', ar: 'الإنتاجية — محلول / ساعة' },
  noResolvedToday: { en: 'No resolved items today', ml: 'ഇന്ന് ഒന്നും ഇല്ல', ar: 'لا توجد عناصر محلولة اليوم' },
  accountantQueueDepth: { en: 'Accountant queue depth', ml: 'അക്കൗണ്ടന്റ് ക്യൂ', ar: 'عمق قائمة المحاسب' },
  noActivityYet: { en: 'No activity yet', ml: 'പ്രവർത്തനം ഇല്ല', ar: 'لا نشاط حتى الآن' },
  clearedToday: { en: 'cleared today', ml: 'ഇന്ന് ക്ലിയർ', ar: 'تم تخليصه اليوم' },
  pickerActivityToday: { en: 'Picker activity today', ml: 'ഇന്ന് പിക്കർ പ്രവർത്തനം', ar: 'نشاط المستلمين اليوم' },
  noPickersActive: { en: 'No pickers active yet', ml: 'പിക്കർമാർ ഇല്ല', ar: 'لا يوجد مستلمون نشطون' },
  systemAlerts: { en: 'System alerts', ml: 'സിസ്റ്റം അലർട്ടുകൾ', ar: 'تنبيهات النظام' },
  allSystemsNormal: { en: '✓ All systems normal', ml: '✓ എല്ലാം ശരിയാണ്', ar: '✓ جميع الأنظمة طبيعية' },
  staleMods: { en: '⚠ Stale modifications', ml: '⚠ കാലഹരണ മോഡിഫിക്കേഷനുകൾ', ar: '⚠ تعديلات متأخرة' },
  staleDetail: { en: 'unresolved items older than 2 hours', ml: '2 മണിക്കൂറിൽ കൂടുതൽ ആയ ഇനങ്ങൾ', ar: 'عناصر لم تُحل منذ أكثر من ساعتين' },
  highQueueDepth: { en: 'High queue depth', ml: 'ക്യൂ നിറഞ്ഞിരിക്കുന്നു', ar: 'عمق قائمة مرتفع' },
  pendingModifications: { en: 'pending modifications', ml: 'ബാക്കി ഉള്ള മോഡിഫിക്കേഷനുകൾ', ar: 'تعديلات معلّقة' },
  pingAccountant: { en: 'Ping Accountant', ml: 'അക്കൗണ്ടന്റിനെ അറിയിക്കൂ', ar: 'نبّه المحاسب' },
  pinged: { en: 'Pinged!', ml: 'അറിയിച്ചു!', ar: 'تم التنبيه!' },
  submittedTime: { en: 'submitted', ml: 'സബ്മിറ്റ്', ar: 'مُقدَّم' },

  // ── Catalog upload ─────────────────────────────────────────────────────────
  uploadCatalogCsv: { en: 'Upload Catalog CSV', ml: 'കാറ്റലോഗ് CSV അപ്ലോഡ്', ar: 'رفع ملف CSV للكتالوج' },
  uploadingCsv: { en: 'Uploading...', ml: 'അപ്ലോഡ് ചെയ്യുന്നു...', ar: 'جارٍ الرفع...' },
  catalogUpdated: { en: 'products updated', ml: 'ഉൽപ്പന്നങ്ങൾ അപ്ഡേറ്റ് ആയി', ar: 'منتجات مُحدَّثة' },
  uploadFailed: { en: 'Upload failed', ml: 'അപ്ലോഡ് പരാജയപ്പെട്ടു', ar: 'فشل الرفع' },
  csvFormat: { en: 'CSV: Name_EN, Code, Unit, Category, Name_ML, Alt_Names', ml: 'CSV ഫോർമാറ്റ്: Name_EN, Code, Unit, Category', ar: 'تنسيق CSV: Name_EN, Code, Unit, Category' },

  // ── Picker — voice / transcript ────────────────────────────────────────────
  whatYouSaid: { en: 'What you said', ml: 'നിങ്ങൾ പറഞ്ഞത്', ar: 'ما قلته' },
  aiMatched: { en: 'AI matched', ml: 'AI ഒത്തുനോക്കി', ar: 'تطابق AI' },
  scanNewBill: { en: 'Scan New Bill Photo', ml: 'പുതിയ ബിൽ സ്കാൻ ചെയ്യുക', ar: 'صوّر فاتورة جديدة' },
  orEnterManually: { en: 'or enter details manually', ml: 'അല്ലെങ്കിൽ നേരിട്ട് നൽകൂ', ar: 'أو أدخل التفاصيل يدوياً' },
  newBillWarning: { en: 'Current queue will be cleared', ml: 'നിലവിലെ ക്യൂ മായ്ക്കും', ar: 'سيتم مسح القائمة الحالية' },

  // ── Accountant — quick actions ─────────────────────────────────────────────
  resolveAll: { en: 'Resolve All', ml: 'എല്ലാം ശരിവെക്കുക', ar: 'حل الكل' },
  rejectAll: { en: 'Reject All', ml: 'എല്ലാം നിരസിക്കുക', ar: 'رفض الكل' },

  // ── Accountant — reject ────────────────────────────────────────────────────
  rejectLabel: { en: 'Reject', ml: 'നിരസിക്കുക', ar: 'رفض' },
  rejectedTab: { en: 'Rejected', ml: 'നിരസിച്ചവ', ar: 'مرفوض' },
  noRejectedItems: { en: 'No rejected items in last 7 days', ml: 'കഴിഞ്ഞ 7 ദിവസം ഒന്നും നിരസിച്ചിട്ടില്ല', ar: 'لا توجد عناصر مرفوضة في آخر 7 أيام' },
  rejectFailed: { en: 'Failed to reject. Try again.', ml: 'നിരസിക്കൽ പരാജയപ്പെട്ടു.', ar: 'فشل الرفض. حاول مجدداً.' },
  rejectedBy: { en: 'Rejected by', ml: 'നിരസിച്ചത്', ar: 'رفض بواسطة' },
  aiSuggested: { en: 'AI suggested', ml: 'AI നിർദ്ദേശം', ar: 'اقتراح AI' },
  today: { en: 'Today', ml: 'ഇന്ന്', ar: 'اليوم' },
  yesterday: { en: 'Yesterday', ml: 'ഇന്നലെ', ar: 'أمس' },

  // ── Manager — simplified ───────────────────────────────────────────────────
  managerBoard: { en: 'Manager Board', ml: 'മാനേജർ ബോർഡ്', ar: 'لوحة المدير' },
  pendingLabel: { en: 'Pending', ml: 'ബാക്കി', ar: 'معلّق' },
  doneLabel: { en: 'Done', ml: 'പൂർത്തി', ar: 'منجز' },
  rejectedLabel: { en: 'Rejected', ml: 'നിരസിച്ചു', ar: 'مرفوض' },
  needsAttention: { en: 'Needs Attention', ml: 'ശ്രദ്ധ ആവശ്യം', ar: 'يحتاج اهتماماً' },
  waitingTime: { en: 'waiting', ml: 'കാക്കുന്നു', ar: 'انتظار' },
  pickerActivity: { en: 'Picker Activity', ml: 'പിക്കർ പ്രവർത്തനം', ar: 'نشاط المستلمين' },
  last7Days: { en: 'Last 7 Days', ml: 'കഴിഞ്ഞ 7 ദിവസം', ar: 'آخر 7 أيام' },
  endOfDayAlert: { en: 'End of Day — Items Not Processed!', ml: 'ദിവസം തീരുന്നു — ഇനങ്ങൾ ബാക്കി!', ar: 'نهاية اليوم — عناصر لم تُعالج!' },
  itemsPending: { en: 'items still pending', ml: 'ഇനങ്ങൾ ബാക്കിയാണ്', ar: 'عناصر لا تزال معلّقة' },
  noActivityYetToday: { en: 'No activity today', ml: 'ഇന്ന് പ്രവർത്തനം ഇല്ല', ar: 'لا نشاط اليوم' },
  historyEmpty: { en: 'No history yet', ml: 'ചരിത്രം ഇല്ല', ar: 'لا يوجد سجل بعد' },
  items: { en: 'items', ml: 'ഇനം', ar: 'عناصر' },
  submitted: { en: 'submitted', ml: 'സബ്മിറ്റ്', ar: 'مُقدَّم' },
};

// Map UI lang code to Whisper language code
export const WHISPER_LANG = { en: undefined, ml: 'ml', ar: 'ar' };

export function useLanguage() {
  const [lang, setLang] = useState(() => localStorage.getItem('wv-lang') || 'en');

  useEffect(() => {
    localStorage.setItem('wv-lang', lang);
  }, [lang]);

  const t = (key) => T[key]?.[lang] || T[key]?.en || key;

  return { lang, setLang, t, isRtl: lang === 'ar' };
}
