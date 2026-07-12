"""
My AI Assistant - مساعد ذكاء اصطناعي بسيط
يعمل مع أي نموذج: Claude, GPT, Gemini, Ollama
"""

import os
import sys

def main():
    print("=" * 50)
    print("🤖 My AI Assistant - مساعدك الذكي")
    print("=" * 50)
    print()
    
    # اختيار النموذج
    print("اختر نموذج الذكاء الاصطناعي:")
    print("1. Anthropic (Claude)")
    print("2. OpenAI (GPT-4)")
    print("3. Google (Gemini)")
    print("4. Ollama (محلي - مجاني)")
    print()
    
    choice = input("اختيارك (1-4): ").strip()
    
    # إعدادات المفاتيح
    if choice == "1":
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            api_key = input("أدخل Anthropic API Key: ").strip()
        model = "claude-sonnet-4-20250514"
        provider = "anthropic"
        
    elif choice == "2":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            api_key = input("أدخل OpenAI API Key: ").strip()
        model = "gpt-4-turbo"
        provider = "openai"
        
    elif choice == "3":
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            api_key = input("أدخل Google API Key: ").strip()
        model = "gemini-2.0-flash"
        provider = "google"
        
    elif choice == "4":
        api_key = "local"
        model = "llama3"
        provider = "ollama"
        base_url = "http://localhost:11434"
        
    else:
        print("اختيار غير صحيح!")
        return
    
    print()
    print(f"✅ تم اختيار: {provider.upper()}")
    print()
    
    # تشغيل المحادثة
    print("=" * 50)
    print("ابدأ المحادثة! (اكتب 'خروج' للإنهاء)")
    print("=" * 50)
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
        if provider == "ollama":
            llm_config["base_url"] = base_url
        
        llm = LLM(**llm_config)
        
        # إعداد الوكيل (Agent)
        agent = Agent(
            llm=llm,
            tools=[TerminalTool, FileEditorTool],
        )
        
        # مجلد العمل
        workspace = os.path.expanduser("~/MyAIAssistant_Workspace")
        os.makedirs(workspace, exist_ok=True)
        
        conversation = Conversation(agent=agent, workspace=workspace)
        
        # حلقة المحادثة
        while True:
            user_input = input("👤 أنت: ")
            
            if user_input.lower() in ["خروج", "exit", "quit"]:
                print("👋 مع السلامة!")
                break
            
            if not user_input.strip():
                continue
            
            print()
            print("🤖 المساعد يفكر...")
            print()
            
            conversation.send_message(user_input)
            conversation.run()
            
            # عرض الرد
            for event in conversation.events:
                if hasattr(event, 'content') and event.content:
                    print("🤖 المساعد:", event.content)
                    break
            
            print()
    
    except ImportError:
        print("❌ يجب تثبيت OpenHands SDK أولاً!")
        print()
        print("شغّل هذا الأمر:")
        print("pip install openhands-sdk openhands-tools")
        print()
        print("أو:")


if __name__ == "__main__":
    main()
