import httpx
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_html

from app.openai_module import chat_completion
from app.prompts import RECIPE_URL_SYSTEM_PROMPT

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _extract_hero_image(html: str, url: str) -> str | None:
    """Try to find the recipe's hero image from og:image or structured data."""
    soup = BeautifulSoup(html, "html.parser")

    # Try og:image first
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    # Try schema.org image
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = data[0]
            img = data.get("image")
            if isinstance(img, list):
                img = img[0]
            if isinstance(img, dict):
                img = img.get("url")
            if img:
                return img
        except Exception:
            continue

    return None


def scrape_recipe_url(url: str) -> dict:
    """Scrape a recipe from a URL.

    Returns:
        dict with 'content' key (OpenAI response) and optional 'image_url'.

    Raises:
        ValueError if the URL can't be fetched or doesn't contain a recipe.
    """
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=15.0, headers=_HEADERS)
        resp.raise_for_status()
    except httpx.TimeoutException:
        raise ValueError("The read operation timed out")
    except httpx.HTTPError as e:
        raise ValueError(f"Could not fetch URL: {e}")

    html = resp.text
    image_url = _extract_hero_image(html, url)

    # --- Attempt 1: recipe-scrapers ---
    try:
        scraper = scrape_html(html=html, org_url=url)
        title = scraper.title()
        ingredients = scraper.ingredients()
        instructions = scraper.instructions_list()

        if title and ingredients and instructions:
            raw_text = (
                f"Title: {title}\n"
                f"Servings: {scraper.yields()}\n\n"
                f"Ingredients:\n" + "\n".join(f"- {i}" for i in ingredients) + "\n\n"
                f"Instructions:\n" + "\n".join(f"{n+1}. {s}" for n, s in enumerate(instructions))
            )
            result = _parse_via_openai(raw_text, use_url_prompt=False)
            # Try to get image from scraper too
            if not image_url:
                try:
                    image_url = scraper.image()
                except Exception:
                    pass
            result["image_url"] = image_url
            return result
    except Exception:
        pass  # Fall through to attempt 2

    # --- Attempt 2: raw text through OpenAI ---
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    page_text = soup.get_text(separator="\n", strip=True)

    if len(page_text) > 8000:
        page_text = page_text[:8000]

    result = _parse_via_openai(page_text, use_url_prompt=True)
    result["image_url"] = image_url
    return result


def _parse_via_openai(text: str, use_url_prompt: bool) -> dict:
    from app.prompts import RECIPE_PARSE_SYSTEM_PROMPT

    prompt = RECIPE_URL_SYSTEM_PROMPT if use_url_prompt else RECIPE_PARSE_SYSTEM_PROMPT

    result = chat_completion(
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
        model="gpt-4o-mini",
        temperature=0.2,
    )

    if "error" in result and "content" not in result:
        raise ValueError(result["error"])

    return result
