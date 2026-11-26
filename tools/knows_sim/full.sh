#!/bin/sh
# 표 전체를 봇별로 나란히 돌려 합친다 — sh tools/knows_sim/full.sh 판수 [rich]
G=$1; X=$2
OUT=/tmp/knows_sim; mkdir -p $OUT
for b in random biased repeat alternate cyclic avoidAI level1 level2 phaseSwitch firstButton human; do
  node tools/knows_sim/sim.mjs "$G" phase noheader "bots=$b" $X > $OUT/$b.txt &
done
wait
echo "| 유형 | 1~20R | 9~20R (95% CI) | 우연 1/k | 천장 | 천장 대비 | 평균 확신도 |"
echo "|---|---|---|---|---|---|---|"
for b in random biased repeat alternate cyclic avoidAI level1 level2 phaseSwitch firstButton human; do grep '^|' $OUT/$b.txt | grep -v '^| 유형\|^|---'; done
