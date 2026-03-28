import os
import traceback
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def _get_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.")
    return OpenAI(api_key=OPENAI_API_KEY)


def chat_completion(messages: list[dict], model: str = "gpt-4o-mini", temperature: float = 0.7) -> dict:
    if not OPENAI_API_KEY:
        return {"error": "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."}

    if not messages:
        return {"error": "Please provide at least one message."}

    try:
        client = _get_client()
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
        print(f"OpenAI Error: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"OpenAI API error: {str(e)}"}


def vision_completion(
    system_prompt: str,
    image_data_list: list[tuple[str, str]],
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
) -> dict:
    """Send images to OpenAI Vision API for recipe extraction.

    Args:
        system_prompt: System prompt for the model.
        image_data_list: List of (base64_str, mime_type) tuples.
        model: OpenAI model (must support vision).
        temperature: Sampling temperature.

    Returns:
        dict with 'content' (str) on success, or 'error' (str) on failure.
    """
    try:
        client = _get_client()

        user_content: list[dict] = [
            {"type": "text", "text": "Extract the recipe from these images."}
        ]
        for b64, mime in image_data_list:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}"},
            })

        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=temperature,
            max_tokens=4096,
        )

        content = resp.choices[0].message.content
        return {"content": content}

    except Exception as e:
        print(f"OpenAI Vision Error: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"OpenAI API error: {str(e)}"}
