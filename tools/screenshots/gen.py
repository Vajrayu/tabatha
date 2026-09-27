"""Generates fictional demo websites used as tabs for the Web Store screenshots.
Each site lives in demo/sites/<host>/ with index.html + favicon.svg."""
import os, textwrap, random

ROOT = os.path.join(os.path.dirname(__file__), "sites")
random.seed(7)

def fav(bg, fg, glyph):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="{bg}"/><text x="16" y="22" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" text-anchor="middle" fill="{fg}">{glyph}</text></svg>'''

BASE = """*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2328}
a{color:inherit;text-decoration:none}"""

def page(title, css, body):
    return f"""<!doctype html><html><head><meta charset=utf-8><title>{title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>{BASE}{css}</style></head><body>{body}</body></html>"""

sites = {}

def lorem(n, words=None):
    w = (words or "the team agreed to ship a smaller first version and measure how people actually use it before adding more settings "
         "we reviewed feedback from the beta group and most requests were about speed clarity and fewer clicks for common tasks").split()
    return " ".join(random.choice(w) for _ in range(n)).capitalize() + "."

# 1 Docs ----------------------------------------------------------------------
def docs(title, h1, host):
    paras = "".join(f"<p>{lorem(38)}</p>" for _ in range(2))
    body = f"""
<div class=top><div class=logo>N</div><div><div class=dn>{h1}</div><div class=menu>File&nbsp;&nbsp;Edit&nbsp;&nbsp;View&nbsp;&nbsp;Insert&nbsp;&nbsp;Format&nbsp;&nbsp;Tools</div></div><div class=share>Share</div><div class=av>YV</div></div>
<div class=tb>{''.join(f'<span>{x}</span>' for x in ['↶','↷','100%','Normal text','Inter','11','<b>B</b>','<i>I</i>','<u>U</u>','≡','☰','🔗'])}</div>
<div class=canvas><div class=paper>
<h1>{h1}</h1><div class=meta>Owner: Product · Last edited 2 hours ago</div>
<h2>Goals</h2><ul><li>Cut time-to-first-value for new teams by 30%</li><li>Ship the redesigned onboarding checklist</li><li>Retire the legacy export flow</li></ul>
<h2>Summary</h2>{paras}
<table><tr><th>Milestone</th><th>Owner</th><th>Due</th><th>Status</th></tr>
<tr><td>Onboarding v2</td><td>Priya</td><td>Oct 18</td><td><span class="st g">On track</span></td></tr>
<tr><td>Export migration</td><td>Arjun</td><td>Nov 02</td><td><span class="st y">At risk</span></td></tr>
<tr><td>Usage dashboard</td><td>Meera</td><td>Nov 20</td><td><span class="st g">On track</span></td></tr></table>
<h2>Open questions</h2><p>{lorem(30)}</p></div></div>"""
    css = """body{background:#f1f3f7}.top{display:flex;align-items:center;gap:12px;padding:10px 18px;background:#fff}
.logo{width:36px;height:36px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;display:grid;place-items:center;font-size:18px}
.dn{font-size:17px}.menu{font-size:13px;color:#555}.share{margin-left:auto;background:#c7dcff;padding:8px 20px;border-radius:20px;font-weight:600}
.av{width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#fff;display:grid;place-items:center;font-weight:600}
.tb{display:flex;gap:18px;margin:4px 14px;padding:8px 18px;background:#e8edf6;border-radius:22px;color:#444}
.canvas{padding:22px 0}.paper{width:760px;margin:auto;background:#fff;min-height:1000px;padding:64px 80px;box-shadow:0 1px 3px rgba(0,0,0,.15)}
h1{font-size:30px;margin:0 0 4px}.meta{color:#777;margin-bottom:18px}h2{font-size:19px;margin:22px 0 6px;color:#1e3a8a}
table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #dde;padding:7px 10px;text-align:left}th{background:#f4f6fb}
.st{padding:2px 8px;border-radius:10px;font-size:12px}.g{background:#dcfce7;color:#166534}.y{background:#fef3c7;color:#92400e}"""
    sites[host] = (page(title, css, body), fav("#2563eb", "#fff", "N"))

docs("Q4 Product Roadmap – Northwind Docs", "Q4 Product Roadmap", "docs.northwind.example")
docs("Design review notes – Northwind Docs", "Design review notes", "notes.northwind.example")
docs("Design system tokens – Northwind Docs", "Design system tokens", "tokens.northwind.example")

