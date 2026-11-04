#!/usr/bin/env bash
# EC2 에서 실행되는 프론트엔드 배포 스크립트 (GitHub Actions 가 ssh 로 stdin 에 흘려 넣는다).
# nginx 가 /opt/antlab/ant-frontend 를 서빙한다. 새 dist 를 옆에 풀어 놓고 디렉터리를 통째로 교체하며,
# 스모크 테스트에 실패하면 직전 버전으로 되돌린다. nginx 설정/재시작은 건드리지 않는다.
set -euo pipefail

LIVE=/opt/antlab/ant-frontend
STAGE=/opt/antlab/ant-frontend.new
PREV=/opt/antlab/ant-frontend.prev
TGZ=/tmp/frontend-dist.tgz

[ -f "$TGZ" ] || { echo "!! $TGZ not found"; exit 2; }

rm -rf "$STAGE"; mkdir -p "$STAGE"
tar -xzf "$TGZ" -C "$STAGE"
[ -f "$STAGE/index.html" ] || { echo "!! index.html missing in package"; rm -rf "$STAGE"; exit 2; }
chmod -R u=rwX,go=rX "$STAGE"

rm -rf "$PREV"
mv "$LIVE" "$PREV"
mv "$STAGE" "$LIVE"
rm -f "$TGZ"

smoke() {
  local code
  code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1/ || true)"
  [ "$code" = "200" ] && curl -s -m 10 http://127.0.0.1/ | grep -qi '<div id="root"'
}

if smoke; then
  echo ">> frontend deployed ($(ls "$LIVE/assets" 2>/dev/null | wc -l) asset files), previous kept at $PREV"
  exit 0
fi

echo "!! smoke test failed - rolling back"
rm -rf "$LIVE"
mv "$PREV" "$LIVE"
smoke && echo ">> rollback OK" || echo "!! rollback ALSO failing - manual check needed"
exit 1
