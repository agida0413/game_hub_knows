#!/bin/sh
# 넉넉한 세트(매번 4지)만 봇별로 나란히 — 상황 구성의 한계와 엔진의 한계를 나눠 보기
G=$1
for b in random biased repeat alternate cyclic avoidAI level1 level2 phaseSwitch firstButton human; do
  node tools/knows_sim/sim.mjs "$G" noheader richonly "bots=$b" > /tmp/r_$b.txt &
done
wait
for b in random biased repeat alternate cyclic avoidAI level1 level2 phaseSwitch firstButton human; do grep '^|' /tmp/r_$b.txt; done