# 2 Mail ----------------------------------------------------------------------
mails = [("Priya Nair", "Onboarding v2 – final copy", "Attached the final strings for the checklist, can you give it one…", "10:42"),
         ("Stackboard", "Sprint 42 starts tomorrow", "8 cards are ready for planning. Review the board before…", "09:15"),
         ("Arjun Rao", "Re: export migration", "I think we can drop the CSV path entirely if the new API…", "Yesterday"),
         ("Dayplan", "Reminder: Design crit at 4pm", "Room 3B · Join from your calendar…", "Yesterday"),
         ("Meera Iyer", "Dashboard mocks v3", "Pushed the new charts, the weekly view feels a lot calmer…", "Sep 25"),
         ("Hearth & Co.", "Your order has shipped", "Ceramic pour-over set is on its way and should arrive…", "Sep 24"),
         ("Longform Weekly", "5 essays worth your Sunday", "The quiet art of keyboard shortcuts, why maps lie…", "Sep 24"),
         ("Kiran", "Lunch Friday?", "New ramen place near the office opened, want to try it…", "Sep 23"),
         ("Skyroute", "Your trip to Goa", "Check-in opens 48 hours before departure…", "Sep 22")]
rows = "".join(f"<div class='m{' u' if i<3 else ''}{' sel' if i==0 else ''}'><b>{a}</b><span><strong>{s}</strong> – {p}</span><em>{t}</em></div>" for i,(a,s,p,t) in enumerate(mails))
body = f"""<div class=top><div class=logo>✉</div><b>Mailpost</b><input placeholder="Search mail"><div class=av>YV</div></div>
<div class=wrap><nav><div class=compose>✎ Compose</div><div class=on>Inbox <i>12</i></div><div>Starred</div><div>Snoozed</div><div>Sent</div><div>Drafts <i>2</i></div><div>Archive</div>
<h4>Labels</h4><div>🟣 Work</div><div>🟢 Personal</div><div>🟠 Receipts</div></nav>
<section><div class=tabs><span class=on>Primary</span><span>Updates</span><span>Promotions</span></div>{rows}</section></div>"""
css = """body{background:#f6f8fc}.top{display:flex;align-items:center;gap:14px;padding:10px 20px}.logo{width:36px;height:36px;border-radius:9px;background:#e11d48;color:#fff;display:grid;place-items:center;font-size:18px}
.top b{font-size:20px;color:#444;width:180px}input{flex:0 1 680px;height:46px;border:0;border-radius:24px;background:#e9eef6;padding:0 22px;font-size:15px}
.av{margin-left:auto;width:34px;height:34px;border-radius:50%;background:#0ea5e9;color:#fff;display:grid;place-items:center;font-weight:600}
.wrap{display:flex}nav{width:240px;padding:8px 12px}nav div{padding:7px 16px;border-radius:0 18px 18px 0;display:flex;justify-content:space-between}
nav .on{background:#fbd5de;font-weight:700}nav i{font-style:normal;font-size:12px}nav h4{margin:18px 16px 6px;font-size:13px}
.compose{background:#fde2e8;border-radius:16px!important;padding:16px 22px!important;margin-bottom:12px;font-weight:600;width:150px}
section{flex:1;background:#fff;border-radius:16px;margin-right:16px;overflow:hidden}.tabs{display:flex;border-bottom:1px solid #eee}.tabs span{padding:14px 30px}
.tabs .on{border-bottom:3px solid #e11d48;color:#e11d48;font-weight:600}
.m{display:flex;gap:18px;padding:11px 20px;border-bottom:1px solid #f0f0f0;color:#555}.m b{width:170px;font-weight:400}.m span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m em{font-style:normal;font-size:12px}.u{background:#fff;color:#111}.u b,.u em{font-weight:700}.m:not(.u){background:#f7f9fc}.sel{background:#fff5f7!important}"""
sites["mail.mailpost.example"] = (page("Inbox (12) – Mailpost", css, body), fav("#e11d48", "#fff", "✉"))

# 3 Kanban --------------------------------------------------------------------
cols = {"Backlog": ["Keyboard shortcut cheatsheet", "Empty state illustrations", "Export: remove CSV path", "Audit colour contrast"],
        "In progress": ["Onboarding checklist v2", "Usage dashboard – weekly view", "Search ranking tweaks"],
        "Review": ["Settings page copy", "Tab previews perf"],
        "Done": ["Sprint 41 retro", "Icon refresh", "Fix login redirect", "Faster cold start"]}
