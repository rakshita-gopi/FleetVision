import os
import re
import json
import urllib.request
import urllib.error
from typing import Optional


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
SYSTEM_PROMPT = "You are FleetVision AI, an intelligent fleet management assistant. Provide concise, actionable answers based on the fleet data provided."


def _strip_thinking(text: str) -> str:
    """Remove Qwen3 thinking blocks from response."""
    if not text:
        return text
    think_close = "<" + "/think" + ">"
    if think_close in text:
        text = text.split(think_close)[-1]
    think_pattern = "<" + "think" + ">" + r"[\s\S]*?" + think_close
    cleaned = re.sub(think_pattern, "", text, flags=re.DOTALL).strip()
    return cleaned or text.strip()


def call_ollama(prompt: str, system_msg: str = SYSTEM_PROMPT) -> Optional[str]:
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 800},
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("message", {}).get("content", "")
            return _strip_thinking(content)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
        return None


def ollama_health() -> bool:
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False
