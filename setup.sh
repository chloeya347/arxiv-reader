#!/bin/bash
set -e

echo "=== PaperAgent Setup ==="
echo

# Create conda environment (skip if it already exists)
if conda env list | grep -q "^paperagent "; then
  echo "Conda env 'paperagent' already exists, skipping creation."
else
  echo "Creating conda env 'paperagent'..."
  conda env create -f environment.yml
fi

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "Which LLM provider do you want to use?"
  echo "  1) anthropic  (Claude)"
  echo "  2) openai     (GPT-4o)"
  echo "  3) gemini     (Google Gemini)"
  echo "  4) qwen       (DashScope)"
  echo "  5) kimi       (Moonshot AI)"
  echo "  6) deepseek   (DeepSeek)"
  read -rp "Enter 1-6 [1]: " provider_choice
  provider_choice="${provider_choice:-1}"

  case "$provider_choice" in
    2)
      key_prompt="Paste your OpenAI API key: "
      sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=openai/" .env && rm -f .env.bak
      sed -i.bak "s/^# OPENAI_API_KEY=/OPENAI_API_KEY=/" .env && rm -f .env.bak
      sed -i.bak "s/^# OPENAI_MODEL=/OPENAI_MODEL=/" .env && rm -f .env.bak
      ;;
    3)
      key_prompt="Paste your Google Gemini API key: "
      sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=gemini/" .env && rm -f .env.bak
      sed -i.bak "s/^# GEMINI_API_KEY=/GEMINI_API_KEY=/" .env && rm -f .env.bak
      sed -i.bak "s/^# GEMINI_MODEL=/GEMINI_MODEL=/" .env && rm -f .env.bak
      ;;
    4)
      key_prompt="Paste your Qwen (DashScope) API key: "
      sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=qwen/" .env && rm -f .env.bak
      sed -i.bak "s/^# QWEN_API_KEY=/QWEN_API_KEY=/" .env && rm -f .env.bak
      sed -i.bak "s/^# QWEN_MODEL=/QWEN_MODEL=/" .env && rm -f .env.bak
      ;;
    5)
      key_prompt="Paste your Kimi (Moonshot) API key: "
      sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=kimi/" .env && rm -f .env.bak
      sed -i.bak "s/^# KIMI_API_KEY=/KIMI_API_KEY=/" .env && rm -f .env.bak
      sed -i.bak "s/^# KIMI_MODEL=/KIMI_MODEL=/" .env && rm -f .env.bak
      ;;
    6)
      key_prompt="Paste your DeepSeek API key: "
      sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=deepseek/" .env && rm -f .env.bak
      sed -i.bak "s/^# DEEPSEEK_API_KEY=/DEEPSEEK_API_KEY=/" .env && rm -f .env.bak
      sed -i.bak "s/^# DEEPSEEK_MODEL=/DEEPSEEK_MODEL=/" .env && rm -f .env.bak
      ;;
    *)
      key_prompt="Paste your Anthropic API key: "
      ;;
  esac

  echo
  read -rp "$key_prompt" api_key
  if [ -n "$api_key" ]; then
    sed -i.bak "s/your-key-here/$api_key/" .env && rm -f .env.bak
    echo "API key saved to .env"
  else
    echo "No key entered. Edit .env manually before running the server."
  fi
else
  echo ".env already exists, skipping."
fi

# Configure output language
echo
read -rp "Output language for summaries [English]: " lang
lang="${lang:-English}"
if grep -q "^LANGUAGE=" .env 2>/dev/null; then
  sed -i.bak "s/^LANGUAGE=.*/LANGUAGE=$lang/" .env && rm -f .env.bak
else
  echo "LANGUAGE=$lang" >> .env
fi
echo "Language set to: $lang"

echo
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Run: ./start.sh"
echo "  2. Load the extension in Chrome (see README.md)"