tags = [("#dbeafe","#1d4ed8","Design"),("#dcfce7","#15803d","Web"),("#fae8ff","#a21caf","Research"),("#ffedd5","#c2410c","Bug")]
colhtml = ""
for c, cards in cols.items():
    ch = "".join(f"<div class=card><span class=tag style='background:{t[0]};color:{t[1]}'>{t[2]}</span><div>{x}</div><div class=f><span>💬 {random.randint(0,6)}</span><span class=a style='background:{random.choice(['#f59e0b','#10b981','#6366f1','#ef4444'])}'></span></div></div>" for x,t in ((x, random.choice(tags)) for x in cards))
    colhtml += f"<div class=col><h3>{c} <i>{len(cards)}</i></h3>{ch}<div class=add>+ Add card</div></div>"
body = f"<header><b>▦ Stackboard</b><span>Sprint 42</span><span class=pill>Oct 1 – Oct 14</span><div class=sp></div><span class=btn>Filter</span><span class=btn>Share</span></header><main>{colhtml}</main>"
css = """body{background:linear-gradient(135deg,#0f766e,#0e7490);min-height:100vh;color:#172b4d}header{display:flex;gap:16px;align-items:center;padding:12px 20px;background:rgba(0,0,0,.2);color:#fff}
header b{font-size:18px}.pill{background:rgba(255,255,255,.2);padding:4px 10px;border-radius:12px;font-size:12px}.sp{flex:1}.btn{background:rgba(255,255,255,.2);padding:6px 14px;border-radius:6px}
main{display:flex;gap:14px;padding:18px;align-items:flex-start}.col{width:280px;background:#eef1f5;border-radius:12px;padding:10px}h3{font-size:14px;margin:4px 6px 10px}h3 i{font-style:normal;color:#888;font-weight:400}
.card{background:#fff;border-radius:8px;padding:10px 12px;margin-bottom:8px;box-shadow:0 1px 1px rgba(0,0,0,.15)}.tag{font-size:11px;padding:2px 8px;border-radius:4px;font-weight:600}
.card>div{margin-top:6px}.f{display:flex;justify-content:space-between;color:#888;font-size:12px}.a{width:22px;height:22px;border-radius:50%}.add{color:#666;padding:6px}"""
sites["board.stackboard.example"] = (page("Sprint 42 · Stackboard", css, body), fav("#0f766e", "#fff", "▦"))

# 4 Code ----------------------------------------------------------------------
code = r'''import { getMru, getPreviews } from './lib/store.js';

// Most recently used tabs first, current window on ties.
export async function orderTabs(tabs, ctx) {
  const mru = await getMru();
  const rank = new Map(mru.map((id, i) => [id, i]));
  const r = (t) => (t.id === ctx.srcTab ? -1 : rank.get(t.id) ?? Infinity);
  return tabs.sort((a, b) => r(a) - r(b) || a.index - b.index);
}

export function cardWidth(n, width) {
  const avail = Math.min(width - 80, 1640);
  if (n <= 2) return Math.min(420, (avail - 20) / 2);
  if (n <= 6) return Math.min(340, (avail - 40) / 3);
  return Math.max(240, Math.min(320, (avail - 60) / 4));
}

function timeAgo(sec) {
  const s = Math.max(0, Date.now() / 1000 - sec);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  return Math.round(s / 3600) + ' h ago';
}'''
import html, re
def hl(line):
    l = html.escape(line)
    l = re.sub(r"(//.*)$", r"<span class=c>\1</span>", l)
    l = re.sub(r"(&#x27;[^&]*?&#x27;)", r"<span class=s>\1</span>", l)
    l = re.sub(r"\b(import|from|export|async|function|const|return|await|if|new)\b", r"<span class=k>\1</span>", l)
    l = re.sub(r"\b(\d+)\b", r"<span class=n>\1</span>", l)
    return l
