# EMS Club V1.2 — دليل الربط بدون أوامر من جهازك

## ماذا في الملف؟
هذه نسخة واجهة معاد تنسيقها بالأزرق البحري والفيروزي والأخضر، فيها حركات وانتقالات محسّنة. حافظنا على برمجة V1.1 والجداول دون تغيير للبيانات. لم نؤكد بعد حل خطأ تأسيس الرئيس على Cloudflare. ميزات QR والشهادات وربط Google ورفع الصور دون R2 غير مكتملة.

## أنت لديك مسبقًا
- Cloudflare Worker باسم `ems-alghadjed`
- قاعدة D1 باسم `ems-club-db`.
- سر BOOTSTRAP_KEY في إعدادات Worker.
**لا تحذف الثلاثة. ولا تعيد تنفيذ schema.sql**.

## البرامج المطلوبة
1) المتصفح: Edge أو Chrome (موجود عندك). 2) حساب GitHub مجاني. 3) حساب Cloudflare الموجود عندك. **لا تحتاج PowerShell أو Node.js على جهازك للتحديث بعد ربط GitHub**.

## إنشاء المستودع
1. افتح https://github.com ثم سجل الدخول أو أنشئ حسابًا.
2. من علامة + اختر New repository.
3. اكتب EMS-Club-Alghad وحدد Private ثم Create repository.
4. افتح الملف المضغوط واستخرج **المحتويات** من مجلد EMS_CLUB_V1_2_STUDIO إلى مجلد بالكمبيوتر.
5. افتح المستودع واضغط uploading an existing file أو Add file → Upload files.
6. ارفع من جذر الحزمة الملفات والمجلدات: `wrangler.toml`, `schema.sql`, `src`, `public`, `README_AR.md` (إذا لم يسمح المتصفح برفع المجلدات، اسحب محتويات المجلد المستخرج بالكامل إلى مربع الرفع، أو استخدم GitHub web editor لإضافة الملفات والمسارات). تأكد أن `wrangler.toml` في الجذر وليس داخل مجلد إضافي.
7. اضغط Commit changes على فرع main.

## ربط المشروع الحالي
1. Cloudflare Dashboard → Workers & Pages → ems-alghadjed → Settings → Builds.
2. اختر GitHub الموجود تحت Git repository.
3. إذا طلب GitHub تفويضًا، اختر الوصول للمستودع `EMS-Club-Alghad` فقط ووافق.
4. اختر المستودع نفسه وفرع main.
5. في إعدادات البناء: Root directory `/`، Build command فارغ، Deploy command `npx wrangler deploy`.
6. اضغط Save أو Connect ثم شغّل أول بناء عند مطالبتك أو نفّذ Commit جديد إلى main من GitHub.
7. Cloudflare → Deployments (أو Builds) → تحقق من نجاح أحدث Build. الرابط القديم نفسه يبقى إن تم ربط Worker الموجود لا إنشاء Worker جديد.

## كل تحديث لاحق
1. خذ مني نسخة مشروع جديدة بنفس الملفات.
2. افتح GitHub → مستودع EMS-Club-Alghad → Add file → Upload files.
3. ارفع **محتويات النسخة** بنفس المسارات مع الاستبدال، واضغط Commit changes على main.
4. Cloudflare ينشر التحديث تلقائيًا؛ تأكد من Ready. بعض تغييرات الجداول تحتاج ترحيل قاعدة منفصل، ولا ترفع `schema.sql` إلى D1 عشوائيًا.

## إنشاء الرئيس
1. بعد نجاح ربط ونشر الإصدار افتح رابط الموقع الحالي → تسجيل الدخول → تأسيس حساب الرئيس.
2. أدخل BOOTSTRAP_KEY الموجود عندك دون مشاركته، واختر كلمة مرور لا تقل عن 14 حرفًا.
3. إذا نجح، سجّل الدخول باسم `president`، ثم احذف BOOTSTRAP_KEY من Cloudflare Settings → Variables and Secrets **بعد التأكد من دخول الرئيس**.
4. إذا فشل مرة أخرى، فعّل Logs من Cloudflare Settings → Observability، ثم راقب سجلات الأخطاء (دون مشاركة أسرار). **لا تُعد إنشاء قاعدة البيانات**.

## ملاحظات أمنية
- المستودع خاص. لا ترفع كلمات مرور أو ملف .env أو مفاتيح دخول.
- هذه نسخة تأسيسية؛ لا تدخل بيانات طلاب حقيقية قبل اختبار الصلاحيات والخصوصية والنسخ الاحتياطية واعتماد الكلية.
- ملف wrangler.toml يتضمن رقم قاعدة البيانات الظاهر سابقاً في PowerShell، لاستمرار استخدام D1 نفسها.
EMS Club V1.2
