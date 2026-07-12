"""
DevMind - مساعد ذكاء اصطناعي للمطورين
يعمل مع أي نموذج: Claude, GPT, Gemini, Ollama, Groq, Mistral
"""

import os
import sys

def main():
    print("=" * 60)
    print("🤖 DevMind - مساعد الذكاء الاصطناعي للمطورين")
    print("=" * 60)
    print()
    
    # اختيار النموذج
    print("اختر نموذج الذكاء الاصطناعي:")
    print()
    print("📌 نماذج مدفوعة:")
    print("  1. Anthropic (Claude 3.5 Sonnet) ⭐ - الأسرع والأذكى")
    print("  2. OpenAI (GPT-4 Turbo) - قوي جداً")
    print("  3. Google (Gemini Pro) - جيد ومتوازن")
    print()
    print("🆓 نماذج مجانية:")
    print("  4. Google Gemini (مجاني) - Gemini 2.0 Flash ⭐")
    print("  5. Groq (مجاني) - Llama/Mixtral سريع جداً")
    print("  6. Ollama (محلي) - Llama3/Mistral مجاني 100%")
    print()
    
    choice = input("اختيارك (1-6): ").strip()
    
    # إعدادات المفاتيح والنماذج
    if choice == "1":
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            api_key = input("🔑 أدخل Anthropic API Key: ").strip()
        model = "claude-sonnet-4-20250514"
        provider = "anthropic"
        cost = "مدفوع (~0.003$/1K token)"
        
    elif choice == "2":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            api_key = input("🔑 أدخل OpenAI API Key: ").strip()
        model = "gpt-4-turbo"
        provider = "openai"
        cost = "مدفوع (~0.01$/1K token)"
        
    elif choice == "3":
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            api_key = input("🔑 أدخل Google AI API Key: ").strip()
        model = "gemini-1.5-pro"
        provider = "google"
        cost = "مدفوع (حد مجاني)"
        
    elif choice == "4":
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            api_key = input("🔑 أدخل Google AI API Key (مجاني): ").strip()
        model = "gemini-2.0-flash-exp"
        provider = "google"
        cost = "🆓 مجاني (1.5M token/دقيقة)"
        
    elif choice == "5":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            api_key = input("🔑 أدخل Groq API Key (مجاني): ").strip()
        print()
        print("اختر النموذج:")
        print("  a. llama-3.1-70b-versatile ⭐ (الأفضل)")
        print("  b. mixtral-8x7b-32768 (قوي)")
        print("  c. gemma2-9b-it (خفيف)")
        model_choice = input("اختيارك (a/b/c): ").strip().lower()
        
        if model_choice == "a":
            model = "llama-3.1-70b-versatile"
        elif model_choice == "b":
            model = "mixtral-8x7b-32768"
        else:
            model = "gemma2-9b-it"
        
        provider = "groq"
        base_url = "https://api.groq.com/openai/v1"
        cost = "🆓 مجاني (30 RPM)"
        
    elif choice == "6":
        api_key = "local"
        print()
        print("اختر النموذج:")
        print("  a. llama3.2 (3B) ⭐ - سريع")
        print("  b. llama3.1 (70B) - قوي")
        print("  c. mistral (7B) - متوازن")
        print("  d. codellama - متخصص في الكود")
        model_choice = input("اختيارك (a/b/c/d): ").strip().lower()
        
        if model_choice == "a":
            model = "llama3.2"
        elif model_choice == "b":
            model = "llama3.1:70b"
        elif model_choice == "c":
            model = "mistral"
        else:
            model = "codellama"
        
        provider = "ollama"
        base_url = "http://localhost:11434"
        cost = "🆓 مجاني 100% (يحتاج Ollama)"
        
    else:
        print("❌ اختيار غير صحيح!")
        return
    
    print()
    print(f"✅ تم اختيار: {provider.upper()} - {model}")
    print(f"💰 التكلفة: {cost}")
    print()
    
    # تشغيل المحادثة
    print("=" * 60)
    print("🎯 ابدأ المحادثة! (اكتب 'خروج' للإنهاء)")
    print("=" * 60)
    print()
    
    try:
        from openhands.sdk import LLM, Agent, Conversation
        from openhands.tools.terminal import TerminalTool
        from openhands.tools.file_editor import FileEditorTool
        
        # إعداد النموذج
        llm_config = {
            "model": model,
            "api_key": api_key,
        }
        
        if provider in ["ollama", "groq"]:
            llm_config["base_url"] = base_url
        
        llm = LLM(**llm_config)
        
        # إعداد الوكيل (Agent)
        agent = Agent(
            llm=llm,
            tools=[TerminalTool, FileEditorTool],
        )
        
        # مجلد العمل
        workspace = os.path.expanduser("~/DevMind_Workspace")
        os.makedirs(workspace, exist_ok=True)
        
        conversation = Conversation(agent=agent, workspace=workspace)
        
        # حلقة المحادثة
        while True:
            user_input = input("👤 أنت: ")
            
            if user_input.lower() in ["خروج", "exit", "quit", "离开"]:
                print("👋 مع السلامة! شكراً لاستخدام DevMind!")
                break
            
            if not user_input.strip():
                continue
            
            print()
            print("🤖 DevMind يفكر... ⏳")
            print()
            
            conversation.send_message(user_input)
            conversation.run()
            
            # عرض الرد
            for event in conversation.events:
                if hasattr(event, 'content') and event.content:
                    print("🤖 DevMind:", event.content)
                    break
            
            print()
    
    except ImportError:
        print("❌ يجب تثبيت OpenHands SDK أولاً!")
        print()
        print("📦 شغّل هذا الأمر:")
        print("   pip install openhands-sdk openhands-tools")
        print()
    except Exception as e:
        print(f"❌ خطأ: {e}")


if __name__ == "__main__":
    main()