lines = "".join(f"<div><i>{i+1}</i>{hl(l)}</div>" for i, l in enumerate(code.split("\n")))
tree = "".join(f"<div class='{c}'>{n}</div>" for n,c in [("▾ src",""),("  lib","d"),("  order.js","on"),("  switcher.js",""),("  capture.js",""),("▸ icons",""),("manifest.json",""),("README.md","")])
body = f"""<header><b>⌥ Gitforge</b><span>acme / <b>switcher</b></span><span class=pub>Public</span><div class=sp></div><span class=btn>☆ Star 128</span><span class=btn>⑂ Fork 14</span></header>
<nav class=tabs><span class=on>Code</span><span>Issues 6</span><span>Pull requests 2</span><span>Actions</span><span>Insights</span></nav>
<div class=wrap><aside>{tree}</aside><section><div class=fh><b>src/order.js</b><span>Meera · Faster ordering for large windows · 3 days ago</span></div><pre>{lines}</pre></section></div>"""
css = """body{background:#0d1117;color:#e6edf3}header{display:flex;gap:16px;align-items:center;padding:14px 22px;background:#010409}header b{font-size:16px}
.pub{border:1px solid #30363d;border-radius:12px;padding:1px 8px;font-size:12px;color:#8b949e}.sp{flex:1}.btn{border:1px solid #30363d;background:#21262d;padding:5px 12px;border-radius:6px;font-size:13px}
.tabs{display:flex;gap:4px;padding:0 22px;background:#010409;border-bottom:1px solid #30363d}.tabs span{padding:10px 14px;color:#9198a1}.tabs .on{color:#fff;border-bottom:2px solid #f78166}
.wrap{display:flex;gap:18px;padding:18px 22px}aside{width:220px;font-size:13px}aside div{padding:5px 10px;white-space:pre;border-radius:6px;color:#9198a1}aside .on{background:#1f2937;color:#fff}
section{flex:1;border:1px solid #30363d;border-radius:8px;overflow:hidden}.fh{display:flex;justify-content:space-between;padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;font-size:13px;color:#9198a1}.fh b{color:#e6edf3}
pre{margin:0;padding:12px 0;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace}pre i{display:inline-block;width:52px;text-align:right;padding-right:18px;color:#6e7681;font-style:normal}
.k{color:#ff7b72}.s{color:#a5d6ff}.c{color:#8b949e}.n{color:#79c0ff}"""
sites["code.gitforge.example"] = (page("acme/switcher: src/order.js · Gitforge", css, body), fav("#24292f", "#fff", "⌥"))

# 5 Analytics -----------------------------------------------------------------
def spark(vals, col, w=560, h=180):
    mx = max(vals); pts = " ".join(f"{i*w/(len(vals)-1):.0f},{h-8-(v/mx)*(h-24):.0f}" for i,v in enumerate(vals))
    return f"<svg viewBox='0 0 {w} {h}' width=100% height={h}><polygon points='0,{h} {pts} {w},{h}' fill='{col}' opacity=.14/><polyline points='{pts}' fill=none stroke='{col}' stroke-width=3/></svg>"
vals = [random.randint(40, 60) + i*3 for i in range(20)]
bars = "".join(f"<div style='height:{h}%'></div>" for h in [45,62,58,71,66,84,92])
body = f"""<aside><b>◉ Pulse</b><div class=on>Overview</div><div>Audience</div><div>Retention</div><div>Funnels</div><div>Events</div><div>Reports</div></aside>
<main><h1>Weekly overview</h1><div class=sub>Sep 21 – Sep 27 · compared with previous week</div>
<div class=kpis>{''.join(f"<div class=k><span>{a}</span><b>{b}</b><em class={'up' if c[0]=='+' else 'dn'}>{c}</em></div>" for a,b,c in [('Active users','24,819','+12.4%'),('New sign-ups','1,302','+8.1%'),('Avg. session','6m 12s','+0:34'),('Churn','2.1%','-0.3%')])}</div>
<div class=row><div class=panel style=flex:2><h3>Active users</h3>{spark(vals,'#7c3aed')}</div><div class=panel style=flex:1><h3>Sign-ups by day</h3><div class=bars>{bars}</div><div class=days><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div></div></div>
<div class=panel><h3>Top pages</h3>{''.join(f"<div class=tp><span>{p}</span><div class=bar><i style='width:{w}%'></i></div><b>{n}</b></div>" for p,w,n in [('/onboarding',92,'8,210'),('/dashboard',74,'6,544'),('/settings/export',41,'3,620'),('/pricing',30,'2,688')])}</div></main>"""
css = """body{display:flex;background:#f7f7fb;min-height:100vh}aside{width:210px;background:#1e1b4b;color:#c7c9ff;padding:18px 12px}aside b{display:block;color:#fff;font-size:18px;margin:0 10px 18px}
aside div{padding:8px 12px;border-radius:8px}aside .on{background:#312e81;color:#fff}main{flex:1;padding:24px 30px}h1{margin:0;font-size:24px}.sub{color:#777;margin-bottom:18px}
.kpis{display:flex;gap:14px}.k{flex:1;background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.06)}.k span{color:#777;font-size:12px;display:block}.k b{font-size:24px}
.k em{font-style:normal;font-size:12px;margin-left:8px}.up{color:#16a34a}.dn{color:#16a34a}.row{display:flex;gap:14px;margin:14px 0}.panel{background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
h3{margin:0 0 8px;font-size:14px}.bars{display:flex;align-items:flex-end;gap:10px;height:160px}.bars div{flex:1;background:#a78bfa;border-radius:6px 6px 0 0}.days{display:flex;gap:10px;color:#888;font-size:12px}.days span{flex:1;text-align:center}
.tp{display:flex;align-items:center;gap:14px;padding:6px 0}.tp span{width:160px}.bar{flex:1;height:8px;background:#eee;border-radius:4px}.bar i{display:block;height:100%;background:#7c3aed;border-radius:4px}"""
sites["app.pulse.example"] = (page("Weekly overview · Pulse Analytics", css, body), fav("#7c3aed", "#fff", "◉"))

