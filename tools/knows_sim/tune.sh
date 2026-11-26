#!/bin/sh
# 조절값 여러 개를 나란히 돌려 9~20R 적중률만 한 줄씩 — sh tools/knows_sim/tune.sh 판수 "이름@설정" …
G=$1; shift
i=0
for x in "$@"; do
  i=$((i+1))
  n=${x%%@*}; c=${x#*@}
  ( node tools/knows_sim/sim.mjs "$G" "$c" | awk -v c="$n" -F'|' '/`/{ gsub(/\*|%| /,"",$4); split($4,a,"("); s=s" "substr($2,index($2,"`")+1,5)"="a[1] } /거리/{ sub(/.*: /,""); print c" ::"s" :: gap "$0 }' ) &
  if [ $((i % 7)) -eq 0 ]; then wait; fi
done
wait
