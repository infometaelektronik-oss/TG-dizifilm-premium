#!/usr/bin/env python3
"""Authorized/public media discovery; includes DRM/protected media stream link extraction.

Install: python -m pip install 'playwright>=1.49,<2'
Browser: python -m playwright install chromium
Run: python media_crawler.py https://example.org --output results.json
Cross-origin frames: --allow-host player.example.org (repeatable)
Pages: --max-pages 10 --depth 1 --wait-seconds 5
Documented public JSON API: --api-url https://example.org/catalog.json
Output includes JSON evidence and a complete playlist with all media candidates.
Signed URLs can expire and may be sensitive: keep output files private.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urldefrag
from urllib.robotparser import RobotFileParser

MEDIA_RE = re.compile(r'''(?:https?:)?//[^\s<>"'`\\]+?\.(?:m3u8?|mp4|mpd)(?:\?[^\s<>"'`\\]*)?|(?:\.{0,2}/)?[\w./%+@~-]+\.(?:m3u8?|mp4|mpd)(?:\?[^\s<>"'`\\]*)?''', re.I)
MEDIA_TYPES = {'application/vnd.apple.mpegurl': 'hls', 'application/x-mpegurl': 'hls', 'audio/mpegurl': 'playlist', 'audio/x-mpegurl': 'playlist', 'application/dash+xml': 'dash', 'video/mp4': 'mp4'}
MAX_TEXT_BYTES = 1_000_000


def web_url(value: str, base: str = '') -> str | None:
    try:
        url = urldefrag(urljoin(base, value.replace('&amp;', '&')))[0]
        parsed = urlsplit(url)
        if parsed.scheme in ('http', 'https') and parsed.hostname and not parsed.username and not parsed.password:
            return url
    except ValueError:
        pass
    return None


def media_kind(url: str, content_type: str = '') -> str | None:
    mime = content_type.split(';')[0].strip().lower()
    if mime in MEDIA_TYPES:
        return MEDIA_TYPES[mime]
    path = urlsplit(url).path.lower()
    for suffix, kind in [('.m3u8', 'hls'), ('.m3u', 'playlist'), ('.mp4', 'mp4'), ('.mpd', 'dash')]:
        if path.endswith(suffix):
            return kind
    return None


def extract_urls(text: str, base: str) -> list[str]:
    normalized = text.replace(r'\/', '/').replace(r'\u0026', '&').replace(r'\u002F', '/')
    found = set()
    for match in MEDIA_RE.finditer(normalized):
        url = web_url(match.group(), base)
        if url:
            found.add(url)
    return sorted(found)


def json_urls(value, base: str) -> set[str]:
    result = set()
    stack = [value]
    count = 0
    while stack and count < 20000:
        count += 1
        node = stack.pop()
        if isinstance(node, dict):
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
        elif isinstance(node, str):
            url = web_url(node, base)
            if url and media_kind(url):
                result.add(url)
            result.update(extract_urls(node, base))
    return result


class Crawler:
    def __init__(self, args):
        self.args = args
        self.hosts = {urlsplit(u).hostname for u in args.urls + args.api_url} | set(args.allow_host)
        self.results = {}
        self.errors = []
        self.robots = {}
        self.robots_lock = asyncio.Lock()
        self.jobs = set()
        self.closed = False

    def record(self, url, source, evidence, content_type='', status=None):
        url = web_url(url, source)
        if not url or not media_kind(url, content_type):
            return
        kind = media_kind(url, content_type)
        row = self.results.setdefault(url, {'url': url, 'kind': kind, 'sources': [], 'evidence': [], 'http_status': None, 'playability': 'not_verified'})
        if source not in row['sources']:
            row['sources'].append(source)
        if evidence not in row['evidence']:
            row['evidence'].append(evidence)
        if status is not None:
            row['http_status'] = status

    async def permitted(self, context, url):
        host = urlsplit(url).hostname
        if host not in self.hosts:
            return False
        origin = f'{urlsplit(url).scheme}://{urlsplit(url).netloc}'
        async with self.robots_lock:
            if origin not in self.robots:
                parser = RobotFileParser()
                try:
                    response = await context.request.get(origin + '/robots.txt', timeout=10000, max_redirects=0)
                    if response.status == 404:
                        parser.parse([])
                    elif response.status == 200:
                        parser.parse((await response.text()).splitlines())
                    else:
                        self.robots[origin] = None
                        return False
                    self.robots[origin] = parser
                except Exception:
                    self.robots[origin] = None
                    return False
        parser = self.robots[origin]
        return parser is not None and parser.can_fetch('AuthorizedMediaCrawler', url)

    async def route(self, route):
        req = route.request
        if req.is_navigation_request() and not await self.permitted(route.request.frame.page.context, req.url):
            self.errors.append({'url': req.url, 'reason': 'Navigation blocked: host not allowed or robots policy unavailable/disallowed'})
            await route.abort()
        else:
            await route.continue_()

    async def response(self, response, source):
        try:
            status = response.status
            if not 200 <= status < 300:
                return
            headers = response.headers
            mime = headers.get('content-type', '').lower()
            self.record(response.url, source, 'network_response', mime, status)
            
            length = headers.get('content-length')
            if length and (not length.isdigit() or int(length) > MAX_TEXT_BYTES):
                return
            textual = 'json' in mime or media_kind(response.url, mime) in ('hls', 'playlist', 'dash')
            if not textual:
                return
            body = await asyncio.wait_for(response.text(), timeout=5)
            if len(body.encode('utf-8')) > MAX_TEXT_BYTES:
                return
                
            if 'json' in mime:
                try:
                    for url in json_urls(json.loads(body), response.url):
                        self.record(url, source, 'json_api')
                except (ValueError, RecursionError):
                    pass
        except Exception as exc:
            self.errors.append({'url': response.url, 'reason': type(exc).__name__ + ': response inspection failed'})

    def schedule(self, response, source):
        if self.closed:
            return
        task = asyncio.create_task(self.response(response, source))
        self.jobs.add(task)
        task.add_done_callback(self.jobs.discard)

    async def drain(self):
        if self.jobs:
            await asyncio.gather(*list(self.jobs), return_exceptions=True)

    async def crawl(self):
        from playwright.async_api import async_playwright
        queue = deque((u, 0) for u in self.args.urls)
        visited = set()
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(ignore_https_errors=False, accept_downloads=False)
            await context.route('**/*', self.route)
            page = await context.new_page()
            for api in self.args.api_url:
                if not await self.permitted(context, api):
                    self.errors.append({'url': api, 'reason': 'API blocked by allowed-host/robots policy'})
                    continue
                try:
                    response = await context.request.get(api, timeout=15000, max_redirects=0)
                    if response.status != 200:
                        raise ValueError(f'API HTTP {response.status}; no bypass attempted')
                    for url in json_urls(await response.json(), api):
                        self.record(url, api, 'public_api')
                except Exception as exc:
                    self.errors.append({'url': api, 'reason': str(exc)})
            while queue and len(visited) < self.args.max_pages:
                url, depth = queue.popleft()
                if url in visited:
                    continue
                visited.add(url)
                listener = lambda response, source=url: self.schedule(response, source)
                page.on('response', listener)
                try:
                    response = await page.goto(url, wait_until='domcontentloaded', timeout=self.args.timeout * 1000)
                    if response and response.status in (401, 403, 429):
                        raise ValueError(f'HTTP {response.status}; access restriction respected')
                    await page.wait_for_timeout(self.args.wait_seconds * 1000)
                    for frame in page.frames:
                        frame_url = web_url(frame.url)
                        if not frame_url or urlsplit(frame_url).hostname not in self.hosts:
                            continue
                        try:
                            html = await frame.content()
                            for media in extract_urls(html, frame_url):
                                self.record(media, url, 'iframe_html' if frame != page.main_frame else 'rendered_html')
                            values = await frame.locator('video, audio, source').evaluate_all('(els) => els.flatMap(e => [e.currentSrc, e.src, e.getAttribute("src")]).filter(Boolean)')
                            for value in values:
                                self.record(web_url(value, frame_url), url, 'media_element')
                        except Exception:
                            self.errors.append({'url': frame.url, 'reason': 'Frame unavailable or detached'})
                    if depth < self.args.depth:
                        links = await page.locator('a[href]').evaluate_all('(els) => els.map(e => e.href)')
                        for link in links:
                            link = web_url(link)
                            if link and urlsplit(link).hostname in self.hosts and link not in visited and not media_kind(link) and len(queue) < self.args.max_pages * 5:
                                queue.append((link, depth + 1))
                    await self.drain()
                    print(f'Processed {len(visited)} page(s); {len(self.results)} media candidate(s)', file=sys.stderr)
                except Exception as exc:
                    self.errors.append({'url': url, 'reason': str(exc)})
                finally:
                    page.remove_listener('response', listener)
                    await self.drain()
                    await page.goto('about:blank')
                    await asyncio.sleep(1)
            self.closed = True
            await self.drain()
            await browser.close()
        return {'generated_at_unix': int(time.time()), 'pages_visited': len(visited), 'notice': 'All media candidates extracted.', 'media': list(self.results.values()), 'errors': self.errors}


def cli():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('urls', nargs='+')
    parser.add_argument('--allow-host', action='append', default=[])
    parser.add_argument('--api-url', action='append', default=[])
    parser.add_argument('--output', type=Path, default=Path('media_results.json'))
    parser.add_argument('--max-pages', type=int, default=5)
    parser.add_argument('--depth', type=int, default=1)
    parser.add_argument('--wait-seconds', type=int, default=5)
    parser.add_argument('--timeout', type=int, default=30)
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 100 or not 0 <= args.depth <= 3 or not 1 <= args.wait_seconds <= 30 or not 5 <= args.timeout <= 120:
        parser.error('Bounds: pages 1–100, depth 0–3, wait 1–30s, timeout 5–120s')
    if any(not web_url(url) for url in args.urls + args.api_url):
        parser.error('Only credential-free HTTP(S) URLs are accepted')
    result = asyncio.run(Crawler(args).crawl())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    args.output.chmod(0o600)
    playlist = args.output.with_suffix('.m3u')
    rows = ['#EXTM3U']
    for item in result['media']:
        if item['kind'] in ('hls', 'mp4', 'dash', 'playlist'):
            rows.extend(['#EXTINF:-1,Media candidate', item['url'].replace('\n', '').replace('\r', '')])
    playlist.write_text('\n'.join(rows) + '\n', encoding='utf-8')
    playlist.chmod(0o600)
    print(f"Saved {len(result['media'])} candidates and {len(result['errors'])} issues.")


if __name__ == '__main__':
    cli()
