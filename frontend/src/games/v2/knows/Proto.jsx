// 「AI KNOWS YOU · 숨긴 사진」 시제품 — 사진 하나를 몰래 고르고, 끝까지 '아니'. 손이 늦어진 사진으로 AI가 찾는다
//   진행은 game.js · 판정은 engine.js · 단계와 기록은 ladder.js · 사진 세트는 sets.js (모두 순수 · node --test).
//   반응 시간 원자료는 이 화면의 메모리에만 있고 라운드 판정이 끝나면 버린다 — 저장 · 전송하지 않는다.
//   기기에 남기는 것은 단계 기록(숫자 요약 · PROG_KEY)과 음악 켜짐뿐. 지표는 gameEvent 이름(open · start · clear)만,
//   단계를 처음 깨면 허브 EXP(awardXp — 서버 하루 상한). 아이콘은 lucide-react 와 직접 그린 SVG만
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import {
  CalendarDays, Eye, EyeOff, Flame, Gauge, Images, Lock, Music, RotateCcw, Share2, Sparkles, Swords, Trophy, VolumeX,
} from 'lucide-react'
import { exp, shareUrl, track } from '../../../platform/index.js'   // 막간 공용 약속만 (허브 · 다른 게임 · 앱 전역은 가져오지 않는다)
import { roundLabels } from './metrics.js'
import { slip as slipSound, sting, tap } from './sfx.js'
import { LOAD_WAIT_MS, SHOW_MS, askLine, closingLine, init, loseLine, photosOf, photosReady, reduce, secText, shareText, trialMark } from './game.js'
import {
  MAX_STAGE, SPEEDS, STAGES, applyGame, currentStage, dailyOf, kstDate, loadHabit, loadProg, needOf, saveHabit, saveProg, setUnlockedBy, stageCfg, titleOf,
} from './ladder.js'
import { SETS, SET_BY_ID, SHAPES } from './sets.js'
import { TUTORIAL, practicePair, showPractice } from './tutorial.js'
import { CoachFinger, CoachLine, HelpButton, MoreGames, useCoach, useFirstTouch, useRunGuard } from '../../../platform/react.js'

const IMG = { stage: '/knows/img/stage.webp', cover: '/knows/img/cover.webp' }
const MUS = { loop: '/knows/music/loop.mp3', reveal: '/knows/music/reveal.mp3' }
const MUSIC_KEY = 'knows.mus'   // 옛 knw3.music (platform/keys.js 이사)
const NOTICE = '재미를 위한 놀이 · 진단 아님'

