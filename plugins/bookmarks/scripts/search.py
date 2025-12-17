#!/usr/bin/env python3
"""
Bookmark search script.
Parses Netscape bookmark HTML files and searches by title/URL.

Usage:
    python search.py <query> [--limit N] [--folder FOLDER]
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class BookmarkParser(HTMLParser):
    """Parse Netscape bookmark HTML format."""

    def __init__(self):
        super().__init__()
        self.bookmarks = []
        self.current_folders = []
        self.current_href = None
        self.current_add_date = None
        self.in_anchor = False
        self.in_folder_header = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "a":
            self.in_anchor = True
            self.current_href = attrs_dict.get("href")
            self.current_add_date = attrs_dict.get("add_date")
        elif tag == "h3":
            self.in_folder_header = True
        elif tag == "dl":
            pass  # Folder content starts

    def handle_endtag(self, tag):
        if tag == "a":
            self.in_anchor = False
        elif tag == "h3":
            self.in_folder_header = False
        elif tag == "dl" and self.current_folders:
            self.current_folders.pop()

    def handle_data(self, data):
        data = data.strip()
        if not data:
            return

        if self.in_folder_header:
            self.current_folders.append(data)
        elif self.in_anchor and self.current_href:
            self.bookmarks.append({
                "title": data,
                "url": self.current_href,
                "folder": " > ".join(self.current_folders) if self.current_folders else "Root",
                "add_date": self.current_add_date,
            })
            self.current_href = None
            self.current_add_date = None


def load_bookmarks(data_dir: Path) -> list[dict]:
    """Load all bookmarks from HTML files in data directory, deduplicated by URL."""
    seen_urls = set()
    bookmarks = []
    for html_file in sorted(data_dir.glob("*.html")):
        parser = BookmarkParser()
        with open(html_file, encoding="utf-8") as f:
            parser.feed(f.read())
        for bm in parser.bookmarks:
            if bm["url"] not in seen_urls:
                seen_urls.add(bm["url"])
                bookmarks.append(bm)
    return bookmarks


def search_bookmarks(
    bookmarks: list[dict],
    query: str,
    folder: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Search bookmarks by title and URL."""
    query_lower = query.lower()
    query_words = query_lower.split()

    results = []
    for bm in bookmarks:
        # Filter by folder if specified
        if folder and folder.lower() not in bm["folder"].lower():
            continue

        # Score based on matches
        title_lower = bm["title"].lower()
        url_lower = bm["url"].lower()
        searchable = f"{title_lower} {url_lower}"

        # All query words must match somewhere
        if not all(word in searchable for word in query_words):
            continue

        # Scoring: title matches worth more
        score = 0
        for word in query_words:
            if word in title_lower:
                score += 2
            if word in url_lower:
                score += 1

        results.append((score, bm))

    # Sort by score descending, then by title
    results.sort(key=lambda x: (-x[0], x[1]["title"].lower()))
    return [bm for _, bm in results[:limit]]


def main():
    parser = argparse.ArgumentParser(description="Search bookmarks")
    parser.add_argument("query", nargs="+", help="Search terms")
    parser.add_argument("--limit", "-n", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--folder", "-f", help="Filter by folder name")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # Find data directory relative to script
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"

    if not data_dir.exists():
        print(f"Error: Data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    bookmarks = load_bookmarks(data_dir)
    query = " ".join(args.query)
    results = search_bookmarks(bookmarks, query, args.folder, args.limit)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        if not results:
            print(f"No bookmarks found for: {query}")
            sys.exit(0)

        print(f"Found {len(results)} bookmark(s) for: {query}\n")
        for i, bm in enumerate(results, 1):
            print(f"{i}. {bm['title']}")
            print(f"   URL: {bm['url']}")
            print(f"   Folder: {bm['folder']}")
            print()


if __name__ == "__main__":
    main()