# 6 Article -------------------------------------------------------------------
body = f"""<header><b>Longform</b><span>Essays</span><span>Design</span><span>Tech</span><span>Culture</span><div class=sp></div><span class=btn>Subscribe</span></header>
<article><div class=kick>ESSAY · 9 MIN READ</div><h1>The quiet art of keyboard shortcuts</h1><p class=dek>Why the fastest tools are the ones you never have to look at.</p>
<div class=by><span class=av></span>By Ananya Menon · September 24</div><div class=hero></div>
<p>{lorem(55)}</p><p>{lorem(48)}</p></article>"""
css = """body{background:#fffdf8;color:#222}header{display:flex;gap:22px;align-items:center;padding:16px 40px;border-bottom:1px solid #eee}header b{font:700 26px Georgia,serif;margin-right:20px}.sp{flex:1}
.btn{background:#111;color:#fff;padding:8px 16px;border-radius:20px}article{max-width:720px;margin:34px auto}.kick{color:#b45309;font-weight:700;font-size:12px;letter-spacing:.08em}
h1{font:700 44px/1.1 Georgia,serif;margin:10px 0}.dek{font:20px Georgia,serif;color:#555;margin:0 0 16px}.by{display:flex;gap:10px;align-items:center;color:#666}.av{width:34px;height:34px;border-radius:50%;background:#d6a36b}
.hero{height:300px;margin:22px 0;border-radius:6px;background:radial-gradient(circle at 30% 40%,#fcd34d,transparent 40%),radial-gradient(circle at 70% 60%,#fb7185,transparent 45%),linear-gradient(135deg,#1e293b,#7c2d12)}
p{font:18px/1.7 Georgia,serif}"""
sites["read.longform.example"] = (page("The quiet art of keyboard shortcuts – Longform", css, body), fav("#111", "#fcd34d", "L"))

# 7 Calendar ------------------------------------------------------------------
evs = [(0,2,2,"Standup","#6366f1"),(0,5,2,"Roadmap sync","#0ea5e9"),(1,1,3,"Deep work","#10b981"),(1,6,2,"1:1 Priya","#f59e0b"),(2,2,2,"Standup","#6366f1"),
       (2,8,2,"Design crit","#ec4899"),(3,3,4,"Sprint planning","#0ea5e9"),(3,8,1,"Gym","#10b981"),(4,2,2,"Standup","#6366f1"),(4,5,3,"Onboarding review","#f59e0b")]
cols_html = ""
for d, dn in enumerate(["Mon 28","Tue 29","Wed 30","Thu 1","Fri 2"]):
    ev = "".join(f"<div class=ev style='top:{s*44}px;height:{l*44-4}px;background:{c}'>{t}</div>" for dd,s,l,t,c in evs if dd==d)
    cols_html += f"<div class=day><div class=dh{' style=color:#4f46e5' if d==0 else ''}>{dn}</div><div class=slots>{ev}</div></div>"