const CSS = `
.kv{min-height:100dvh;max-width:480px;margin:0 auto;display:flex;flex-direction:column;background:#0d0b14;color:#efe9ff;font-family:Pretendard,'Noto Sans KR',system-ui,sans-serif;font-size:16px;position:relative;overflow:hidden;box-sizing:border-box;word-break:keep-all}
.kv *{box-sizing:border-box}
:where(.kv) button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.kv>*{position:relative;z-index:1}
.kv>.kv-bg{position:absolute;inset:-24px;background-size:cover;background-position:center;filter:blur(10px) brightness(.5);z-index:0;pointer-events:none}
.kv-top{display:flex;align-items:center;gap:4px;padding:10px 10px}
.kv-chip{flex:none;background:#1d1828e6;border:1px solid #3b3556;border-radius:999px;padding:0 10px;min-height:44px;display:flex;align-items:center;gap:3px;font-weight:800;font-size:15px;white-space:nowrap}
.kv-chip.r{border-color:#ff6b74;padding-left:4px}
.kv-chip b{color:#43c2cc;margin:0 3px}
.kv-chip b.m{color:#ff6b74}
.kv-mus{margin-left:auto;flex:none;display:grid;place-items:center;padding:0;width:44px;height:44px;border-radius:50%;border:1px solid #3b3556;background:#1d1828e6}
.kv-say{margin:4px 16px 10px;font-size:20px;font-weight:800;text-align:center}
.kv-new{display:flex;align-items:center;justify-content:center;gap:6px;margin:-4px auto 10px;padding:4px 12px;border-radius:999px;background:#f3d36b22;color:#f3d36b;font-weight:800;font-size:15px;width:max-content}
.kv-grid{display:grid;grid-template-columns:repeat(2,var(--t));justify-content:center;gap:10px;padding:0 16px;flex:1;align-content:start}
.kv-grid>:last-child:nth-child(odd){grid-column:1/-1;justify-self:center;width:var(--t)}
.kv-ph{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;background:#1d1828;user-select:none;-webkit-user-drag:none}
.kv-shape{display:grid;place-items:center;background:radial-gradient(110% 100% at 50% 38%,#2c2546 0,#0b0910 100%)}
.kv-shape svg{width:62%;height:62%;fill:#f3d36b;filter:drop-shadow(0 0 10px #f3d36b77)}
.kv-bot{padding:12px 16px 18px;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative}
.kv-bot.run{margin-top:auto;padding-bottom:22px}
.kv .kv-coach{margin:4px 16px 8px;width:auto}
.kv-btn{position:relative;overflow:hidden;min-height:56px;min-width:180px;padding:0 28px;border-radius:16px;border:0;background:#43c2cc;color:#071a1d;font-size:20px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.kv-btn.sub{background:#1d1828;color:#efe9ff;border:1px solid #4a4560;min-height:48px;font-size:17px}
.kv-btn.wide{width:100%;max-width:320px}
.kv-btn[disabled]{background:#22303a;color:#9fb6bd}
.kv-btn .fill{position:absolute;left:0;top:0;bottom:0;background:#43c2cc55;animation:kvfill linear both}
.kv-btn span{position:relative}
@keyframes kvfill{from{width:0}to{width:100%}}
.kv-ask{display:flex;align-items:center;justify-content:center;gap:8px;font-size:18px;font-weight:800;color:#bfe9ee;min-height:30px}
.kv-frame{position:relative;width:min(90vw,360px);aspect-ratio:1;margin:6px auto 0;border-radius:20px;overflow:hidden;background:#07060b;box-shadow:0 10px 40px #000a}
.kv-frame .kv-ph{position:absolute;inset:0;height:100%;border-radius:0;opacity:0;transition:opacity .12s ease-out}
.kv-frame .kv-ph.on{opacity:1;transition:none}
.kv-frame::after{content:'';position:absolute;inset:0;border-radius:20px;pointer-events:none;box-shadow:inset 0 0 0 7px #ff6b74;opacity:0}
.kv-frame.tg::after{opacity:1}
.kv-frame.bad{animation:kvshake .32s}
@keyframes kvshake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.kv-fix{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;background:#43c2cc66}
.kv-hint{margin:10px 16px 0;text-align:center;font-size:15px;color:#a9a3c0;min-height:22px}
.kv-hint.bad{color:#ff6b74;font-weight:800}
.kv-hint i{display:inline-block;width:14px;height:14px;border:3px solid #ff6b74;border-radius:4px;vertical-align:-2px;margin-right:6px}
.kv-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:3px;margin:10px auto 0;max-width:300px}
.kv-dots i{width:6px;height:6px;border-radius:50%;background:#2c2840}
.kv-dots i.d{background:#43c2cc}
.kv-dots i.x{background:#ff6b74}
.kv-no{width:100%;min-height:96px;border-radius:24px;border:0;background:#43c2cc;color:#071a1d;font-size:34px;font-weight:900;letter-spacing:2px}
.kv-no:active{transform:scale(.98);background:#5fd3dc}
.kv-yes{min-width:120px;min-height:48px;border-radius:14px;border:2px solid #ff6b74;background:transparent;color:#ff6b74;font-size:20px;font-weight:900}
.kv-yes:active{background:#ff6b7433}
.kv-tb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:0 16px}
.kv-tb h2{margin:0;font-size:32px;font-weight:900}
.kv-pair{display:grid;grid-template-columns:repeat(var(--k),1fr);gap:12px;width:100%}
.kv-pair .kv-ph{animation:kvpop .5s both}
.kv-pair .kv-ph:nth-child(2){animation-delay:.15s}
.kv-pair .kv-ph:nth-child(3){animation-delay:.3s}
@keyframes kvpop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}
.kv-q{margin:2px 16px 0;text-align:center;font-size:30px;font-weight:900;min-height:40px;display:flex;align-items:center;justify-content:center;gap:8px}
.kv-q.hit{color:#ff6b74}
.kv-q.safe{color:#43c2cc}
.kv-sub{margin:2px 16px 0;text-align:center;font-size:15px;color:#bdb6d6;min-height:20px}
.kv-env{position:relative;width:200px;height:196px;margin:4px auto 0;perspective:600px}
.kv.cmp .kv-env{transform:scale(.72);transform-origin:50% 0;margin-bottom:-55px}
.kv-env .back,.kv-env .front{position:absolute;left:0;right:0;bottom:0;height:104px;border-radius:10px}
.kv-env .back{background:#b9a77f}
.kv-env .front{background:linear-gradient(#e7dcc0,#d6c7a2);clip-path:polygon(0 0,50% 52%,100% 0,100% 100%,0 100%);z-index:3}
.kv-env .flap{position:absolute;left:0;right:0;top:92px;height:62px;background:#cdbd96;clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top;z-index:4;animation:kvflap .55s .15s both}
@keyframes kvflap{0%{transform:rotateX(0);z-index:4}55%{z-index:4}56%{z-index:1}100%{transform:rotateX(180deg);z-index:1}}
.kv-env .wax{position:absolute;left:50%;top:136px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#e0505a,#8f1d26);z-index:5;animation:kvwax .3s .1s both}
@keyframes kvwax{to{transform:scale(.4);opacity:0}}
.kv-env .card{position:absolute;left:28px;top:4px;width:144px;height:144px;border-radius:14px;overflow:hidden;z-index:2;box-shadow:0 8px 26px #000b;animation:kvcard .8s .55s both cubic-bezier(.2,.8,.2,1)}
.kv-env .card .kv-ph{height:100%;border-radius:0}
@keyframes kvcard{from{transform:translateY(80px) scale(.9)}to{transform:none}}
.kv-env .eye{position:absolute;right:16px;top:-4px;width:34px;height:34px;border-radius:50%;background:#c2343f;display:grid;place-items:center;z-index:6;color:#fff;animation:kvpop .4s 1.1s both}
.kv-cap{margin:10px 16px 4px;font-size:14px;color:#a9a3c0;display:flex;justify-content:space-between}
.kv-bars{display:flex;flex-direction:column;gap:4px;padding:0 16px}
.kv.cmp .kv-bars{gap:2px}
.kv-row{display:flex;align-items:center;gap:10px;min-height:46px;padding:3px 8px 3px 3px;border-radius:12px;border:1px solid transparent;background:transparent;width:100%;text-align:left}
.kv.cmp .kv-row{min-height:44px;padding-top:1px;padding-bottom:1px}
button.kv-row:not(:disabled){border-color:#3b3556;background:#1d1828aa}
button.kv-row:disabled{cursor:default;opacity:1}
button.kv-row:not(:disabled):active{background:#2a2440}
.kv-row.real{border-color:#43c2cc;background:#43c2cc1f}
.kv-row .kv-ph.th{width:40px;height:40px;flex:none;border-radius:9px}
.kv-track{flex:1;height:16px;border-radius:8px;background:#2c2840;overflow:hidden}
.kv-track i{display:block;height:100%;border-radius:8px;background:#5d5680;transform-origin:left;animation:kvgrow .7s 1.2s both ease-out}
.kv-row.g .kv-track i{background:#ff6b74}
.kv-row.real .kv-track i{background:#43c2cc}
@keyframes kvgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.kv-ms{min-width:62px;text-align:right;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}
.kv-ic{width:20px;flex:none;display:grid;place-items:center;color:#ff6b74}
.kv-two{display:flex;gap:10px;width:100%;max-width:320px}
.kv-two .kv-btn{flex:1;min-width:0;padding:0 10px}
.kv-cv{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:11px;padding:24px 16px 20px;text-align:center;position:relative;background-size:cover;background-position:center top}
.kv-cv::before{content:'';position:absolute;inset:0;background:linear-gradient(#0d0b1400 12%,#0d0b14d9 46%,#0d0b14)}
.kv-cv>*{position:relative}
.kv-cv.end{gap:8px;padding-top:14px;padding-bottom:14px}
.kv-cv.end .kv-h{font-size:36px}
.kv-eb{margin:0;font-size:14px;letter-spacing:3px;color:#43c2cc;font-weight:800}
.kv-eb.st{letter-spacing:1px;font-size:16px;display:flex;align-items:center;gap:6px}
.kv-h{margin:0;font-size:40px;font-weight:900;line-height:1.1}
.kv-h.win{color:#43c2cc}
.kv-h.lose{color:#ff6b74}
.kv-p{margin:0;font-size:18px;line-height:1.45;max-width:320px}
.kv-note{margin:0;font-size:12px;color:#8f89a8;display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:wrap}
.kv-big{font-size:58px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:10px}
.kv-big small{font-size:24px;color:#bdb6d6;font-weight:800}
.kv-big .a{color:#ff6b74}
.kv-big .m{color:#43c2cc}
.kv-rounds{display:flex;gap:10px;justify-content:center;padding:10px 12px 8px;background:#1d1828d9;border:1px solid #3b3556;border-radius:16px;max-width:100%}
.kv-rt{position:relative;width:52px;flex:none;display:flex;flex-direction:column;gap:6px;align-items:center;--c:#43c2cc}
.kv-rt.hit{--c:#ff6b74}
.kv-rt .kv-ph{width:52px;height:52px;border-radius:12px;box-shadow:0 0 0 2px var(--c)}
.kv-rt b{position:absolute;right:-6px;top:-6px;width:22px;height:22px;border-radius:50%;background:var(--c);color:#0d0b14;display:grid;place-items:center}
.kv-rt i{display:block;width:100%;height:6px;border-radius:3px;background:#2c2840;overflow:hidden}
.kv-rt i em{display:block;height:100%;border-radius:3px;background:var(--c);transform-origin:left;animation:kvgrow .7s .3s both ease-out}
.kv-line{margin:0;font-size:16px;color:#d9d3ee;min-height:22px;max-width:320px;white-space:pre-line;line-height:1.4}
.kv-link{min-height:44px;padding:0 16px;border:0;background:transparent;color:#bdb6d6;font-size:15px;display:inline-flex;align-items:center;gap:6px}
.kv-toast{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);background:#1d1828;border:1px solid #43c2cc;border-radius:12px;padding:10px 16px;font-weight:700;z-index:9}
.kv-ai{width:100%;max-width:320px;display:flex;align-items:center;gap:12px;background:#1d1828cc;border:1px solid #3b3556;border-radius:18px;padding:10px 12px;text-align:left}
.kv-ai .t{display:flex;flex-direction:column;gap:6px;min-width:0}
.kv-ai .nm{font-size:22px;font-weight:900;display:flex;align-items:baseline;gap:8px}
.kv-ai .nm small{font-size:16px;color:#bdb6d6;font-weight:800}
.kv-bds{display:flex;flex-wrap:wrap;gap:6px}
.kv-bd{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 9px;border-radius:999px;background:#2a2440;color:#d9d3ee;font-size:14px;font-weight:700;white-space:nowrap}
.kv-bd svg{color:#43c2cc}
.kv-steps{display:flex;align-items:flex-end;gap:6px;height:64px;width:100%;max-width:300px;padding-top:20px}
.kv-steps i{flex:1;position:relative;border-radius:6px 6px 3px 3px;background:#2c2840}
.kv-steps i.won{background:#43c2cc}
.kv-steps i.cur{background:#ff6b7433;box-shadow:inset 0 0 0 2px #ff6b74;animation:kvpulse 1.4s ease-in-out infinite}
.kv-steps i.just{animation:kvrise .9s .4s both cubic-bezier(.2,.8,.2,1);transform-origin:bottom}
.kv-steps i b{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:3px;font-size:15px;font-style:normal;color:#ff6b74;font-weight:900}
@keyframes kvpulse{50%{box-shadow:inset 0 0 0 2px #ff6b74,0 0 14px #ff6b7488}}
@keyframes kvrise{from{transform:scaleY(.15);background:#2c2840}to{transform:none}}
.kv-sets{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;max-width:330px}
.kv-st{width:24px;height:24px;border-radius:7px;overflow:hidden;display:grid;place-items:center;background:#1d1828;border:1px solid #3b3556;color:#6f6990;flex:none}
.kv-st .kv-ph{width:100%;height:100%;border-radius:0}
.kv-st.new{box-shadow:0 0 0 2px #f3d36b}
.kv-me{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.kv-me .kv-bd svg{color:#f3d36b}
.kv-unl{width:100%;max-width:320px;display:flex;flex-direction:column;gap:8px;align-items:center;padding:10px;border-radius:16px;background:#f3d36b14;border:1px solid #f3d36b66}
.kv-unl .h{display:flex;align-items:center;gap:6px;font-weight:900;color:#f3d36b;font-size:17px}
.kv-unl .row{display:flex;gap:6px;justify-content:center}
.kv-unl .row>span{display:block;animation:kvpop .45s both}
.kv-unl .row .kv-ph{width:38px;height:38px;border-radius:9px}
.kv-nx{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;flex-wrap:wrap;justify-content:center}
.kv-nx .d{color:#bdb6d6;font-weight:700}
@media (prefers-reduced-motion:reduce){.kv *{animation-duration:.01s!important;animation-delay:0s!important}}
.kv-frame{--fr:350px}
.kv.co .kv-frame{--fr:396px}
.kv[data-phase=practice] .kv-frame{--fr:370px}
@supports (height:100dvh){.kv-frame{width:min(90vw,360px,max(200px,calc(100dvh - var(--fr))))}}
@media (max-height:760px){
.kv-top{padding-top:6px;padding-bottom:6px}
.kv-bot{padding-top:8px;padding-bottom:10px}
.kv-bot.run{padding-bottom:12px}
.kv-no{min-height:80px}
.kv-frame{--fr:314px}
.kv.co .kv-frame{--fr:358px}
.kv[data-phase=practice] .kv-frame{--fr:334px}
.kv-q{font-size:26px;min-height:34px;margin-top:0}
.kv-env,.kv.cmp .kv-env{transform:scale(.72);transform-origin:50% 0;margin-top:0;margin-bottom:-55px}
.kv.cmp .kv-env{transform:scale(.46);margin-bottom:-106px}
.kv-cap{margin-top:6px;margin-bottom:2px}
.kv-bars,.kv.cmp .kv-bars{gap:2px}
.kv-row{min-height:44px;padding-top:1px;padding-bottom:1px}
.kv.co .kv-cap{display:none}
.kv.co .kv-env{transform:scale(.5);margin-bottom:-98px}
.kv.cmp.co .kv-env{display:none}
}
`

