# 🤖 OpenHands Self-Hosted - مشروعك الخاص للذكاء الاصطناعي

<div align="center">

![OpenHands](https://img.shields.io/badge/OpenHands-Self%20Hosted-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![Render](https://img.shields.io/badge/Deploy-Render-purple)

**نسخة ذاتية الاستضافة من OpenHands - مساعدك الذكي لتعديل الأكواد وإصلاح الأخطاء**

[English](README.md) | [العربية](#-现在开始)

</div>

---

## 📋 الفهرس

- [الميزات](#-الميزات)
- [المتطلبات](#-المتطلبات)
- [التثبيت السريع](#-التثبيت-السريع)
- [النشر على Render](#-النشر-على-render)
- [التكوين](#-التكوين)
- [استخدام التطبيق](#-استخدام-التطبيق)
- [التكامل مع GitHub](#-التكامل-مع-github)
- [المساهمة](#-المساهمة)
- [الأسئلة الشائعة](#-الأسئلة-الشائعة)

---

## ✨ الميزات

- 🌐 **واجهة ويب سهلة الاستخدام** -和控制面板 شبيهة بـ OpenHands الأصلي
- 🤖 **دعم جميع نماذج الذكاء الاصطناعي** - Claude, GPT-4, Gemini, Ollama والمزيد
- 🔑 **إدارة المفاتيح الخاصة** - استخدم مفتاحك الخاص من أي مزود
- 💻 **تعديل الأكواد** -_agent يقرأ ويكتب الملفات في مستودعاتك
- 🐛 **إصلاح الأخطاء** - يكتشف ويصلح المشاكل في الكود
- 🔄 **التكامل مع GitHub** - يتفاعل مع الـ pull requests والـ issues
- 🐳 **دعم Docker** - نشر سهل على أي منصة
- 🚀 **النشر على Render** - إعداد سريع في دقائق

---

## 📦 المتطلبات

### للنشر المحلي:
- Docker و Docker Compose
- أو Node.js 22+ و npm

### للنشر على Render:
- حساب على [Render](https://render.com)
- حساب على GitHub
- مفتاح API من مزود الذكاء الاصطناعي (اختياري)

---

## 🚀 التثبيت السريع

### الطريقة الأولى: Docker Compose (موصى بها)

```bash
# استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/openhands-self-hosted.git
cd openhands-self-hosted

# نسخ ملف البيئة
cp .env.example .env

# تحرير ملف البيئة وإضافة مفاتيحك
nano .env

# تشغيل التطبيق
docker-compose up -d
```

### الطريقة الثانية: Docker فقط

```bash
# بناء الصورة
docker build -t openhands-self-hosted .

# تشغيل الحاوية
docker run -d \
  -p 8000:8000 \
  -e LOCAL_BACKEND_API_KEY=your-secret-key \
  openhands-self-hosted
```

### الطريقة الثالثة: Node.js

```bash
# تثبيت Agent Canvas
npm install -g @openhands/agent-canvas

# تشغيل التطبيق
export LOCAL_BACKEND_API_KEY=your-secret-key
export PORT=8000
agent-canvas --public
```

---

## ☁️ النشر على Render

### الخطوة 1: رفع المشروع على GitHub

```bash
# إنشاء مستودع جديد على GitHub
git init
git add .
git commit -m "Initial commit - OpenHands Self-Hosted"

# إضافة المستودع البعيد (استبدل برابط مستودعك)
git remote add origin https://github.com/YOUR_USERNAME/openhands-self-hosted.git
git branch -M main
git push -u origin main
```

### الخطوة 2: النشر على Render

1. سجل دخول إلى [Render](https://render.com)
2. اضغط على **"New +"** → **"Blueprint"**
3. اربط مستودع GitHub الخاص بك
4. Render سيكتشف ملف `render.yaml` تلقائياً
5. اضغط **"Apply"** للبدء في النشر

### الخطوة 3: إعداد المتغيرات البيئية

في لوحة تحكم Render، أضف المتغيرات التالية:

| المتغير | الوصف | مطلوب |
|---------|-------|-------|
| `LOCAL_BACKEND_API_KEY` | مفتاح سري للوصول | ✅ |
| `PUBLIC_URL` | رابط تطبيقك | ✅ |
| `ANTHROPIC_API_KEY` | مفتاح Claude (اختياري) | ❌ |
| `OPENAI_API_KEY` | مفتاح OpenAI (اختياري) | ❌ |

---

## ⚙️ التكوين

### متغيرات البيئة

```bash
# الملف: .env

# الأمان
LOCAL_BACKEND_API_KEY=مفتاح-سري-قوي-يجب-تغييره

# الخادم
PORT=8000
AGENT_CANVAS_MODE=full
PUBLIC_URL=https://your-app.onrender.com

# نماذج الذكاء الاصطناعي
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# GitHub
GITHUB_TOKEN=ghp_xxxxx
```

### اختيار نموذج الذكاء الاصطناعي

يدعم التطبيق العديد من النماذج:

| المزود | النماذج المدعومة | مفتاح API |
|--------|----------------|-----------|
| **Anthropic** | Claude 3.5, Claude 3 | anthropic.com |
| **OpenAI** | GPT-4, GPT-4 Turbo | openai.com |
| **Google** | Gemini Pro, Gemini Ultra | ai.google.dev |
| **Ollama** | أي نموذج محلي | مجاني |
| **Azure** | نماذج OpenAI على Azure | azure.microsoft.com |

---

## 🎮 استخدام التطبيق

### بعد التشغيل

1. افتح المتصفح على `http://localhost:8000` أو رابط Render الخاص بك
2. أدخل `LOCAL_BACKEND_API_KEY` للمصادقة
3. اختر نموذج الذكاء الاصطناعي وأدخل مفتاح API الخاص بك
4. ابدأ المحادثة!

### أمثلة على الأوامر

```
• "اقرأ ملف main.py واشرح لي ما يفعله"
• "أصلح الخطأ في الدالة calculate_total"
• "أضف ميزة تسجيل الدخول到这个 المشروع"
• "راجع الـ pull request #42 على GitHub"
• "أنشئ README.md لهذا المشروع"
```

---

## 🔗 التكامل مع GitHub

### إعداد Token

1. أنشئ Personal Access Token على GitHub:
   - اذهب إلى **Settings** → **Developer settings** → **Personal access tokens**
   - اضغط **"Generate new token (classic)"**
   - اختر الصلاحيات: `repo`, `workflow`, `read:user`

2. أضف الـ Token في `.env`:
   ```bash
   GITHUB_TOKEN=ghp_xxxxx
   ```

### استخدام التكامل

- **رؤية المستودعات** - يعرض قائمة بمستودعاتك
- **قراءة الملفات** - يقرأ محتوى أي ملف
- **تعديل الأكواد** - يكتب ويعدل الملفات
- **إنشاء PRs** - يفتح pull requests
- **التعليق** - يعلق على issues و PRs

---

## 📚 الموارد

- [وثائق OpenHands](https://docs.openhands.dev/)
- [وثائق Agent Canvas](https://docs.openhands.dev/openhands/usage/agent-canvas/overview)
- [مجتمع OpenHands على Slack](https://openhands.dev/joinslack)

---

## 🤝 المساهمة

نرحب بمساهماتكم! يرجى:

1. Fork المشروع
2. إنشاء branch للميزة (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى الـ branch (`git push origin feature/amazing-feature`)
5. فتح Pull Request

---

## ❓ الأسئلة الشائعة

### هل يمكنني استخدام نماذج محلية؟
نعم! يمكنك استخدام [Ollama](https://ollama.ai/) أو [LM Studio](https://lmstudio.ai/) كنموذج محلي مجاني.

### هل البيانات آمنة؟
نعم! البيانات تُخزن محلياً على خادمك. نحن لا نرسل أي بيانات إلى خوادم خارجية (باستثناء استدعاءات نموذج الذكاء الاصطناعي).

### كم يكلف التشغيل؟
- **Render Free Tier**: مجاني (يغلق بعد 15 دقيقة من عدم النشاط)
- **Render Starter**: $7/شهر (يعمل دائماً)
- **نموذج Claude API**: ~$0.003 لكل 1K token

### هل يمكنني تخصيص الواجهة؟
نعم! الواجهة مبنية على React ويمكن تخصيصها حسب الرغبة.

---

## 📄 الرخصة

هذا المشروع مرخص تحت MIT License - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

<div align="center">

**صُنع بـ ❤️ للمجتمع**

**OpenHands Self-Hosted** هو مشروع مستقل غير مرتبط رسمياً بـ All-Hands AI

</div>

---

## 🇺🇸 English README

### Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/openhands-self-hosted.git
cd openhands-self-hosted

# Copy environment file
cp .env.example .env

# Edit and configure
nano .env

# Run with Docker Compose
docker-compose up -d
```

### Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com)
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repo
5. Click **"Apply"**

### Supported AI Models

| Provider | Models | API Key |
|----------|--------|---------|
| **Anthropic** | Claude 3.5, Claude 3 | anthropic.com |
| **OpenAI** | GPT-4, GPT-4 Turbo | openai.com |
| **Google** | Gemini Pro, Gemini Ultra | ai.google.dev |
| **Ollama** | Any local model | Free |
| **Azure** | Azure OpenAI models | azure.microsoft.com |

### Features

- 🌐 **Web UI** - Modern browser interface
- 🤖 **Multi-Model Support** - Use any AI provider
- 🔑 **Your Own API Keys** - Full control
- 💻 **Code Editing** - Read/write files
- 🐛 **Bug Fixing** - Detect and fix issues
- 🔄 **GitHub Integration** - PRs, issues, repos
- 🐳 **Docker Ready** - Deploy anywhere
- 🚀 **Render Deploy** - One-click deployment

---

<div align="center">

**MIT License - Use freely, contribute back!**

</div>