hours = "".join(f"<div>{h}</div>" for h in ["9 AM","10","11","12 PM","1","2","3","4","5","6","7","8"])
body = f"""<header><b>▣ Dayplan</b><span class=btn>Today</span><span>‹ ›</span><b style=font-size:18px>Sep 28 – Oct 2, 2026</b><div class=sp></div><span class=btn>Week ▾</span></header>
<div class=wrap><div class=hours>{hours}</div>{cols_html}</div>"""
css = """body{background:#fff}header{display:flex;gap:16px;align-items:center;padding:12px 22px;border-bottom:1px solid #e5e7eb}header b{font-size:20px}.sp{flex:1}.btn{border:1px solid #ddd;border-radius:6px;padding:5px 14px}
.wrap{display:flex;padding:0 16px}.hours{width:60px;padding-top:44px;color:#888;font-size:11px}.hours div{height:44px}.day{flex:1;border-left:1px solid #eee}
.dh{height:44px;display:grid;place-items:center;font-weight:600;color:#555}.slots{position:relative;height:528px;background:repeating-linear-gradient(#fff 0 43px,#f1f1f1 43px 44px)}
.ev{position:absolute;left:4px;right:6px;border-radius:6px;color:#fff;padding:4px 8px;font-size:12px;font-weight:600}"""
sites["cal.dayplan.example"] = (page("Week of Sep 28 · Dayplan", css, body), fav("#4f46e5", "#fff", "▣"))

# 8 Maps ----------------------------------------------------------------------
roads = "".join(f"<path d='M-20 {y} L 1300 {y+random.randint(-80,80)}' stroke='#fff' stroke-width='{random.choice([3,4,7])}' fill='none' />" for y in range(40,800,70)) + "".join(f"<path d='M{x} -20 L {x+random.randint(-120,120)} 820' stroke='#fff' stroke-width='{random.choice([3,4,7])}' fill='none' />" for x in range(60,1280,95))
body = f"""<svg class=map viewBox='0 0 1280 800' preserveAspectRatio='xMidYMid slice'><rect width=1280 height=800 fill='#e8efe4'/><path d='M0 620 Q 300 560 520 640 T 1280 600 V800 H0Z' fill='#bcdcf5'/>
<circle cx=880 cy=240 r=120 fill='#cfe6c3'/><circle cx=260 cy=200 r=90 fill='#cfe6c3'/>{roads}
<path d='M380 520 C 520 420, 700 470, 820 330 S 1020 220, 1080 170' stroke='#2563eb' stroke-width=7 fill=none stroke-linecap=round />
<circle cx=380 cy=520 r=11 fill='#fff' stroke='#2563eb' stroke-width=5/><circle cx=1080 cy=170 r=13 fill='#ef4444'/></svg>
<div class=panel><b>Wayfare</b><div class=f><span>◯</span>Bengaluru</div><div class=f><span style=color:#ef4444>●</span>Mysuru Palace</div>
<div class=modes><span class=on>🚗 2 h 51 min</span><span>🚆 2 h 5 min</span><span>🚌 3 h 30 min</span></div><div class=r><b>2 h 51 min</b> (145 km)<br><small>Fastest route via SH 17 · Light traffic</small></div></div>"""
css = """body{overflow:hidden}.map{position:fixed;inset:0;width:100%;height:100%}.panel{position:fixed;left:18px;top:18px;width:360px;background:#fff;border-radius:14px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,.18)}
.panel>b{font-size:20px;color:#059669;display:block;margin-bottom:10px}.f{display:flex;gap:12px;border:1px solid #ddd;border-radius:8px;padding:9px 12px;margin-bottom:8px}
.modes{display:flex;gap:6px;margin:10px 0;font-size:12px}.modes span{padding:6px 8px;border-radius:14px;background:#f1f5f9}.modes .on{background:#d1fae5;color:#065f46;font-weight:600}.r{border-top:1px solid #eee;padding-top:10px}.r b{color:#059669;font-size:18px}"""
sites["maps.wayfare.example"] = (page("Bengaluru → Mysuru · Wayfare", css, body), fav("#059669", "#fff", "➤"))

