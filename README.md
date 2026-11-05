# 첫직장컨닝

사회초년생을 위한 월급·회사생활 컨닝페이퍼 (정적 사이트, GitHub Pages /docs 배포).

- `python3 build.py` → `src/` 를 읽어 `docs/` 생성
- 사이트 설정(도메인, 애드센스, 검색엔진 인증): `build.py` 맨 위
- 계산기 요율(4대보험, 최저임금, 실업급여 상·하한): `src/assets/calc.js` 맨 위 `R` — 매년 1월, 국민연금 상·하한은 7월에 갱신
- 메뉴 하나 = `src/sections/<id>/` (section.json, items.json, guides/*.html)
- 가이드 머리말에 `calc: yes` 를 넣으면 계산기 스크립트가 붙고 홈 '자주 쓰는 계산기'에 표시됨
