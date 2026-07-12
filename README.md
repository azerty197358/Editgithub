# 🤖 مساعد الذكاء الاصطناعي الخاص بك

<div align="center">

**مساعد ذكاء اصطناعي بسيط وسريع - يعمل مع أي نموذج**

</div>

---

## ✨ الميزات

- 🌐 يعمل مع **Claude**, **GPT-4**, **Gemini**, **Ollama**
- 💻 يقرأ ويكتب الملفات في جهازك
- 🔧 ينفذ أوامر في Terminal
- 🐛 يصحح الأخطاء في الكود
- 📝 يعدل الأكواد ويطورها
- 🔑 مفتاحك الخاص - بياناتك آمنة

---

## 🚀 التشغيل في 3 خطوات

### الخطوة 1: ثبّت Python

حمّل Python من: https://www.python.org/downloads/

**أثناء التثبيت:** اضغط ✅ Add Python to PATH

---

### الخطوة 2: ثبّت المكتبات

افتح Terminal (cmd) وشغّل:

```bash
cd C:\Users\iry00\Downloads\MyAIAssistant
pip install openhands-sdk openhands-tools
```

---

### الخطوة 3: شغّل البرنامج!

```bash
python assistant.py
```

---

## 📖 طريقة الاستخدام

```
==================================================
🤖 My AI Assistant - مساعدك الذكي
==================================================

اختر نموذج الذكاء الاصطناعي:
1. Anthropic (Claude)
2. OpenAI (GPT-4)
3. Google (Gemini)
4. Ollama (محلي - مجاني)

اختيارك (1-4): 1
أدخل Anthropic API Key: sk-ant-xxxxx

✅ تم اختيار: ANTHROPICP

==================================================
ابدأ المحادثة! (اكتب 'خروج' للإنهاء)
==================================================

👤 أنت: عدّل هذا الملف واصلح الأخطاء

🤖 المساعد يفكر...

🤖 المساعد: تم إصلاح الملف بنجاح!

👤 أنت: خروج
👋 مع السلامة!
```

---

## 🔑 الحصول على مفاتيح API

### Claude (Anthropic)
1. اذهب إلى: https://console.anthropic.com/
2. سجل دخول أو أنشئ حساب
3. من Dashboard، انسخ API Key

### GPT-4 (OpenAI)
1. اذهب إلى: https://platform.openai.com/
2. سجل دخول أو أنشئ حساب
3. من API Keys، أنشئ مفتاح جديد

### Gemini (Google)
1. اذهب إلى: https://aistudio.google.com/
2. سجل دخول
3. من API Keys، أنشئ مفتاح جديد

### Ollama (مجاني - محلي)
1. حمّل من: https://ollama.ai/
2. ثبّته
3. شغّل: `ollama pull llama3`
4. المفتاح: لا يحتاج مفتاح!

---

## 💰 التكلفة

| النموذج | التكلفة |
|---------|--------|
| Claude | ~$0.003/1K token |
| GPT-4 | ~$0.01/1K token |
| Gemini | مجاني (محدود) |
| **Ollama** | **مجاني 100%** |

---

## 🆘 المشاكل الشائعة

### خطأ: "python not recognized"
- أعد تثبيت Python مع勾 Add to PATH

### خطأ: "Module not found"
- شغّل: `pip install openhands-sdk openhands-tools`

### بطء في الرد
- استخدم Ollama (محلي) بدلاً من API السحابي

---

## 📂 هيكل المشروع

```
MyAIAssistant/
├── assistant.py      # الملف الرئيسي
├── requirements.txt  # المكتبات المطلوبة
└── README.md         # هذا الملف
```

---

## 🔒 الأمان

- ✅ البيانات تُعالج محلياً على جهازك
- ✅ لا ترسل بياناتك لأي خادم
- ✅ مفتاحك الخاص لا يُشارك مع أحد
- ✅ الملفات تُنشأ في مجلد `~/MyAIAssistant_Workspace`

---

**صُنع بواسطة AI 🤖 - للاستخدام الشخصي**