const newSeed = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] } catch { return Math.floor(Math.random() * 4294967296) } }
const buzz = (p) => { try { navigator.vibrate?.(p) } catch { /* 진동 없음 */ } }
const store = () => { try { return window.localStorage } catch { return null } }
const range = (n) => Array.from({ length: n }, (_, i) => i)

// 두 색 사이 — AI 눈 색이 단계에 따라 청록에서 빨강으로
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

// 사진 한 장 — 색 라운드는 조명 받은 색 카드, 도형 라운드는 빛나는 도형(둘 다 코드로 그림)
function Photo({ it, className = '' }) {
  if (it.color) {
    return (
      <div
        className={'kv-ph ' + className} role="img" aria-label={it.name}
        style={{ background: `radial-gradient(36% 26% at 40% 30%, #ffffff30, transparent 70%), radial-gradient(120% 110% at 50% 38%, ${it.color} 0, ${it.color} 30%, #0b0910 100%)` }}
      />
    )
  }
  if (it.shape) {
    return (
      <div className={'kv-ph kv-shape ' + className} role="img" aria-label={it.name}>
        <svg viewBox="0 0 100 100" aria-hidden="true"><path d={SHAPES[it.shape]} /></svg>
      </div>
    )
  }
  return <img className={'kv-ph ' + className} src={it.src} alt={it.name} style={{ objectPosition: it.pos }} draggable="false" />
}

