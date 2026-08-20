from html.parser import HTMLParser
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1_count = 0
        self.mission_cards = []
        self.dialogs = {}
        self.close_buttons = []
        self.elements_by_id = {}
        self.video_sources = []
        self.active_video_id = None
        self.visible_text = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.elements_by_id[element_id] = (tag, values)
        if tag == "video":
            self.active_video_id = element_id
        if tag == "source" and self.active_video_id:
            self.video_sources.append((self.active_video_id, values))
        if tag == "h1":
            self.h1_count += 1
        classes = set(values.get("class", "").split())
        if "mission-card" in classes:
            self.mission_cards.append(values)
        if values.get("role") == "dialog":
            self.dialogs[values.get("id", f"dialog-{len(self.dialogs)}")] = values
        if tag == "button" and "close" in " ".join(classes):
            self.close_buttons.append(values)
        if tag in {"script", "style"}:
            self.hidden_depth += 1

    def handle_endtag(self, tag):
        if tag == "video":
            self.active_video_id = None
        if tag in {"script", "style"} and self.hidden_depth:
            self.hidden_depth -= 1

    def handle_data(self, data):
        if not self.hidden_depth and data.strip():
            self.visible_text.append(data.strip())


class LandingPageStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parser = PageParser()
        cls.parser.feed(HTML)

    def test_has_one_clear_page_heading(self):
        self.assertEqual(self.parser.h1_count, 1)

    def test_tribute_video_entrance_is_available_before_the_landing_page(self):
        required_ids = {
            "loader",
            "loader-video-player",
            "loader-sound-btn",
            "loader-sound-icon",
            "loader-skip-btn",
            "loader-bar",
            "loader-count",
            "loader-enter-btn",
        }
        self.assertTrue(required_ids.issubset(self.parser.elements_by_id))

        video_tag, video_attrs = self.parser.elements_by_id["loader-video-player"]
        self.assertEqual(video_tag, "video")
        for autoplay_attribute in ("autoplay", "muted", "playsinline"):
            self.assertIn(autoplay_attribute, video_attrs)

        source = next(
            attrs for video_id, attrs in self.parser.video_sources
            if video_id == "loader-video-player"
        )
        self.assertEqual(source.get("src"), "assets/tribute-intro.mp4")
        self.assertEqual(source.get("type"), "video/mp4")
        self.assertGreater((ROOT / source["src"]).stat().st_size, 0)

    def test_has_exactly_four_learning_missions(self):
        self.assertEqual(len(self.parser.mission_cards), 4)
        self.assertTrue(all(card.get("data-prompt") for card in self.parser.mission_cards))

    def test_parent_zone_is_addressed_to_guardians(self):
        text = " ".join(self.parser.visible_text).lower()
        self.assertIn("parent zone", text)
        self.assertRegex(text, r"parent\s*/?\s*guardian")

    def test_page_allows_browser_zoom(self):
        viewport = re.search(r'<meta[^>]+name=["\']viewport["\'][^>]+>', HTML, re.I)
        self.assertIsNotNone(viewport)
        content = viewport.group(0).lower()
        self.assertNotIn("user-scalable=no", content)
        self.assertNotIn("maximum-scale", content)

    def test_overlays_have_dialog_semantics(self):
        self.assertGreaterEqual(len(self.parser.dialogs), 3)
        for dialog in self.parser.dialogs.values():
            self.assertEqual(dialog.get("aria-modal"), "true")
            self.assertTrue(dialog.get("aria-labelledby"))

    def test_close_buttons_are_named(self):
        self.assertGreaterEqual(len(self.parser.close_buttons), 3)
        self.assertTrue(all(button.get("aria-label") for button in self.parser.close_buttons))

    def test_technical_workflow_language_is_not_child_facing(self):
        text = " ".join(self.parser.visible_text).lower()
        for term in ("n8n", "webhook", "cloned voice"):
            self.assertNotIn(term, text)


if __name__ == "__main__":
    unittest.main()
