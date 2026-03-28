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


def scrape_recipe_url(url: str) -> dict:
    """Scrape a recipe from a URL.

    Strategy:
    1. Try recipe-scrapers for structured extraction.
    2. If that fails, send raw page text through OpenAI.

    Returns:
        Raw dict with recipe data (title, ingredients list, instructions list).

    Raises:
        ValueError if the URL can't be fetched or doesn't contain a recipe.
    """
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=15.0, headers=_HEADERS)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise ValueError(f"Could not fetch URL: {e}")

    html = resp.text

    # --- Attempt 1: recipe-scrapers ---
    try:
        scraper = scrape_html(html=html, org_url=url)
        title = scraper.title()
        ingredients = scraper.ingredients()
        instructions = scraper.instructions_list()

        if title and ingredients and instructions:
            # Send through OpenAI to get structured JSON matching our schema
            raw_text = (
                f"Title: {title}\n"
                f"Servings: {scraper.yields()}\n\n"
                f"Ingredients:\n" + "\n".join(f"- {i}" for i in ingredients) + "\n\n"
                f"Instructions:\n" + "\n".join(f"{n+1}. {s}" for n, s in enumerate(instructions))
            )
            return _parse_via_openai(raw_text, use_url_prompt=False)
    except Exception:
        pass  # Fall through to attempt 2

    # --- Attempt 2: raw text through OpenAI ---
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    page_text = soup.get_text(separator="\n", strip=True)

    # Truncate to ~8000 chars to stay within token limits
    if len(page_text) > 8000:
        page_text = page_text[:8000]

    return _parse_via_openai(page_text, use_url_prompt=True)


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