# 9 Music ---------------------------------------------------------------------
tracks = [("Slow Currents","Mira Vale","3:41"),("Paper Lanterns","The Ondes","4:12"),("Night Bus","Lo Kinetic","2:58"),("Blue Hour","Sora Fields","3:27"),("Static Bloom","Halden","4:05"),("Afterglow","Mira Vale","3:50")]
tr = "".join(f"<div class='t{' on' if i==2 else ''}'><i>{i+1}</i><span><b>{a}</b><br><small>{b}</small></span><em>{c}</em></div>" for i,(a,b,c) in enumerate(tracks))
body = f"""<div class=hero><div class=cover></div><div><small>PLAYLIST</small><h1>Late Night Focus</h1><p>Mellow beats for deep work · 48 songs, 2 h 36 min</p><span class=play>▶</span></div></div>
<div class=list>{tr}</div><footer><b>Night Bus</b> · Lo Kinetic<div class=prog><i></i></div><span>1:12 / 2:58</span></footer>"""
css = """body{background:linear-gradient(#4c1d95 0,#18181b 420px);color:#fff;min-height:100vh}.hero{display:flex;gap:28px;align-items:flex-end;padding:40px 36px 24px}
.cover{width:220px;height:220px;border-radius:8px;background:conic-gradient(from 200deg,#f472b6,#8b5cf6,#22d3ee,#f472b6);box-shadow:0 8px 40px rgba(0,0,0,.5)}
h1{font-size:64px;margin:4px 0}.play{display:inline-grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#22c55e;color:#000;font-size:22px}
.list{padding:0 36px}.t{display:flex;align-items:center;gap:20px;padding:8px 14px;border-radius:6px;color:#d4d4d8}.t i{width:20px;font-style:normal}.t span{flex:1}.t small{color:#a1a1aa}.on{background:rgba(255,255,255,.1)}.on b{color:#22c55e}
footer{position:fixed;bottom:0;left:0;right:0;display:flex;gap:18px;align-items:center;padding:16px 28px;background:#000}.prog{flex:1;height:4px;background:#3f3f46;border-radius:2px}.prog i{display:block;width:40%;height:100%;background:#fff;border-radius:2px}"""
sites["play.tunebox.example"] = (page("Late Night Focus · Tunebox", css, body), fav("#22c55e", "#000", "♪"))

# 10 Shop ---------------------------------------------------------------------
body = """<header><b>Hearth &amp; Co.</b><span>Kitchen</span><span>Coffee</span><span>Tableware</span><span>Gifts</span><div class=sp></div><span>🛒 2</span></header>
<main><div class=img><div class=pot></div></div><div class=info><small>COFFEE · HANDMADE</small><h1>Ceramic pour-over set</h1><div class=stars>★★★★★ <span>214 reviews</span></div>
<div class=price>₹2,490</div><p>Hand-thrown stoneware dripper with a matching 500 ml carafe. Glazed in speckled oat, dishwasher safe.</p>
<div class=sw><span style=background:#e7dcc8></span><span style=background:#4b5563></span><span style=background:#b45309></span></div><div class=buy>Add to cart</div></div></main>"""
css = """body{background:#faf7f2;color:#2d2a26}header{display:flex;gap:26px;align-items:center;padding:18px 44px}header b{font:600 24px Georgia,serif;margin-right:20px}.sp{flex:1}
main{display:flex;gap:50px;padding:20px 44px}.img{flex:1.1;height:520px;border-radius:16px;background:linear-gradient(160deg,#efe6d8,#d9c9b0);display:grid;place-items:center}
.pot{width:220px;height:260px;background:radial-gradient(circle at 35% 30%,#fff8ec,#e2d3bb 60%,#c4ae8c);border-radius:40% 40% 46% 46%/30% 30% 60% 60%;box-shadow:0 30px 50px rgba(0,0,0,.15)}
.info{flex:1}small{letter-spacing:.1em;color:#8a7b66}h1{font:600 38px Georgia,serif;margin:6px 0}.stars{color:#d97706}.stars span{color:#777}.price{font-size:28px;margin:14px 0}p{font-size:16px;color:#555}
.sw{display:flex;gap:10px;margin:18px 0}.sw span{width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ccc}.buy{background:#2d2a26;color:#fff;text-align:center;padding:14px;border-radius:30px;width:280px}"""
sites["shop.hearth.example"] = (page("Ceramic pour-over set – Hearth & Co.", css, body), fav("#b45309", "#fff", "H"))

