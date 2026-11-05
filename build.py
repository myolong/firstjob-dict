#!/usr/bin/env python3
"""src/ 의 메뉴(섹션)와 글을 읽어 docs/ 에 정적 사이트를 만든다.

사용법: python3 build.py
GitHub Pages 설정에서 main 브랜치의 /docs 폴더를 배포 대상으로 지정한다.

메뉴 하나 = src/sections/<id>/ 폴더 하나
  section.json  메뉴 제목·설명·표 컬럼·분류
  items.json    검색표 데이터 (name, cat, 컬럼 key들, guide=가이드 slug)
  guides/*.html 가이드 글 (맨 위 --- 사이에 title·description·order)
"""
import html
import json
import re
import shutil
from datetime import date
from pathlib import Path

# ── 사이트 설정 (도메인·애드센스가 정해지면 여기만 바꾸고 다시 빌드) ──────────
SITE_URL = "https://firstjobdict.co.kr"
CUSTOM_DOMAIN = "firstjobdict.co.kr"
SITE_NAME = "첫직장컨닝"
SITE_TAGLINE = "사회초년생을 위한 월급·회사생활 컨닝페이퍼"
CONTACT_EMAIL = "salimdict.help@gmail.com"  # 문의용 이메일 (살림컨닝과 공용, 본업과 분리된 주소)
ADSENSE_CLIENT = "ca-pub-5781805498180631"  # 예: "ca-pub-1234567890123456" → 광고 스크립트·ads.txt 생성
GOOGLE_VERIFICATION = ""  # 구글 서치 콘솔 HTML 태그의 content 값
NAVER_VERIFICATION = "ea2d6bc14b047b78f80f6edeec20bbe615a30359"  # 네이버 서치어드바이저 HTML 태그의 content 값
UPDATED = date.today().isoformat()
# ───────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "docs"
BASE_PATH = re.sub(r"^https?://[^/]+", "", SITE_URL).rstrip("/")


def url(path):
    """사이트 내부 경로 (GitHub Pages 하위 경로 대응)."""
    return BASE_PATH + path


def esc(text):
    return html.escape(str(text), quote=True)


def read_guides(folder, section_id):
    guides = []
    for f in sorted(folder.glob("*.html")):
        raw = f.read_text(encoding="utf-8")
        _, front, body = raw.split("---", 2)
        meta = {}
        for line in front.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        guides.append({
            "slug": f.stem,
            "section": section_id,
            "path": f"/{section_id}/{f.stem}/",
            "title": meta["title"],
            "description": meta["description"],
            "order": int(meta.get("order", 99)),
            "calc": meta.get("calc") == "yes",
            "short": meta.get("short", ""),
            "home": meta.get("home") == "yes",
            "body": body.strip().replace('href="/', f'href="{BASE_PATH}/').replace('src="/', f'src="{BASE_PATH}/'),
        })
    return sorted(guides, key=lambda g: g["order"])


def read_sections():
    sections = []
    for d in sorted((SRC / "sections").iterdir()):
        if not (d / "section.json").exists():
            continue
        s = json.loads((d / "section.json").read_text(encoding="utf-8"))
        s["id"] = d.name
        s["path"] = f"/{d.name}/"
        s["items"] = json.loads((d / "items.json").read_text(encoding="utf-8"))
        s["guides"] = read_guides(d / "guides", d.name) if (d / "guides").exists() else []
        sections.append(s)
    return sorted(sections, key=lambda s: s["order"])