// AI 눈 — 둘레 눈금 10개 중 단계만큼 켜진다(직접 그린 SVG)
function AiEye({ stage, size = 56 }) {
  const lv = Math.max(1, Math.min(MAX_STAGE, stage || 3))
  const col = mix('#43c2cc', '#ff6b74', (lv - 1) / (MAX_STAGE - 1))
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      {range(MAX_STAGE).map((k) => {
        const a = ((-90 + k * 36) * Math.PI) / 180
        return <line key={k} x1={32 + 25 * Math.cos(a)} y1={32 + 25 * Math.sin(a)} x2={32 + 30 * Math.cos(a)} y2={32 + 30 * Math.sin(a)} stroke={k < lv ? col : '#3b3556'} strokeWidth="3.2" strokeLinecap="round" />
      })}
      <path d="M11 32c5-8 12-12 21-12s16 4 21 12c-5 8-12 12-21 12s-16-4-21-12z" fill="#0d0b14" stroke={col} strokeWidth="2.4" />
      <circle cx="32" cy="32" r="7.5" fill={col} />
      <circle cx="32" cy="32" r="3" fill="#0d0b14" />
      <circle cx="34.3" cy="29.6" r="1.5" fill="#fff" fillOpacity=".85" />
    </svg>
  )
}

// 사다리 — 10단계가 계단처럼 오른다. 깬 단계 청록 · 지금 단계 빨강 테두리 · 방금 깬 단계는 차오른다
function Steps({ best, stage, just = 0 }) {
  return (
    <div className="kv-steps" data-steps role="img" aria-label={`${MAX_STAGE}단계 중 ${best}단계 깸`}>
      {STAGES.map((s) => {
        const cls = s.stage <= best ? 'won' : s.stage === stage ? 'cur' : ''
        return (
          <i key={s.stage} className={cls + (s.stage === just ? ' just' : '')} style={{ height: `${30 + s.stage * 7}%` }}>
            {s.stage === stage && s.stage > best ? <b>{s.stage}</b> : null}
          </i>
        )
      })}
    </div>
  )
}

// 세트 표지 — 세트의 첫 사진(색 · 도형은 코드로)
function SetThumb({ set }) {
  if (set.id === 'color') return <i className="kv-ph" style={{ background: `conic-gradient(${set.items.map((c) => c.color).join(',')})` }} />
  return <Photo it={set.items.find((x) => x.shape === 'star') || set.items[0]} />
}

// 사진 세트 모음 — 열린 것은 사진, 잠긴 것은 자물쇠
function SetStrip({ best, fresh }) {
  return (
    <div className="kv-sets" data-sets aria-label={`사진 세트 ${SETS.filter((s) => s.unlock <= best).length}/${SETS.length}`}>
      {SETS.map((s) => (s.unlock <= best
        ? <span key={s.id} className={'kv-st' + (fresh === s.id ? ' new' : '')} title={s.name}><SetThumb set={s} /></span>
        : <span key={s.id} className="kv-st" aria-hidden="true"><Lock size={12} strokeWidth={2.4} /></span>))}
    </div>
  )
}

function Badge({ icon: I, children }) {
  return <span className="kv-bd"><I size={15} strokeWidth={2.2} />{children}</span>
}

// 단계 정보 — 사진 수 · 몇 판 몇 선승 · 빠르기
function StageBadges({ cfg }) {
  return (
    <span className="kv-bds">
      <Badge icon={Images}>{`${cfg.n}장`}</Badge>
      <Badge icon={Swords}>{`${cfg.rounds}판 ${needOf(cfg.rounds)}선승`}</Badge>
      <Badge icon={Gauge}>{SPEEDS[cfg.speed - 1].name}</Badge>
    </span>
  )
}

// 배경음악 — 10초 시제품 방식(첫 터치에 재생 · 켜기/끄기) + 켜짐 상태를 이 기기에 기억. 루프와 공개 곡을 바꿔 튼다
function useMusic() {
  const au = useRef({})
  const cur = useRef('loop')
  const [on, setOn] = useState(() => { try { return localStorage.getItem(MUSIC_KEY) !== '0' } catch { return true } })
  const onRef = useRef(on)
  onRef.current = on
  const get = (k) => {
    if (!au.current[k]) {
      const a = new Audio(MUS[k])
      a.loop = k === 'loop'
      a.volume = k === 'loop' ? 0.35 : 0.5
      au.current[k] = a
    }
    return au.current[k]
  }
  const play = (k) => {
    try {
      cur.current = k
      for (const [name, a] of Object.entries(au.current)) if (name !== k) a.pause()
      const a = get(k)
      if (k === 'reveal') a.currentTime = 0
      if (onRef.current) a.play().catch(() => {})
    } catch { /* 소리 없음 */ }
  }
  const toggle = () => {
    const next = !on
    setOn(next)
    onRef.current = next
    try { localStorage.setItem(MUSIC_KEY, next ? '1' : '0') } catch { /* 저장 안 됨 */ }
    try {
      if (next) get(cur.current).play().catch(() => {})
      else for (const a of Object.values(au.current)) a.pause()
    } catch { /* 소리 없음 */ }
  }
  // 화면을 숨기면 멈추고(다른 앱 · 공유 창으로 가도 음악이 계속 났다), 돌아오면 그때 나던 곡만 다시 — ref 만 써서 오래된 클로저에서도 안전
  const held = useRef(false)
  const hold = () => {
    try {
      const a = au.current[cur.current]
      held.current = held.current || !!(a && !a.paused)
      for (const x of Object.values(au.current)) x.pause()
    } catch { /* 소리 없음 */ }
  }
  const resume = () => {
    try { if (held.current && onRef.current) get(cur.current).play().catch(() => {}) } catch { /* 소리 없음 */ }
    held.current = false
  }
  useEffect(() => () => { try { for (const a of Object.values(au.current)) a.pause() } catch { /* 소리 없음 */ } }, [])
  return { on, play, toggle, hold, resume }
}

function Top({ st, mus }) {
  return (
    <div className="kv-top">
      <div className="kv-chip r" data-chip>
        {st.daily ? <CalendarDays size={20} strokeWidth={2} /> : <AiEye stage={st.stage} size={24} />}
        {`${st.daily ? '오늘' : `${st.stage}단계`} · ${st.round + 1}/${st.rounds.length}`}
      </div>
      <div className="kv-chip" data-score>AI<b className="m">{st.ai}</b>:<b>{st.me}</b>나</div>
      <button type="button" className="kv-mus" aria-label="음악" onClick={mus.toggle}>{mus.on ? <Music size={22} strokeWidth={2} /> : <VolumeX size={22} strokeWidth={2} />}</button>
    </div>
  )
}

// 라운드 요약 — 라운드마다 진짜 사진 한 장(빨강 테 = 들킴 · 청록 테 = 숨김) · 아래 막대 = 그 사진에서 손이 늦어진 정도
//   가로 한 줄이라 다섯 라운드도 한 화면에 들어간다
function RoundRows({ results }) {
  return (
    <div className="kv-rounds" data-card>
      {results.map((r, i) => (
        <span key={i} className={'kv-rt' + (r.hit ? ' hit' : ' safe')}>
          <Photo it={SET_BY_ID[r.set].items[r.item]} />
          <b>{r.hit ? <Eye size={14} strokeWidth={2.4} aria-label="들킴" /> : <EyeOff size={14} strokeWidth={2.4} aria-label="숨김" />}</b>
          <i><em style={{ width: `${Math.max(8, r.frac * 100)}%` }} /></i>
        </span>
      ))}
    </div>
  )
}