# 11 Weather ------------------------------------------------------------------
days = "".join(f"<div class=d><span>{d}</span><b>{i}</b><em>{h}° <small>{l}°</small></em></div>" for d,i,h,l in [("Mon","⛅",28,20),("Tue","🌧",25,19),("Wed","🌦",26,19),("Thu","☀",29,20),("Fri","⛅",28,21)])
body = f"""<main><div class=loc>Bengaluru</div><div class=big>27°</div><div class=cond>Partly cloudy · Feels like 29°</div><div class=hl>H 28° · L 20°</div>
<div class=card><h3>5-day forecast</h3>{days}</div><div class=grid><div class=card><h3>Humidity</h3><b>68%</b></div><div class=card><h3>Wind</h3><b>14 km/h</b></div><div class=card><h3>UV index</h3><b>6 · High</b></div></div></main>"""
css = """body{min-height:100vh;background:linear-gradient(180deg,#38bdf8,#6366f1);color:#fff}main{max-width:620px;margin:auto;padding:34px 20px;text-align:center}.loc{font-size:30px}.big{font-size:110px;font-weight:200;line-height:1}
.cond,.hl{font-size:18px;opacity:.9}.card{background:rgba(255,255,255,.18);border-radius:16px;padding:14px 18px;margin-top:16px;text-align:left}h3{margin:0 0 6px;font-size:13px;opacity:.8;text-transform:uppercase}
.d{display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.2);font-size:17px}.d em{font-style:normal}.grid{display:flex;gap:14px}.grid .card{flex:1}.grid b{font-size:22px}"""
sites["skycast.example"] = (page("Bengaluru · Skycast Weather", css, body), fav("#0ea5e9", "#fff", "☀"))

# 12 Chat ---------------------------------------------------------------------
msgs = [("Meera","#f59e0b","Pushed dashboard mocks v3 🎉 the weekly view is way calmer now"),("Arjun","#10b981","Nice! Can we keep the KPI row but drop the sparkline colours?"),
        ("Priya","#6366f1","+1. Also the empty state needs copy, I'll take that"),("Meera","#f59e0b","Sure, updating before the crit at 4"),("Kiran","#ef4444","Reminder: design crit moved to room 3B")]
m = "".join(f"<div class=m><span class=av style=background:{c}>{n[0]}</span><div><b>{n}</b> <small>4:{10+i*3:02d} PM</small><div>{t}</div></div></div>" for i,(n,c,t) in enumerate(msgs))
body = f"""<aside><b>Parley</b><h4>Channels</h4><div># general</div><div class=on># design-crit</div><div># roadmap</div><div># random</div><h4>Direct messages</h4><div>● Priya</div><div>● Arjun</div><div>○ Kiran</div></aside>
<main><header><b># design-crit</b><span>Weekly critique, bring your WIP</span></header>{m}<div class=in>Message #design-crit</div></main>"""
css = """body{display:flex;min-height:100vh}aside{width:240px;background:#3b0764;color:#e9d5ff;padding:16px 10px}aside b{font-size:20px;color:#fff;margin:0 10px}aside h4{margin:18px 10px 6px;font-size:12px;opacity:.7}
aside div{padding:5px 12px;border-radius:6px}aside .on{background:#7e22ce;color:#fff}main{flex:1;display:flex;flex-direction:column}header{padding:14px 20px;border-bottom:1px solid #eee;display:flex;gap:14px;align-items:center}header b{font-size:18px}header span{color:#777}
.m{display:flex;gap:12px;padding:10px 20px}.av{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:700}small{color:#999}.in{margin:auto 20px 20px;border:1px solid #ccc;border-radius:10px;padding:14px;color:#999}"""
sites["team.parley.example"] = (page("#design-crit · Parley", css, body), fav("#7e22ce", "#fff", "P"))

# 13 Travel (closed) ----------------------------------------------------------
body = """<header><b>✈ Skyroute</b></header><main><h1>Bengaluru → Goa</h1><p>Fri, Oct 9 · 1 adult · Economy</p>
""" + "".join(f"<div class=f><b>{a}</b><span>{b}</span><em>{c}</em><strong>{d}</strong></div>" for a,b,c,d in [("06:10 → 07:25","1 h 15 m · Non-stop","Indigo-ish Air","₹3,812"),("09:40 → 11:00","1 h 20 m · Non-stop","Bluejet","₹4,105"),("14:15 → 15:30","1 h 15 m · Non-stop","Skyline","₹3,540")]) + "</main>"
body = body.replace("Indigo-ish Air", "Coastal Air")
css = """body{background:#f0f9ff}header{background:#0369a1;color:#fff;padding:16px 40px;font-size:20px}main{max-width:820px;margin:26px auto}h1{margin:0}.f{display:flex;gap:30px;align-items:center;background:#fff;border-radius:12px;padding:18px 22px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.f span,.f em{color:#666;font-style:normal;flex:1}.f strong{font-size:20px;color:#0369a1}"""
sites["flights.skyroute.example"] = (page("Bengaluru to Goa flights · Skyroute", css, body), fav("#0369a1", "#fff", "✈"))

for host, (html_s, svg) in sites.items():
    d = os.path.join(ROOT, host); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(html_s)
    open(os.path.join(d, "favicon.svg"), "w").write(svg)
print(len(sites), "sites")