def layout(*, title, description, path, body, sections, json_ld=None, page_title=None, noindex=False):
    canonical = SITE_URL + path
    full_title = page_title or f"{title} | {SITE_NAME}"
    head_extra = []
    if noindex:
        head_extra.append('<meta name="robots" content="noindex">')
    if GOOGLE_VERIFICATION:
        head_extra.append(f'<meta name="google-site-verification" content="{esc(GOOGLE_VERIFICATION)}">')
    if NAVER_VERIFICATION:
        head_extra.append(f'<meta name="naver-site-verification" content="{esc(NAVER_VERIFICATION)}">')
    if ADSENSE_CLIENT:
        head_extra.append(
            f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={esc(ADSENSE_CLIENT)}" crossorigin="anonymous"></script>'
        )
    if json_ld:
        head_extra.append(
            '<script type="application/ld+json">' + json.dumps(json_ld, ensure_ascii=False) + "</script>"
        )
    nav = "".join(
        f'<a href="{url(s["path"])}"{" aria-current=\"page\"" if path.startswith(s["path"]) else ""}>{esc(s["short"])}</a>'
        for s in sections
    )
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(SITE_NAME)}">
<meta property="og:title" content="{esc(full_title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#f3f1ea">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap">
<link rel="icon" href="{url('/favicon.ico')}" sizes="48x48">
<link rel="icon" href="{url('/assets/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="{url('/assets/apple-touch-icon.png')}">
<link rel="stylesheet" href="{url('/assets/style.css')}">
<link rel="alternate" type="application/rss+xml" title="{esc(SITE_NAME)}" href="{url('/rss.xml')}">
{chr(10).join(head_extra)}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="{url('/')}"><img src="{url('/assets/favicon.svg')}" alt="" width="30" height="30">{esc(SITE_NAME)}</a>
    <span class="tagline">{esc(SITE_TAGLINE)}</span>
  </div>
  <nav class="menu" aria-label="메뉴"><div class="wrap">{nav}</div></nav>
