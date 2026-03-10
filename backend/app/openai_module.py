import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def chat_completion(messages: list[dict], model: str = "gpt-4o-mini", temperature: float = 0.7) -> dict:
    """
    Send a list of messages to the OpenAI chat completions API and return the response.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        model: OpenAI model to use.
        temperature: Sampling temperature (0.0 - 2.0).

    Returns:
        dict with 'content' (str) on success, or 'error' (str) on failure.
    """
    if not OPENAI_API_KEY:
        return {"error": "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."}

    if not messages:
        return {"error": "Please provide at least one message."}

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)

        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )

        content = resp.choices[0].message.content
        return {
            "content": content,
            "model": resp.model,
            "usage": {
                "prompt_tokens": resp.usage.prompt_tokens,
                "completion_tokens": resp.usage.completion_tokens,
                "total_tokens": resp.usage.total_tokens,
            },
        }

    except Exception as e:
        import traceback
        print(f"OpenAI Error: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"OpenAI API error: {str(e)}"}
