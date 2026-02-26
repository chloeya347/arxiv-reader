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
  default_provider=""
  configured_count=0

  while true; do
    echo "Available LLM providers:"
    echo "  1) anthropic  (Claude)"
    echo "  2) openai     (GPT-4o)"
    echo "  3) qwen       (DashScope)"
    echo "  4) kimi       (Moonshot AI)"
    echo "  5) deepseek   (DeepSeek)"
    echo "  q) Done — finish provider setup"
    echo
    read -rp "Choose a provider to configure [q]: " provider_choice
    provider_choice="${provider_choice:-q}"

    case "$provider_choice" in
      q|Q)
        break
        ;;
      1)
        provider_name="anthropic"
        sed -i.bak "s/^# ANTHROPIC_API_KEY=/ANTHROPIC_API_KEY=/" .env && rm -f .env.bak
        sed -i.bak "s/^# ANTHROPIC_MODEL=/ANTHROPIC_MODEL=/" .env && rm -f .env.bak
        read -rp "Paste your Anthropic API key: " api_key
        if [ -n "$api_key" ]; then
          sed -i.bak "s|^ANTHROPIC_API_KEY=your-key-here|ANTHROPIC_API_KEY=$api_key|" .env && rm -f .env.bak
          echo "Anthropic API key saved."
        else
          echo "No key entered. Edit .env manually for Anthropic."
        fi
        ;;
      2)
        provider_name="openai"
        sed -i.bak "s/^# OPENAI_API_KEY=/OPENAI_API_KEY=/" .env && rm -f .env.bak
        sed -i.bak "s/^# OPENAI_MODEL=/OPENAI_MODEL=/" .env && rm -f .env.bak
        read -rp "Paste your OpenAI API key: " api_key
        if [ -n "$api_key" ]; then
          sed -i.bak "s|^OPENAI_API_KEY=your-key-here|OPENAI_API_KEY=$api_key|" .env && rm -f .env.bak
          echo "OpenAI API key saved."
        else
          echo "No key entered. Edit .env manually for OpenAI."
        fi
        ;;
      3)
        provider_name="qwen"
        sed -i.bak "s/^# QWEN_API_KEY=/QWEN_API_KEY=/" .env && rm -f .env.bak
        sed -i.bak "s/^# QWEN_MODEL=/QWEN_MODEL=/" .env && rm -f .env.bak
        read -rp "Paste your Qwen (DashScope) API key: " api_key
        if [ -n "$api_key" ]; then
          sed -i.bak "s|^QWEN_API_KEY=your-key-here|QWEN_API_KEY=$api_key|" .env && rm -f .env.bak
          echo "Qwen API key saved."
        else
          echo "No key entered. Edit .env manually for Qwen."
        fi
        ;;
      4)
        provider_name="kimi"
        sed -i.bak "s/^# KIMI_API_KEY=/KIMI_API_KEY=/" .env && rm -f .env.bak
        sed -i.bak "s/^# KIMI_MODEL=/KIMI_MODEL=/" .env && rm -f .env.bak
        read -rp "Paste your Kimi (Moonshot) API key: " api_key
        if [ -n "$api_key" ]; then
          sed -i.bak "s|^KIMI_API_KEY=your-key-here|KIMI_API_KEY=$api_key|" .env && rm -f .env.bak
          echo "Kimi API key saved."
        else
          echo "No key entered. Edit .env manually for Kimi."
        fi
        ;;
      5)
        provider_name="deepseek"
        sed -i.bak "s/^# DEEPSEEK_API_KEY=/DEEPSEEK_API_KEY=/" .env && rm -f .env.bak
        sed -i.bak "s/^# DEEPSEEK_MODEL=/DEEPSEEK_MODEL=/" .env && rm -f .env.bak
        read -rp "Paste your DeepSeek API key: " api_key
        if [ -n "$api_key" ]; then
          sed -i.bak "s|^DEEPSEEK_API_KEY=your-key-here|DEEPSEEK_API_KEY=$api_key|" .env && rm -f .env.bak
          echo "DeepSeek API key saved."
        else
          echo "No key entered. Edit .env manually for DeepSeek."
        fi
        ;;
      *)
        echo "Invalid choice, please try again."
        echo
        continue
        ;;
    esac

    configured_count=$((configured_count + 1))
    [ -z "$default_provider" ] && default_provider="$provider_name"
    echo
  done

  # Set default provider (first one configured, fallback to anthropic)
  default_provider="${default_provider:-anthropic}"
  sed -i.bak "s/^LLM_PROVIDER=.*/LLM_PROVIDER=$default_provider/" .env && rm -f .env.bak
  echo "Default provider set to: $default_provider"

  if [ "$configured_count" -eq 0 ]; then
    echo "No providers configured. Edit .env manually before running the server."
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
