# 촬영 · 측정 (uiux-pw:1 · 360x740) — python3 capture.py  (사이트는 /out/site 에 빌드돼 있어야 한다)
import subprocess, time, json, sys, os
from playwright.sync_api import sync_playwright
OUT = '/out/shots'; os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', '8123', '-d', '/out/site'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = 'http://127.0.0.1:8123/harness.html'
report = {'runs': [], 'checks': []}

def visible_text(p):
    return p.evaluate("""() => [...document.querySelectorAll('.k2-line,.k2-sub,.k2-win,.k2-env-label')].map(e=>e.textContent.trim()).filter(Boolean)""")

def audit(p, name):
    r = p.evaluate("""() => {
      const bad = []; const small = [];
      for (const e of document.querySelectorAll('.k2 *')) {
        const cs = getComputedStyle(e);
        if (e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 16) small.push(e.className + ':' + cs.fontSize);
      }
      for (const b of document.querySelectorAll('.k2 button')) { const r = b.getBoundingClientRect(); if (r.width && (r.width < 44 || r.height < 44)) bad.push(b.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
      return { overflowX: document.documentElement.scrollWidth - innerWidth, small, bad };
    }""")
    r['step'] = name; r['text'] = visible_text(p)
    r['chars'] = sum(len(t) for t in r['text'] if not t.startswith(('봉인 코드', '지난번 봉인 코드')))
    report['checks'].append(r)

def center(p, sel):
    b = p.locator(sel).bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def card_xy(p, i):
    b = p.locator(f'[data-card="{i}"]').bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def nxt(p):
    try: p.click('.k2-next', timeout=1200)
    except Exception: pass

PREFIX = ['']
def shot(p, name): p.screenshot(path=f'{OUT}/{PREFIX[0]}{name}.png')

def play(p, run_idx, snap, think=1.2, seq=(0,1,2,0,0,1,0,2,0,0)):
    t0 = time.time()
    p.goto(URL)
    p.wait_for_selector('.k2-key:not([disabled])')
    t_ready = time.time() - t0
    if snap: shot(p, '1_first'); audit(p, 'm1')
    time.sleep(0.2)
    # 1
    t_click = time.time(); p.click('.k2-key >> nth=1')
    p.wait_for_selector('[data-testid=reveal-line]'); t_first_reveal = time.time() - t0
    if snap: shot(p, '2_seal_open'); audit(p, 'm1r')
    time.sleep(think); nxt(p)
    # 2 — 왼쪽을 누르고 오른쪽에서 뗀다 (망설임)
    p.wait_for_selector('.k2-card:not([disabled])'); time.sleep(0.3)
    if snap: shot(p, '3_cards'); audit(p, 'm2')
    x, y = card_xy(p, 0); p.mouse.move(x, y); p.mouse.down(); time.sleep(0.25)
    x2, y2 = card_xy(p, 2); p.mouse.move(x2, y2, steps=8); time.sleep(0.1); p.mouse.up()
    p.wait_for_selector('[data-testid=reveal-line]')
    hes = p.inner_text('[data-testid=reveal-line]')
    if snap: time.sleep(0.9); shot(p, '4_hesitation'); audit(p, 'm2r')
    time.sleep(think); nxt(p)
    # 3
    p.wait_for_selector('.k2-card:not([disabled])'); time.sleep(0.3)
    if snap: shot(p, '5_decoy_ask'); audit(p, 'm3')
    decoy_line = p.inner_text('[data-testid=line]')
    bx, by = card_xy(p, 1); p.mouse.click(bx, by)
    p.wait_for_selector('[data-testid=reveal-line]')
    if snap: time.sleep(0.9); shot(p, '6_decoy_reveal'); audit(p, 'm3r')
    time.sleep(think); nxt(p)
    # 4
    p.wait_for_selector('[data-testid=shapes]')
    for i in range(10):
        p.wait_for_function("() => { const b=document.querySelector('[data-testid=shapes] button'); return b && !b.disabled }", timeout=6000)
        if snap and i == 6: shot(p, '7_rhythm'); audit(p, 'm4')
        p.click(f'[data-testid=shapes] button >> nth={seq[i]}'); time.sleep(0.25)
        if snap and i == 4: time.sleep(0.5); shot(p, '7b_prophecy_sealed')
    p.wait_for_selector('[data-testid=reveal-line]', timeout=8000)
    if snap: time.sleep(0.9); shot(p, '8_prophecy'); audit(p, 'm5')
    pro = p.inner_text('[data-testid=reveal-line]')
    time.sleep(think); nxt(p)
    p.wait_for_selector('[data-testid=score]')
    t_total = time.time() - t0
    if snap: shot(p, '9_result'); audit(p, 'end')
    score = p.inner_text('[data-testid=score]'); verdict = p.inner_text('[data-testid=verdict]'); nxtline = p.inner_text('[data-testid=next-line]')
    return dict(run=run_idx, t_ready=round(t_ready, 2), t_first_reveal=round(t_first_reveal, 2), t_total=round(t_total, 1), hes=hes, decoy=decoy_line, prophecy=pro, score=score, verdict=verdict, next=nxtline)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox'])
    for n in range(5):
        ctx = b.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=2)
        p = ctx.new_page(); p.set_default_timeout(15000)
        errs = []; p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        reqs = []; p.on('request', lambda r: reqs.append(r.url) if not r.url.startswith('http://127.0.0.1:8123') else None)
        r = play(p, n, n == 0)
        r['errors'] = errs; r['external_requests'] = reqs
        report['runs'].append(r)
        if n == 0:
            # 다음 방문 — 같은 저장소로 다시 열면 첫 라운드에서 지난번 봉인이 열린다
            p.goto(URL); p.wait_for_selector('.k2-key:not([disabled])'); time.sleep(0.3)
            shot(p, '10_revisit_first'); report['revisit_label'] = p.inner_text('.k2-env-label'); report['revisit_sub'] = p.inner_text('.k2-sub')
            p.click('.k2-key >> nth=2'); p.wait_for_selector('[data-testid=reveal-line]'); time.sleep(0.9); shot(p, '11_revisit_open')
            report['revisit_open'] = visible_text(p)
        ctx.close()
    ctx = b.new_context(viewport={"width": 360, "height": 740}, device_scale_factor=2)
    p = ctx.new_page(); p.set_default_timeout(15000)
    PREFIX[0] = "pat_"
    report["pattern_run"] = play(p, "pat", True, seq=[0] * 10)
    ctx.close()
    b.close()
srv.terminate()
json.dump(report, open('/out/capture_report.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(report, ensure_ascii=False, indent=1))