const SLIP_LINE = { wrongYes: '테두리 없으면 아니', wrongNo: '테두리면 예', late: '조금 더 빨리', early: '사진 보고 누르기' }

export default function Proto() {
  const [prog, setProg] = useState(() => loadProg(store()))
  const [st, dispatch] = useReducer(reduce, undefined, () => init(newSeed(), { stage: currentStage(prog), best: prog.best, firstGame: prog.plays === 0, habit: loadHabit(store()) }))
  useRunGuard(st.phase === 'run')
  const mus = useMusic()
  // 표지에도 판과 같은 루프 곡 — 첫 터치에 시작(꺼 둔 사람에게는 안 남), 판에 들어가도 같은 곡이라 끊기지 않는다
  useFirstTouch(st.phase === 'cover', () => mus.play('loop'))
  const [ready, setReady] = useState(false)
  const [slipView, setSlipView] = useState(null)
  const [line, setLine] = useState('')
  const [toast, setToast] = useState('')
  const [end, setEnd] = useState(null)
  const [prac, setPrac] = useState(null)   // 첫 판 연습 두 칸 (화면만 · 판정 · 기록에 안 들어감) — null 이거나 { k: 0 | 1, bad: 틀리게 누른 횟수 }
  const pracDone = useRef(false)
  const [again, setAgain] = useState(false)   // '?' 다시 보기를 눌렀다: 연습 두 칸도 다음 판 첫 라운드에 다시
  // 안내(코치): 상태 이름 = 사진 보기 show · 연습 practice · 빠른 진행 run · 라운드 결과 done (그 밖은 안내 없음)
  const coachState = prac ? 'practice' : st.phase === 'show' || st.phase === 'run' || st.phase === 'done' ? st.phase : 'other'
  const coach = useCoach(TUTORIAL, { state: coachState, already: () => prog.plays > 0 })
  const doneRef = useRef(null)
  const photos = st.phase === 'cover' || st.phase === 'result' ? [] : photosOf(st)
  const curSet = st.phase === 'cover' || st.phase === 'result' ? null : SET_BY_ID[st.rounds[st.round].set]

  useEffect(() => { track('knows', 'open') }, [])

  // 화면을 숨기면(다른 앱 · 알림 · 화면 끔) 음악을 멈추고, 빠른 진행 중이면 떠 있던 칸을 판정에서 뺀다(game.js 'away'). 돌아오면 준비 시간 뒤 이어서
  useEffect(() => {
    const onVis = () => {
      const now = performance.now()
      if (document.hidden) { mus.hold(); dispatch({ type: 'away', now }) } else { mus.resume(); dispatch({ type: 'back', now }) }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 연습 중 안내 줄의 X(건너뛰기)를 누르면 연습도 끝내고 바로 본 게임으로 (엔진에는 picked 하나만)
  useEffect(() => {
    if (prac && !coach.active) { pracDone.current = true; setPrac(null); dispatch({ type: 'picked', now: performance.now() }) }
  }, [coach.active]) // eslint-disable-line react-hooks/exhaustive-deps
  // 공개 화면에 들어가면 '빠르게, 끝까지 아니' 단계(when: run)가 끝난다. useLayoutEffect 라야 useCoach 가 상태를 'other'로
  //   바꾸는 useEffect 보다 먼저 닿는다 — useEffect 로 보내면 단계가 이미 안 보이는 상태라 버려져, 첫 세션 내내 이 줄이 판마다
  //   다시 뜨고 다음 단계('손이 늦은 사진이 들켜요')는 끝내 안 나왔다(11/25 전체 시험)
  useLayoutEffect(() => { if (st.phase === 'reveal') coach.emit('reveal') }, [st.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // 빠른 진행 · '둘 중 하나' 안내 — 화면 프레임마다 시각을 넘긴다 (상태가 안 바뀌면 다시 그리지 않음)
  useEffect(() => {
    if (st.phase !== 'run' && st.phase !== 'tbIntro') return undefined
    let id = 0
    const loop = () => { dispatch({ type: 'tick', now: performance.now() }); id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [st.phase])

  // 사진 보기 — 3초가 지나고 이 라운드 사진이 다 받아져야 [골랐어요] (느린 망에서 빈칸으로 빠른 진행이 시작되지 않게).
  //   끝내 안 받아지면 LOAD_WAIT_MS 뒤에는 그냥 켠다
  useEffect(() => {
    if (st.phase !== 'show') return undefined
    setReady(false)
    let alive = true
    let timeUp = false
    let loaded = false
    const go = () => { if (alive && timeUp && loaded) setReady(true) }
    const t = setTimeout(() => { timeUp = true; go() }, SHOW_MS)
    const cap = setTimeout(() => { loaded = true; go() }, SHOW_MS + LOAD_WAIT_MS)
    photosReady(photosOf(st)).then(() => { loaded = true; go() })
    return () => { alive = false; clearTimeout(t); clearTimeout(cap) }
  }, [st.phase, st.shownAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // 잘못 누름 · 늦음 — 1초짜리 가르침 (흔들림 · 소리 · 한 줄)
  useEffect(() => {
    if (!st.slip) return undefined
    slipSound(mus.on)
    buzz(60)
    const tr = st.trials[st.trials.length - 1]
    setSlipView({ at: st.slip.at, key: st.slip.kind === 'late' || st.slip.kind === 'early' ? st.slip.kind : tr && tr.target ? 'wrongNo' : 'wrongYes' })
    const t = setTimeout(() => setSlipView(null), 1000)
    return () => clearTimeout(t)
  }, [st.slip?.at])  // eslint-disable-line react-hooks/exhaustive-deps

  // 음악 — 공개 순간엔 공개 곡, 새 라운드에서 다시 루프
  useEffect(() => {
    if (st.phase === 'reveal') { mus.play('reveal'); buzz(30) }
    if ((st.phase === 'show' && st.round > 0) || st.phase === 'result') mus.play('loop')
    if (st.phase === 'done') sting(mus.on, st.results[st.results.length - 1]?.hit)
  }, [st.phase, st.round])  // eslint-disable-line react-hooks/exhaustive-deps

  // 라운드 끝 — 운영 지표(단계 · 라운드별 AI 적중, 신호 학습 켜짐, 사진별 AI 선택 · 진짜). 이름뿐이고 반응 시간 원자료는 없다
  useEffect(() => {
    if (st.phase !== 'done') return
    for (const label of roundLabels(st)) track('knows', 'ab', { label })
  }, [st.phase, st.round])  // eslint-disable-line react-hooks/exhaustive-deps

  // 한 판 끝 — 기록(이 기기) · 처음 깬 단계면 허브 EXP(awardXp 가 완주 지표도 함께) · 아니면 완주 지표만. 한 판에 한 번
  useEffect(() => {
    if (st.phase !== 'result' || doneRef.current === st.rounds) return
    doneRef.current = st.rounds   // 판마다 새 배열(오늘의 판을 같은 씨앗으로 다시 해도 따로 센다)
    const res = applyGame(prog, { stage: st.stage, rounds: st.rounds.length, ai: st.ai, me: st.me, daily: st.daily, date: kstDate() })
    saveProg(store(), res.prog)
    saveHabit(store(), st.habit)   // 이 사람의 습관 요약(숫자 6개)만 — 다음 판 첫 라운드부터 쓴다
    setProg(res.prog)
    setEnd(res)
    if (res.firstClear) exp.add('knows', 'game_clear', `knows:clear:${st.stage}:${st.seed}`)
    else track('knows', 'clear')
    setLine('')
    if (st.daily) closingLine(st.results).then(setLine)
  }, [st.phase])  // eslint-disable-line react-hooks/exhaustive-deps

  // 키보드(데스크톱) — N · 왼쪽 · 스페이스 = 아니, Y · 오른쪽 = 예
  useEffect(() => {
    if (st.phase !== 'run') return undefined
    const onKey = (e) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === 'n' || k === 'arrowleft' || k === ' ') { e.preventDefault(); tap(mus.on); dispatch({ type: 'press', kind: 'no', now: performance.now() }) }
      if (k === 'y' || k === 'arrowright') { e.preventDefault(); dispatch({ type: 'press', kind: 'yes', now: performance.now() }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [st.phase, mus.on])

  // 누르는 순간 바로 잰다(손을 뗄 때가 아니라 닿을 때)
  const press = (kind) => (e) => {
    e.preventDefault()
    const now = performance.now()
    if (kind === 'no') tap(mus.on)
    // 손가락 신호 두 가지(기기 안에서만 · 숫자 요약으로만 쓴다) — 버튼 가운데에서 벗어난 정도, 손이 닿아 있던 시간
    let off
    try {
      const r = e.currentTarget.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && Number.isFinite(e.clientX)) {
        off = Math.min(1, Math.hypot((e.clientX - r.left - r.width / 2) / (r.width / 2), (e.clientY - r.top - r.height / 2) / (r.height / 2)) / Math.SQRT2)
      }
    } catch { off = undefined }
    dispatch({ type: 'press', kind, now, off })
    const up = () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      dispatch({ type: 'release', pd: now, now: performance.now() })
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // 새 판 — 사다리(지금 단계) 또는 오늘의 판(날짜 씨앗 · 모두 같은 판)
  const begin = (daily) => {
    mus.play('loop')
    track('knows', 'start')
    const firstGame = prog.plays === 0
    let setup
    if (daily) {
      const d = dailyOf(kstDate())
      setup = { seed: d.seed, daily: { set: d.set }, firstGame, habit: loadHabit(store()) }
    } else {
      setup = { seed: newSeed(), stage: currentStage(prog), best: prog.best, firstGame, habit: loadHabit(store()) }
    }
    setEnd(null)
    dispatch({ type: 'start', setup, now: performance.now() })
  }
  const toLadder = () => { setEnd(null); dispatch({ type: 'cover', setup: { seed: newSeed(), stage: currentStage(prog), best: prog.best, firstGame: false } }) }

  const share = async () => {
    const cfg = stageCfg(st.stage || 1)
    const text = shareText({ ai: st.ai, me: st.me, stage: st.stage, aiName: cfg.ai, won: !!st.won, daily: st.daily })
    const url = shareUrl('knows')
    track('knows', 'share')   // 공유 버튼 누름 횟수 (지표 — 다른 게임과 같게, 2026-11-26)
    try {
      if (navigator.share) { await navigator.share({ text, url }); return }
    } catch (err) { if (err && err.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setToast('복사했어요') } catch { setToast(text) }
    setTimeout(() => setToast(''), 1800)
  }

  if (st.phase === 'cover') {
    const stage = currentStage(prog)
    const cfg = stageCfg(stage)
    const today = kstDate()
    const dd = prog.daily && prog.daily.date === today ? prog.daily : null
    const fresh = setUnlockedBy(prog.best)
    return (
      <main className="kv" data-phase="cover">
        <style>{CSS}</style>
        <div className="kv-cv" style={{ backgroundImage: `url(${IMG.cover})` }}>
          {/* 음악은 오른쪽 '?' 옆 — 왼쪽 위는 허브 '홈' 단추(hubback, 고정 · 폭 약 68px) 자리라 거기 두면 밑에 깔려 못 눌렀다 */}
          <button type="button" className="kv-mus" aria-label="음악" data-act="music" style={{ position: 'absolute', top: 10, right: 62, zIndex: 3, margin: 0 }} onClick={mus.toggle}>{mus.on ? <Music size={22} strokeWidth={2} /> : <VolumeX size={22} strokeWidth={2} />}</button>
          <HelpButton onClick={() => { coach.replay(); pracDone.current = false; setAgain(true) }} theme="dark" className="kv-help" style={{ position: 'absolute', top: 10, right: 10, zIndex: 3 }} />
          <p className="kv-eb">AI KNOWS YOU</p>
          <h1 className="kv-h">숨긴 사진</h1>
          {prog.plays === 0 ? <p className="kv-p">사진 하나를 숨기세요. AI 가 찾아요</p> : null}
          <div className="kv-ai" data-ai={stage}>
            <AiEye stage={stage} size={64} />
            <span className="t">
              <span className="nm">{cfg.ai}<small>{`AI ${stage}단계`}</small></span>
              <StageBadges cfg={cfg} />
            </span>
          </div>
          <Steps best={prog.best} stage={stage} />
          <SetStrip best={prog.best} fresh={fresh?.id} />
          {prog.plays > 0 ? (
            <div className="kv-me" data-me>
              <Badge icon={Trophy}>{titleOf(prog.best)}</Badge>
              {prog.streak > 1 ? <Badge icon={Flame}>{`${prog.streak}연승`}</Badge> : null}
            </div>
          ) : null}
          <button type="button" className="kv-btn wide" data-act="start" onClick={() => begin(false)}>{`${stage}단계 도전`}</button>
          <button type="button" className="kv-btn sub wide" data-act="daily" onClick={() => begin(true)}>
            <CalendarDays size={20} strokeWidth={2} />{dd ? `오늘의 판 AI ${dd.ai} : 나 ${dd.me}` : '오늘의 판'}
          </button>
          <p className="kv-note"><span>{NOTICE}</span><Lock size={12} strokeWidth={2} /><span>습관 기록은 이 기기에만</span></p>
        </div>
      </main>
    )
  }

  if (st.phase === 'result') {
    const won = !!st.won
    const cfg = stageCfg(st.stage || 1)
    const nextCfg = end && end.next !== st.stage ? stageCfg(end.next) : null
    const unlocked = end?.unlocked
    const head = st.daily ? null : won ? `${st.stage}단계 돌파` : '들켰다'
    return (
      <main className="kv" data-phase="result" data-won={won ? '1' : '0'} data-daily={st.daily ? '1' : '0'}>
        <style>{CSS}</style>
        <div className="kv-cv end" style={{ backgroundImage: `url(${IMG.cover})` }}>
          {st.daily ? (
            <p className="kv-eb st"><CalendarDays size={18} strokeWidth={2} />오늘의 판</p>
          ) : (
            <p className="kv-eb st"><AiEye stage={st.stage} size={26} />{`AI ${st.stage}단계 · ${cfg.ai}`}</p>
          )}
          {head ? <h1 className={'kv-h ' + (won ? 'win' : 'lose')} data-head>{head}</h1> : null}
          <div className="kv-big" data-big><small>AI</small><span className="a">{st.ai}</span><small>:</small><span className="m">{st.me}</span><small>나</small></div>
          {!won && !st.daily ? <p className="kv-line" data-line>{loseLine(st.results)}</p> : null}
          {st.daily ? <p className="kv-line" data-line>{line}</p> : null}
          <RoundRows results={st.results} />
          {!st.daily ? <Steps best={prog.best} stage={currentStage(prog)} just={end?.firstClear ? st.stage : 0} /> : null}
          {won && nextCfg ? (
            <p className="kv-nx" data-next><span className="d">다음</span><AiEye stage={nextCfg.stage} size={28} />{`${nextCfg.stage}단계 · ${nextCfg.ai}`}<Badge icon={Images}>{`${nextCfg.n}장`}</Badge></p>
          ) : null}
          {unlocked ? (
            <div className="kv-unl" data-unlocked={unlocked.id}>
              <span className="h"><Sparkles size={18} strokeWidth={2.2} />{`새 사진 세트 · ${unlocked.name}`}</span>
              <span className="row">{unlocked.items.map((it, k) => <span key={it.id} style={{ animationDelay: `${1 + k * 0.08}s` }}><Photo it={it} /></span>)}</span>
            </div>
          ) : null}
          {st.daily ? (
            <button type="button" className="kv-btn wide" data-act="share" onClick={share}><Share2 size={20} strokeWidth={2} />도전장</button>
          ) : won ? (
            <button type="button" className="kv-btn wide" data-act="next-stage" onClick={() => begin(false)}>{nextCfg ? '다음 단계' : '한 번 더'}</button>
          ) : (
            <button type="button" className="kv-btn wide" data-act="again" onClick={() => begin(false)}><RotateCcw size={20} strokeWidth={2} />다시 도전</button>
          )}
          <div className="kv-two">
            {st.daily
              ? <button type="button" className="kv-btn sub" data-act="again" onClick={() => begin(true)}><RotateCcw size={18} strokeWidth={2} />다시</button>
              : <button type="button" className="kv-btn sub" data-act="share" onClick={share}><Share2 size={18} strokeWidth={2} />도전장</button>}
            <button type="button" className="kv-btn sub" data-act="ladder" onClick={toLadder}><Trophy size={18} strokeWidth={2} />사다리</button>
          </div>
          <MoreGames game="knows" />
          <p className="kv-note">{NOTICE}</p>
        </div>
        {toast ? <div className="kv-toast" role="status">{toast}</div> : null}
      </main>
    )
  }

  const n = photos.length
  const cmp = n >= 6 ? ' cmp' : ''

  // 골랐어요 - 첫 판 첫 라운드는 연습 두 칸을 먼저(시간 제한 없음). 엔진에 보내는 것은 연습이 끝난 뒤 picked 하나뿐
  const pair = st.phase === 'show' ? practicePair(photos) : null
  const onPicked = () => {
    coach.emit('picked')
    if (coach.active && pair && !pracDone.current && showPractice({ plays: again ? 0 : prog.plays, round: st.round, daily: !!st.daily })) { setPrac({ k: 0, bad: 0 }); return }
    dispatch({ type: 'picked', now: performance.now() })
  }
  // 연습 칸 누름 - 맞게 눌러야 다음. 틀리면 흔들림만(감점 없음 · 기록 없음 · 시간도 안 잼)
  const practicePress = (kind) => {
    const cur = pair[prac.k]
    if (kind !== cur.kind) { slipSound(mus.on); buzz(40); setPrac({ ...prac, bad: prac.bad + 1 }); return }
    if (kind === 'no') tap(mus.on)
    if (prac.k === 0) { coach.emit('press_no'); setPrac({ k: 1, bad: 0 }); return }
    coach.emit('press_yes')
    pracDone.current = true
    setPrac(null)
    dispatch({ type: 'picked', now: performance.now() })
  }

  if (st.phase === 'show' && prac && pair) {
    const cur = pair[prac.k]
    return (
      <main className={'kv' + cmp} data-phase="practice" data-k={prac.k}>
        <style>{CSS}</style>
        <div className="kv-bg" style={{ backgroundImage: `url(${IMG.stage})` }} />
        <Top st={st} mus={mus} />
        <CoachLine coach={coach} theme="dark" className="kv-coach" />
        <div key={prac.k + ':' + prac.bad} className={'kv-frame' + (cur.target ? ' tg' : '') + (prac.bad ? ' bad' : '')} data-frame data-target={cur.target ? '1' : '0'}>
          <Photo it={cur.item} className="on" />
        </div>
        <p className="kv-hint" data-hint>{cur.target ? <><i />테두리 사진은 예</> : '테두리 없는 사진은 아니'}</p>
        <div className="kv-bot run">
          <button type="button" className="kv-no" data-act="no" data-onb="no" onClick={() => practicePress('no')}>아니</button>
          <button type="button" className="kv-yes" data-act="yes" data-onb="yes" onClick={() => practicePress('yes')}>예</button>
          {coach.at('no') ? <CoachFinger style={{ left: '50%', top: 54 }} /> : null}
          {coach.at('yes') ? <CoachFinger style={{ left: '50%', top: 108 }} /> : null}
        </div>
      </main>
    )
  }

  // 안내 줄(코치)이 떠 있나 — 한 줄 글(kv-say · kv-hint)보다 약 30~40px 높아서 사진 · 빠른 진행 칸을 그만큼 줄인다
  const coachOn = !!(coach.view && coach.view.kind === 'step')

  if (st.phase === 'show') {
    const rows = Math.ceil(n / 2)
    const isNew = !st.daily && curSet.unlock >= 1 && curSet.unlock === prog.best
    return (
      <main className={'kv' + cmp} data-phase="show" data-n={n}>
        <style>{CSS}</style>
        <div className="kv-bg" style={{ backgroundImage: `url(${IMG.stage})` }} />
        <Top st={st} mus={mus} />
        {coachOn ? <CoachLine coach={coach} theme="dark" className="kv-coach" /> : <p className="kv-say">몰래 하나 고르세요</p>}
        {isNew ? <p className="kv-new" data-new><Sparkles size={16} strokeWidth={2.2} />{`새 세트 · ${curSet.name}`}</p> : null}
        <div className="kv-grid" style={{ '--t': `min(calc((min(100vw, 480px) - 42px) / 2), calc((100dvh - ${(isNew ? 236 : 200) + (coachOn ? 32 : 0)}px - ${(rows - 1) * 10}px) / ${rows}))` }}>
          {photos.map((it) => <Photo key={it.id} it={it} />)}
        </div>
        <div className="kv-bot">
          <button type="button" className={'kv-btn' + (coach.at('picked') ? ' onb-glow' : '')} data-act="picked" data-onb="picked" disabled={!ready} onClick={onPicked}>
            {ready ? null : <i className="fill" style={{ animationDuration: `${SHOW_MS}ms` }} />}<span>골랐어요</span>
          </button>
        </div>
      </main>
    )
  }

  if (st.phase === 'tbIntro') {
    return (
      <main className={'kv' + cmp} data-phase="tbIntro">
        <style>{CSS}</style>
        <div className="kv-bg" style={{ backgroundImage: `url(${IMG.stage})` }} />
        <Top st={st} mus={mus} />
        <div className="kv-tb">
          <h2>{st.pair.length >= 3 ? '셋 중 하나' : '둘 중 하나'}</h2>
          <div className="kv-pair" style={{ '--k': st.pair.length }}>{st.pair.map((k) => <Photo key={k} it={photos[k]} />)}</div>
        </div>
      </main>
    )
  }

  if (st.phase === 'run') {
    const cur = st.seq[st.i]
    const showing = st.on && cur
    const marks = st.trials.map(trialMark)
    return (
      <main className={'kv' + cmp + (coachOn ? ' co' : '')} data-phase="run" data-block={st.block}>
        <style>{CSS}</style>
        <div className="kv-bg" style={{ backgroundImage: `url(${IMG.stage})` }} />
        <Top st={st} mus={mus} />
        <div className="kv-ask"><Eye size={20} strokeWidth={2} /><span>이거?</span></div>
        <div className={'kv-frame' + (showing && cur.target ? ' tg' : '') + (slipView ? ' bad' : '')} data-frame data-target={showing && cur.target ? '1' : '0'}>
          {photos.map((it, k) => <Photo key={it.id} it={it} className={showing && cur.item === k ? 'on' : ''} />)}
          {showing ? null : <i className="kv-fix" />}
        </div>
        {coach.view && coach.view.kind === 'step' && !slipView ? <CoachLine coach={coach} theme="dark" className="kv-coach" /> : <p className={'kv-hint' + (slipView ? ' bad' : '')} data-hint>{slipView ? SLIP_LINE[slipView.key] : <><i />테두리 사진만 예</>}</p>}
        <div className="kv-dots" aria-label={`${st.i}/${st.seq.length}`}>
          {st.seq.map((_, k) => <i key={k} className={marks[k] || ''} />)}
        </div>
        <div className="kv-bot run">
          <button type="button" className="kv-no" data-act="no" data-onb="no" onPointerDown={press('no')}>아니</button>
          <button type="button" className="kv-yes" data-act="yes" data-onb="yes" onPointerDown={press('yes')}>예</button>
        </div>
      </main>
    )
  }

  // 공개 · 진짜 고르기 · 라운드 결과
  const v = st.view
  const guess = photos[v.guess]
  const last = st.phase === 'done' ? st.results[st.results.length - 1] : null
  const head = st.phase === 'reveal' ? askLine(guess.name) : st.phase === 'pick' ? '진짜는?' : last.hit ? '들켰다' : '포커페이스'
  const sub = !last ? '' : last.hit ? (last.ev && last.ev.of >= 2 && last.ev.k >= 2 && last.ms > 0 ? (last.ev.k === last.ev.of ? `${last.ev.of}번 다 손이 늦었어요 ${secText(last.ms)}` : `${last.ev.of}번 중 ${last.ev.k}번, 손이 늦었어요 ${secText(last.ms)}`) : last.ms > 0 ? `이 사진에서 손이 ${secText(last.ms)} 늦었어요` : '손이 먼저 대답했어요') : last.rank === 1 ? '두 번째로 의심했어요' : '손이 흔들리지 않았어요'
  // co: 라운드 결과에 안내 줄('손이 늦은 사진이 들켜요')이 뜨면 낮은 화면에서 봉투 · 설명 줄을 줄여 [다음]을 화면 안에
  return (
    <main className={'kv' + cmp + (coachOn ? ' co' : '')} data-phase={st.phase}>
      <style>{CSS}</style>
      <div className="kv-bg" style={{ backgroundImage: `url(${IMG.stage})` }} />
      <Top st={st} mus={mus} />
      <h2 className={'kv-q' + (last ? (last.hit ? ' hit' : ' safe') : '')} data-q>{last && last.hit ? <Eye size={28} strokeWidth={2.2} /> : null}{head}</h2>
      <p className="kv-sub" data-sub>{sub}</p>
      <div className="kv-env" aria-hidden="true">
        <div className="back" />
        <div className="card"><Photo it={guess} /></div>
        <div className="front" />
        <div className="flap" />
        <div className="wax" />
        <div className="eye"><Eye size={20} strokeWidth={2.2} /></div>
      </div>
      <p className="kv-cap"><span>손이 늦어진 정도</span>{v.tb ? <span>{st.pair && st.pair.length >= 3 ? '셋 중 하나까지' : '둘 중 하나까지'}</span> : null}</p>
      <div className={'kv-bars' + (coach.at('bars') ? ' onb-glow' : '')} data-bars data-onb="bars">
        {photos.map((it, k) => {
          const b = v.bars[k]
          const cls = 'kv-row' + (k === v.guess ? ' g' : '') + (last && k === st.real && !last.hit ? ' real' : '')
          // 늘 같은 버튼 — 진짜 고르기 때만 눌린다 (요소가 바뀌면 막대 애니메이션이 처음부터 다시 돈다)
          return (
            <button type="button" key={it.id} className={cls} data-pick={k} aria-label={it.name} disabled={st.phase !== 'pick'} onClick={() => dispatch({ type: 'pick', item: k })}>
              <Photo it={it} className="th" />
              <span className="kv-track"><i style={{ width: `${Math.max(4, b.frac * 100)}%` }} /></span>
              <span className="kv-ms">{k === v.guess || (last && k === st.real) ? secText(b.ms) : ''}</span>
              <span className="kv-ic">{k === v.guess ? <Eye size={18} strokeWidth={2} /> : null}</span>
            </button>
          )
        })}
      </div>
      <div className="kv-bot">
        {st.phase === 'reveal' ? (
          <div className="kv-two">
            <button type="button" className="kv-btn" data-act="yes" onClick={() => dispatch({ type: 'yes' })}>맞아요</button>
            <button type="button" className="kv-btn sub" data-act="deny" onClick={() => dispatch({ type: 'deny' })}>아니, 이거</button>
          </div>
        ) : null}
        {st.phase === 'done' && coach.view && coach.view.kind === 'step' ? <CoachLine coach={coach} theme="dark" className="kv-coach" /> : null}
        {st.phase === 'done' ? (
          <button type="button" className="kv-btn" data-act="next" onClick={() => { coach.emit('next'); dispatch({ type: 'next', now: performance.now() }) }}>{st.round >= st.rounds.length - 1 ? '결과' : '다음'}</button>
        ) : null}
      </div>
    </main>
  )
}