</header>
<main class="wrap">
{body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>이 사이트의 계산 결과와 정보는 일반적인 상황을 기준으로 한 참고용입니다. 실제 금액과 자격은 회사 급여명세서와 고용노동부·고용24·국민연금공단 등 공식 안내를 우선해 주세요.</p>
    <p class="footer-links">
      <a href="{url('/about/')}">사이트 소개</a> ·
      <a href="{url('/privacy/')}">개인정보처리방침</a> ·
      <a href="{url('/contact/')}">문의</a>
    </p>
    <p>© {date.today().year} {esc(SITE_NAME)}</p>
  </div>
</footer>
</body>
</html>
"""


def write(path, content):
    target = OUT / path.lstrip("/")
    if path.endswith("/"):
        target = target / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def guide_cards(guides):
    return "\n".join(
        f'<li><a href="{url(g["path"])}"><strong>{esc(g["title"])}</strong>'
        f'<span>{esc(g["description"])}</span></a></li>'
        for g in guides
    )


def section_cards(sections):
    return "\n".join(
        f'<li><a href="{url(s["path"])}"><strong><span class="icon" aria-hidden="true">{esc(s["icon"])}</span>{esc(s["title"])}</strong>'
        f'<span>{esc(s["card"])}</span></a></li>'
        for s in sections
    )


def item_rows(section):
    guides = {g["slug"] for g in section["guides"]}
    rows = []
    for item in section["items"]:
        cells = []
        for col in section["columns"]:
            value = esc(item.get(col["key"], ""))
            if col["key"] == "name":
                if item.get("guide") in guides:
                    value = f'<a href="{url("/" + section["id"] + "/" + item["guide"] + "/")}">{value}</a>'
                if item.get("cat"):
                    value += f'<span class="cat-tag">{esc(item["cat"])}</span>'
                cells.append(f'<td class="food">{value}</td>')
            else:
                cls = "num" if col.get("num") else "tip" if col.get("tip") else "text"
                cells.append(f'<td class="{cls}" data-label="{esc(col["label"])}">{value}</td>')
        search = "|".join([item.get("name", "")] + item.get("aka", []))
        rows.append(f'<tr data-cat="{esc(item.get("cat", ""))}" data-name="{esc(search)}">' + "".join(cells) + "</tr>")
    return "\n".join(rows)


def calc_block(sections):
    """홈 상단: 계산기 바로가기 (calc: true 인 가이드)."""
    calcs = [g for s in sections for g in s["guides"] if g.get("calc")]
    if not calcs:
        return ""
    lis = "".join(
        f'<li><a href="{url(g["path"])}"><strong>{esc(g["short"] or g["title"])}</strong><span>{esc(g["description"])}</span></a></li>'
        for g in calcs
    )
    return f'<section class="calc-home"><h2>자주 쓰는 계산기 <small>2026년 기준</small></h2><ul>{lis}</ul></section>'


def search_index(sections):
    """홈 통합 검색용 인덱스: 모든 메뉴의 표 항목."""
    rows = []
    for s in sections:
        guides = {g["slug"] for g in s["guides"]}
        cols = [c for c in s["columns"] if c["key"] != "name"][:2]
        for item in s["items"]:
            summary = " · ".join(f'{c["label"]} {item[c["key"]]}' for c in cols if item.get(c["key"]))
            link = s["path"] + item["guide"] + "/" if item.get("guide") in guides else s["path"] + "?q=" + item["name"]
            rows.append({"n": item["name"], "k": item.get("aka", []), "s": s["short"], "d": summary, "u": url(link)})
    return rows


def build_home(sections):
    groups = {}
    for s in sections:
        groups.setdefault(s["group"], []).append(s)
    blocks = "\n".join(
        f'<section class="menu-list"><h2>{esc(g)}</h2><ul>'
        + "".join(
            f'<li><a href="{url(s["path"])}"><strong>{esc(s["title"])}</strong><span>{esc(s["card"])}</span></a>'
            f'<em>{len(s["items"])}</em></li>'
            for s in items
        )
        + "</ul></section>"
        for g, items in groups.items()
    )
    # 메뉴마다 돌아가며 하나씩 골라 홈 가이드 목록이 한 메뉴에 쏠리지 않게 한다.
    # front matter에 home: yes 인 가이드는 홈 목록 맨 위에 고정한다.
    picked = [g for s in sections for g in s["guides"] if g.get("home")]
    depth = 0
    while len(picked) < 12 and any(len(s["guides"]) > depth for s in sections):
        picked += [s["guides"][depth] for s in sections if len(s["guides"]) > depth and not s["guides"][depth].get("home")]
        depth += 1
    all_guides = picked[:12]
    body = f"""
<section class="home-search">
  <h1>첫 직장, 막힐 때 꺼내 보는 컨닝페이퍼</h1>
  <label class="gsearch">
    <span class="sr-only">전체 메뉴에서 찾기</span>
    <input id="gq" type="search" placeholder="계산기, 회사 용어, 지원제도 이름으로 찾기" autocomplete="off" data-index="{url('/search.json')}">
  </label>
  <ul class="gresults" id="gresults" hidden></ul>
  <p class="gempty" id="gempty" hidden>찾는 항목이 없어요. 짧게 한 단어로 검색해 보세요.</p>
</section>
{calc_block(sections)}
<div class="menu-cols">
{blocks}
</div>
<section class="menu-list guides-list">
  <h2>첫직장 가이드</h2>
  <ul>
{"".join(f'<li><a href="{url(g["path"])}"><strong>{esc(g["title"])}</strong></a></li>' for g in all_guides)}
  </ul>
</section>
<script src="{url('/assets/home.js')}" defer></script>
"""
    json_ld = {"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": SITE_URL + "/", "inLanguage": "ko"}
    write("/", layout(
        title=SITE_NAME, page_title=f"{SITE_NAME} - {SITE_TAGLINE}",
        description=f"{SITE_TAGLINE}. " + ", ".join(s["short"] for s in sections) + " 정보를 검색표와 가이드로 한눈에 정리했습니다.",
        path="/", body=body, sections=sections, json_ld=json_ld,
    ))
    (OUT / "search.json").write_text(json.dumps(search_index(sections), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_section(section, sections):
    chips = "".join(
        f'<button type="button" class="chip" data-cat="{esc(c)}">{esc(c)}</button>' for c in section.get("categories", [])
    )
    chip_row = (
        f'<div class="chips" role="group" aria-label="분류"><button type="button" class="chip is-on" data-cat="">전체</button>{chips}</div>'
        if chips else ""
    )
    head = "".join(f"<th>{esc(c['label'])}</th>" for c in section["columns"])
    guides_html = (
        f'<section class="guides-block"><h2>{esc(section["short"])} 가이드</h2><ul class="cards">\n{guide_cards(section["guides"])}\n</ul></section>'
        if section["guides"] else ""
    )
    body = f"""
<nav class="crumbs" aria-label="위치"><a href="{url('/')}">홈</a> › {esc(section['group'])}</nav>
<section class="hero">
  <h1>{esc(section['title'])}</h1>
  <p>{esc(section['intro'])}</p>
  <label class="search">
    <span class="sr-only">검색</span>
    <input id="q" type="search" placeholder="{esc(section['placeholder'])}" autocomplete="off">
  </label>
  {chip_row}
</section>

<section aria-label="{esc(section['title'])}">
  <div class="table-wrap">
    <table class="food-table" id="food-table">
      <thead><tr>{head}</tr></thead>
      <tbody>
{item_rows(section)}
      </tbody>
    </table>
  </div>
  <p class="empty" id="empty" hidden>찾는 항목이 없어요. 다른 이름으로 검색해 보세요.</p>
  <p class="note">{esc(section.get('note', ''))}</p>
  <p class="disclaimer">{esc(section['disclaimer'])}</p>
</section>
{guides_html}
<script src="{url('/assets/app.js')}" defer></script>
"""
    write(section["path"], layout(
        title=section["title"], page_title=f"{section['page_title']} | {SITE_NAME}",
        description=section["description"], path=section["path"], body=body, sections=sections,
        json_ld=breadcrumbs([("홈", "/"), (section["title"], section["path"])]),
    ))

    guides = section["guides"]
    for i, g in enumerate(guides):
        related = [guides[(i + k) % len(guides)] for k in (1, 2, 3) if len(guides) > k]
        related_html = (
            f'<h2>함께 보면 좋은 가이드</h2><ul class="cards">\n{guide_cards(related)}\n</ul>' if related else ""
        )
        body = f"""
<nav class="crumbs" aria-label="위치"><a href="{url('/')}">홈</a> › <a href="{url(section['path'])}">{esc(section['title'])}</a></nav>
<article class="article">
  <h1>{esc(g['title'])}</h1>
  <p class="meta">최종 업데이트 {UPDATED}</p>
  {g['body']}
  <p class="disclaimer">{esc(section['disclaimer'])}</p>
</article>
{calc_script(g)}
<aside class="related">
  {related_html}
  <p><a class="btn" href="{url(section['path'])}">{esc(section['title'])} 전체 보기</a></p>
</aside>
"""
        ld = breadcrumbs([("홈", "/"), (section["title"], section["path"]), (g["title"], g["path"])])
        ld = {"@context": "https://schema.org", "@graph": [
            {
                "@type": "Article", "headline": g["title"], "description": g["description"],
                "dateModified": UPDATED, "inLanguage": "ko", "mainEntityOfPage": SITE_URL + g["path"],
                "author": {"@type": "Organization", "name": SITE_NAME},
            },
            ld,
        ]}
        write(g["path"], layout(title=g["title"], description=g["description"], path=g["path"], body=body, sections=sections, json_ld=ld))


def calc_script(g):
    return f'<script src="{url("/assets/calc.js")}" defer></script>' if g.get("calc") else ""


def breadcrumbs(trail):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": SITE_URL + path}
            for i, (name, path) in enumerate(trail)
        ],
    }


def build_static_pages(sections):
    contact_line = (
        f'<p>이메일: <a href="mailto:{esc(CONTACT_EMAIL)}">{esc(CONTACT_EMAIL)}</a></p>'
        if CONTACT_EMAIL else "<p>이메일: 준비 중입니다.</p>"
    )
    menu_list = "".join(f"<li>{esc(s['title'])}</li>" for s in sections)
    pages = {
        "/about/": ("사이트 소개", f"{SITE_NAME}은 첫 직장을 시작한 사회초년생이 자주 찾는 월급 계산, 회사 용어, 청년 지원제도, 첫 자취 정보를 정리한 생활 정보 사이트입니다.", f"""
<h1>사이트 소개</h1>
<p>첫 월급을 받으면 "왜 생각보다 적지?", 첫 회의에 들어가면 "팔로우업이 정확히 뭐지?" 같은 질문이 생깁니다. {esc(SITE_NAME)}은 사회초년생이 매번 따로 검색하던 정보를 계산기, 검색표, 가이드로 한곳에 모은 사이트입니다.</p>
<h2>제공하는 메뉴</h2>
<ul>{menu_list}</ul>
<p>메뉴와 글은 계속 늘려 가고 있습니다.</p>
<h2>계산기와 정보 이용 시 참고사항</h2>
<p>계산기는 2026년 요율과 법령의 일반적인 기준으로 만든 추정치입니다. 회사의 급여 규정, 비과세 항목, 가족 상황에 따라 실제 금액은 달라질 수 있습니다. 지원제도는 해마다 조건과 금액이 바뀌므로, 신청 전에는 고용24·복지로·온통청년 등 공식 누리집에서 최신 공고를 꼭 확인해 주세요.</p>
<h2>오류 제보</h2>
<p>잘못된 정보나 추가했으면 하는 내용이 있다면 <a href="{url('/contact/')}">문의 페이지</a>로 알려 주세요. 확인 후 반영하겠습니다.</p>
"""),
        "/privacy/": ("개인정보처리방침", f"{SITE_NAME}의 개인정보처리방침입니다. 수집하는 정보, 쿠키와 광고, 이용자의 권리를 안내합니다.", f"""
<h1>개인정보처리방침</h1>
<p>{esc(SITE_NAME)}(이하 '사이트')는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을 준수합니다. 이 방침은 {UPDATED}부터 적용됩니다.</p>
<h2>1. 수집하는 개인정보</h2>
<p>사이트는 회원가입 기능이 없으며, 이용자가 직접 입력하는 개인정보를 수집하지 않습니다. 이메일로 문의하시는 경우 답변을 위해 보내 주신 이메일 주소와 문의 내용만을 이용하며, 답변 완료 후 지체 없이 파기합니다.</p>
<h2>2. 자동으로 수집되는 정보</h2>
<p>사이트 이용 과정에서 접속 기록, 브라우저 종류, 방문 페이지 등의 정보가 웹 서버 또는 분석·광고 도구에 의해 자동으로 생성·수집될 수 있습니다. 이 정보는 개인을 식별하지 않는 통계 목적으로만 이용됩니다.</p>
<h2>3. 쿠키와 광고</h2>
<p>사이트는 Google 애드센스를 포함한 제3자 광고 서비스를 이용할 수 있습니다. Google을 비롯한 제3자 공급업체는 쿠키를 사용하여 이용자의 이 사이트 또는 다른 웹사이트 방문 기록을 바탕으로 광고를 게재합니다. Google은 광고 쿠키를 사용하여 이용자가 이 사이트나 다른 사이트를 방문한 기록에 따라 맞춤 광고를 제공할 수 있습니다.</p>
<p>이용자는 <a href="https://adssettings.google.com" rel="nofollow noopener" target="_blank">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있으며, <a href="https://www.aboutads.info" rel="nofollow noopener" target="_blank">www.aboutads.info</a>에서 제3자 공급업체의 맞춤 광고용 쿠키 사용을 해제할 수 있습니다. 또한 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 일부 기능 이용에 제한이 있을 수 있습니다.</p>
<h2>4. 개인정보의 제3자 제공</h2>
<p>사이트는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 요구되는 경우는 예외로 합니다.</p>
<h2>5. 이용자의 권리</h2>
<p>이용자는 언제든지 문의 시 제공한 개인정보의 열람, 정정, 삭제를 요청할 수 있으며, <a href="{url('/contact/')}">문의 페이지</a>의 연락처로 요청하시면 지체 없이 처리합니다.</p>
<h2>6. 방침의 변경</h2>
<p>이 방침이 변경되는 경우 사이트에 게시하여 알립니다.</p>
"""),
        "/contact/": ("문의", f"{SITE_NAME}에 오류 제보, 항목 추가 요청, 기타 문의를 보내는 방법을 안내합니다.", f"""
<h1>문의</h1>
<p>계산 오류 제보, 추가했으면 하는 용어나 계산기, 기타 문의는 아래 이메일로 보내 주세요. 보통 2~3일 안에 답변드립니다.</p>
{contact_line}
<p>문의 시 받은 이메일 주소는 답변에만 사용하며, 자세한 내용은 <a href="{url('/privacy/')}">개인정보처리방침</a>을 참고해 주세요.</p>
"""),
    }
    for path, (title, desc, body) in pages.items():
        write(path, layout(title=title, description=desc, path=path, body=body, sections=sections))

    write("/404.html", layout(
        title="페이지를 찾을 수 없습니다", description="요청하신 페이지를 찾을 수 없습니다.", path="/404.html",
        body=f'<h1>페이지를 찾을 수 없습니다</h1><p>주소가 바뀌었거나 삭제된 페이지입니다.</p><p><a class="btn" href="{url("/")}">홈으로 가기</a></p>',
        sections=sections, noindex=True,
    ))


def build_meta_files(sections):
    guides = [g for s in sections for g in s["guides"]]
    paths = ["/"] + [s["path"] for s in sections] + [g["path"] for g in guides] + ["/about/", "/privacy/", "/contact/"]
    entries = "\n".join(f"  <url><loc>{SITE_URL}{p}</loc><lastmod>{UPDATED}</lastmod></url>" for p in paths)
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n',
        encoding="utf-8",
    )
    items = "\n".join(
        f"<item><title>{esc(x['title'])}</title><link>{SITE_URL}{x['path']}</link>"
        f"<guid>{SITE_URL}{x['path']}</guid><description>{esc(x['description'])}</description></item>"
        for x in sections + guides
    )
    (OUT / "rss.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{esc(SITE_NAME)}</title>'
        f"<link>{SITE_URL}/</link><description>{esc(SITE_TAGLINE)}</description><language>ko</language>\n"
        f"{items}\n</channel></rss>\n",
        encoding="utf-8",
    )
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    if CUSTOM_DOMAIN:
        (OUT / "CNAME").write_text(CUSTOM_DOMAIN + "\n", encoding="utf-8")
    if ADSENSE_CLIENT:
        pub = ADSENSE_CLIENT.replace("ca-", "")
        (OUT / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(SRC / "assets", OUT / "assets")
    shutil.copy(SRC / "assets" / "favicon.ico", OUT / "favicon.ico")  # 검색엔진이 찾는 기본 위치
    # 검색엔진 인증 파일처럼 사이트 루트에 그대로 둘 파일
    for f in (SRC / "root").glob("*"):
        shutil.copy(f, OUT / f.name)
    sections = read_sections()
    build_home(sections)
    for s in sections:
        build_section(s, sections)
    build_static_pages(sections)
    build_meta_files(sections)
    total = sum(len(s["guides"]) for s in sections)
    print(f"built {len(sections)} sections, {total} guides → {OUT}")


if __name__ == "__main__":
    main()
