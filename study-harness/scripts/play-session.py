#!/usr/bin/env python3
"""Plays one whole study session in a real browser against a running harness (http://localhost:5185).

For a mechanical end-to-end test of the UI: it clicks through consent, the survey, the practice feature and the six
measured features, answers every question, submits the postsurvey and finishes. Screenshots of every question page
go to /tmp/session-browser/. The data are not meant for analysis.

Usage: python3 study-harness/scripts/play-session.py [--url http://localhost:5185] [--shots /tmp/session-browser]
"""
import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

INF = 15 * 60 * 1000  # a step may take minutes; the model writes the code


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:5185")
    ap.add_argument("--shots", default="/tmp/session-browser")
    args = ap.parse_args()
    shots = Path(args.shots)
    shots.mkdir(parents=True, exist_ok=True)
    n = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(60_000)
        page.goto(args.url, wait_until="domcontentloaded")

        def shot(name: str):
            nonlocal n
            n += 1
            page.screenshot(path=str(shots / f"{n:02d}-{name}.png"), full_page=False)
            print(f"    shot {n:02d} {name}", flush=True)

        def click(text: str, timeout: int = INF):
            page.get_by_role("button", name=text, exact=False).first.click(timeout=timeout)

        def wait_text(text: str, timeout: int = INF):
            page.get_by_text(text, exact=False).first.wait_for(timeout=timeout)

        def scales():
            return page.locator("[data-study-scale]")

        def answer_scales(value_index: int):
            """Clicks the same segment in every scale on the current survey page."""
            count = scales().count()
            for i in range(count):
                scales().nth(i).locator("button").nth(value_index).click()

        # Intro
        wait_text("Welcome to Shopfront")
        shot("intro")
        click("Start")
        wait_text("Before we start")
        shot("survey-1")

        # Survey page 1: consent, demographics, TS familiarity
        page.locator("[data-study-consent] input").check()
        for field in page.locator("[data-study-field]").all():
            chips = field.locator("[data-study-chip]")
            if chips.count():
                chips.first.click()
        answer_scales(2)  # value 3 of 1-5
        click("Next")
        wait_text("How characteristic is each statement")
        shot("survey-2")

        # Survey page 2: NCS-6 plus the attention check (value 4 of 1-5)
        answer_scales(3)
        click("Next")
        wait_text("Thinking of AI coding assistants")
        shot("survey-3")

        # Survey page 3: S-TIAS (1-7)
        answer_scales(3)  # value 4
        click("Start practice")

        for trial in range(7):
            # Plan
            wait_text("Approve the plan?", timeout=INF)
            shot(f"t{trial}-plan")
            click("Approve plan")

            # Review
            wait_text("Review what it wrote", timeout=INF)
            shot(f"t{trial}-review")
            click("Accept")

            # Behaviour question: first option, then confirm
            wait_text("Before you finalize", timeout=INF)
            page.locator("[data-slot=question-options] button, [role=radiogroup] button").first.click()
            shot(f"t{trial}-probe")
            click("Confirm my decision")

            # Final look
            wait_text("I've finished reviewing", timeout=INF)
            shot(f"t{trial}-final")
            click("I've finished reviewing")

            # Understanding: five questions, each option + confidence, last screen effort
            wait_text("Question 1 of", timeout=INF)
            for q in range(5):
                wait_text(f"Question {q + 1} of 5", timeout=INF)
                page.locator("[data-study-option]").first.click()
                page.get_by_role("radio", name="55%").click()
                if q == 0:
                    shot(f"t{trial}-question")
                click("Continue")
            wait_text("Almost done", timeout=INF)
            wait_text("How much mental effort", timeout=INF)
            page.get_by_role("radio", name="5", exact=True).click()
            shot(f"t{trial}-effort")
            click("Next")
            print(f"  trial {trial} done", flush=True)

        # Post-survey
        wait_text("Your preferences", timeout=INF)
        options = page.locator("[data-study-options] [data-study-option]")
        options.first.click()
        page.wait_for_timeout(300)
        page.locator("[data-study-options] [data-study-option]").first.click()
        shot("postsurvey")
        click("Submit")

        # Debrief and finish
        wait_text("we couldn't tell you earlier", timeout=INF)
        shot("debrief")
        click("Finish")
        wait_text("Thank you", timeout=INF)
        shot("thank-you")
        print("session finished in the browser", flush=True)
        browser.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PlaywrightTimeout as e:
        print(f"TIMEOUT: {e}", file=sys.stderr)
        sys.exit(1)
