const $ = s => document.querySelector(s),
    E = (t, p = {}, ...k) => {
        const e = Object.assign(document.createElement(t), p);
        k.flat().forEach(c => e.append(c));
        return e
    },
    COL = ['#2f6f9f', '#3b7d5c', '#b5651d', '#7a4f9a', '#a63d40', '#4a5568'],
    SND = ['none', 'beep', 'chime', 'triple', 'low'],
    pad = n => String(n).padStart(2, '0');
const DEF = () => ({
    title: '',
    subject: '',
    desc: '',
    rules: '',
    startAt: null,
    pausedAt: null,
    endedAt: null,
    dur: 90,
    sections: [],
    guides: [],
    cueOn: false,
    cueMode: 'beep',
    cueMarks: '60,30,10,5,1',
    matMode: 'r',
    mats: [],
    voice: {
        name: '',
        rate: .85,
        pitch: .9,
        vol: .7
    }
});
const newSectionId = () => 's' + Date.now() + Math.random().toString(36).slice(2);
let cfg = DEF();
try {
    const s = JSON.parse(localStorage.getItem('exam') || 'null');
    if (s) Object.assign(cfg, s)
} catch (e) { }
cfg.voice = Object.assign(DEF().voice, cfg.voice);
let presets = {};
try {
    presets = JSON.parse(localStorage.getItem('examPresets') || '{}')
} catch (e) { }
const strip = m => m.type === 'text' || m.type === 'link' ? m : {
    ...m,
    src: ''
};
const save = () => {
    try {
        localStorage.setItem('exam', JSON.stringify({
            ...cfg,
            mats: cfg.mats.map(strip)
        }))
    } catch (e) { }
};
const savePs = () => {
    try {
        localStorage.setItem('examPresets', JSON.stringify(presets))
    } catch (e) {
        alert('Presets could not be saved in this browser.')
    }
};
const snap = () => {
    const r = {
        ...cfg
    };
    delete r.startAt;
    delete r.pausedAt;
    delete r.endedAt;
    return JSON.parse(JSON.stringify({
        ...r,
        mats: cfg.mats.map(strip)
    }))
};
const t12 = (ms, sec = true) => new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    ...(sec ? {
        second: '2-digit'
    } : {}),
    hour12: true
});
const toTime = ms => {
    const d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes())
};
const tsec = v => String(v || '').split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0) || 0;
const ytId = u => {
    const m = (u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return m && m[1]
};

/* sound */
let ac;
const A = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
document.addEventListener('click', () => {
    try {
        A().resume()
    } catch (e) { }
}, {
    once: true
});

function tone(f, t, d) {
    const c = A(),
        o = c.createOscillator(),
        g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.3, t + .02);
    g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + d + .05)
}

function play(k) {
    if (!k || k === 'none') return;
    try {
        const t = A().currentTime;
        ({
            beep: () => tone(880, t, .4),
            chime: () => {
                tone(660, t, .5);
                tone(990, t + .18, .7)
            },
            triple: () => [0, .3, .6].forEach(i => tone(740, t + i, .2)),
            low: () => tone(330, t, .8)
        })[k]()
    } catch (e) { }
}

function cueBeep(m) {
    try {
        const f = m >= 60 ? 330 : m >= 30 ? 392 : m >= 10 ? 494 : m >= 5 ? 587 : m >= 2 ? 698 : 880,
            t = A().currentTime;
        tone(f, t, .35);
        if (m <= 1) tone(f, t + .45, .35)
    } catch (e) { }
}

function say(s) {
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(s),
            v = speechSynthesis.getVoices().find(x => x.name === cfg.voice.name);
        if (v) u.voice = v;
        u.rate = cfg.voice.rate;
        u.pitch = cfg.voice.pitch;
        u.volume = cfg.voice.vol;
        speechSynthesis.speak(u)
    } catch (e) { }
}
const spoken = m => m % 60 === 0 ? `${m / 60} hour${m > 60 ? 's' : ''} remaining` : `${m} minute${m > 1 ? 's' : ''} remaining`;
const cue = m => cfg.cueMode === 'voice' ? say(spoken(m)) : cueBeep(m);
let mic = null,
    micSrc = null;
async function toggleMic() {
    const b = $('#mic');
    if (mic) {
        try {
            micSrc.disconnect()
        } catch (e) { }
        mic.getTracks().forEach(t => t.stop());
        mic = micSrc = null;
        b.textContent = 'Mic off';
        b.classList.remove('live');
        return
    }
    try {
        const s = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        const c = A();
        await c.resume();
        micSrc = c.createMediaStreamSource(s);
        micSrc.connect(c.destination);
        mic = s;
        b.textContent = 'Mic live (click to turn off)';
        b.classList.add('live')
    } catch (e) {
        alert('Microphone unavailable: ' + e.message)
    }
}

/* setup form */
const used = (a, ex) => a.reduce((s, x) => x === ex ? s : s + (+x.min || 0), 0);
[
    ['title', 'title'],
    ['subject', 'subject'],
    ['desc0', 'desc'],
    ['rules', 'rules']
].forEach(([id, k]) => $('#' + id).oninput = e => {
    cfg[k] = e.target.value;
    save()
});
$('#dur').onchange = e => {
    const need = Math.max(used(cfg.sections), used(cfg.guides), 1);
    let v = Math.floor(+e.target.value) || 90;
    if (v < need) {
        alert('The sections or guides already add up to ' + need + ' minutes. Shorten them first.');
        v = need
    }
    cfg.dur = v;
    e.target.value = v;
    save();
    hints()
};
$('#cueOn').onchange = e => {
    cfg.cueOn = e.target.checked;
    save()
};
$('#cueMode').onchange = e => {
    cfg.cueMode = e.target.value;
    save();
    vis()
};
$('#cueMarks').oninput = e => {
    cfg.cueMarks = e.target.value;
    save();
    renderTests()
};
[
    ['vrate', 'rate'],
    ['vpitch', 'pitch'],
    ['vvol', 'vol']
].forEach(([id, k]) => $('#' + id).oninput = e => {
    cfg.voice[k] = +e.target.value;
    save()
});
$('#vtest').onclick = () => say('Ten minutes remaining. Please continue working quietly.');
const vis = () => {
    $('#voicebox').hidden = cfg.cueMode !== 'voice'
};

function renderTests() {
    $('#tests').replaceChildren(...cfg.cueMarks.split(',').map(Number).filter(n => n > 0).map(m => E('button', {
        className: 'btn alt',
        textContent: m + ' min',
        onclick: () => cue(m)
    })))
}

function voices() {
    const sel = $('#vname'),
        vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []).slice().sort((a, b) => (b.lang.startsWith('en') - a.lang.startsWith('en')) || a.name.localeCompare(b.name));
    sel.replaceChildren(E('option', {
        value: '',
        textContent: 'Browser default'
    }), ...vs.map(v => E('option', {
        value: v.name,
        textContent: v.name + ' (' + v.lang + ')',
        selected: v.name === cfg.voice.name
    })));
    sel.onchange = () => {
        cfg.voice.name = sel.value;
        save()
    }
}
try {
    speechSynthesis.onvoiceschanged = voices
} catch (e) { }

const F = (o, k, type = 'text', ph = '') => {
    const i = E('input', {
        type,
        placeholder: ph,
        title: ph,
        value: (o[k] === undefined || o[k] === null) ? '' : o[k]
    });
    i.oninput = () => {
        o[k] = type === 'number' ? +i.value : i.value;
        save()
    };
    return i
};
const L = (t, i) => E('label', {}, t, i);
const S = (o, k, opts, cb) => {
    const s = E('select');
    opts.forEach(x => s.append(E('option', {
        value: x,
        textContent: x,
        selected: o[k] === x
    })));
    s.onchange = () => {
        o[k] = s.value;
        save();
        cb && cb()
    };
    return s
};
const SP = o => L('Sound', E('div', {
    style: 'display:flex;gap:4px'
}, S(o, 'sound', SND), E('button', {
    className: 'btn alt',
    textContent: '▶',
    title: 'Preview sound',
    onclick: () => play(o.sound)
})));
const M = (arr, o) => {
    const i = E('input', {
        type: 'number',
        min: 1,
        step: 1,
        value: o.min
    });
    i.oninput = () => {
        const mx = cfg.dur - used(arr, o);
        let v = Math.floor(+i.value) || 0;
        if (v > mx) {
            v = mx;
            i.value = mx
        }
        o.min = v;
        save();
        hints()
    };
    return L('Minutes', i)
};

function list(host, arr, mk) {
    host.replaceChildren(...arr.map((o, i) => {
        const r = E('div', {
            className: 'item'
        }, mk(o));
        r.append(E('button', {
            className: 'x',
            textContent: '✕',
            title: 'Remove',
            onclick: () => {
                if (arr === cfg.sections) cfg.guides.forEach(g => {
                    if (g.section === o.id) g.section = ''
                });
                arr.splice(i, 1);
                save();
                renderLists()
            }
        }));
        return r
    }))
}

function hints() {
    $('#secinfo').textContent = `${used(cfg.sections)} of ${cfg.dur} minutes used by sections.`;
    $('#guideinfo').textContent = `${used(cfg.guides)} of ${cfg.dur} minutes used by guides.`
}

function renderLists() {
    list($('#secs'), cfg.sections, o => [L('Name', F(o, 'name', 'text', 'Section name')), M(cfg.sections, o), L('Colour', F(o, 'color', 'color')), SP(o), L('Description (optional)', F(o, 'desc', 'text', 'Shown under the section name'))]);
    list($('#guides'), cfg.guides, o => [L('Name', F(o, 'name', 'text', 'e.g. Question 1')), M(cfg.guides, o), L('Colour', F(o, 'color', 'color')), L('Section (optional)', (() => {
        const s = E('select');
        s.append(E('option', {
            value: '',
            textContent: 'No section (from exam start)'
        }));
        cfg.sections.forEach((section, i) => s.append(E('option', {
            value: section.id,
            textContent: section.name || 'Section ' + (i + 1)
        })));
        s.value = o.section || '';
        s.onchange = () => {
            o.section = s.value;
            save()
        };
        return s
    })()), SP(o)]);
    list($('#mats'), cfg.mats, o => [L('Name', F(o, 'name', 'text', 'Name')), L('Type', S(o, 'type', ['text', 'image', 'video', 'audio', 'link'], renderLists)),
    o.type === 'text' ? L('Text', (() => {
        const t = E('textarea', {
            value: o.text || ''
        });
        t.oninput = () => {
            o.text = t.value;
            save()
        };
        return t
    })()) :
        o.type === 'link' ? L('YouTube or other link', F(o, 'url', 'text', 'https://...')) :
            L('File', E('input', {
                type: 'file',
                accept: o.type + '/*',
                onchange: e => {
                    const f = e.target.files[0];
                    if (!f) return;
                    o.fname = f.name;
                    if (o.type === 'image') {
                        const r = new FileReader();
                        r.onload = () => {
                            o.src = r.result;
                            save()
                        };
                        r.readAsDataURL(f)
                    } else o.src = URL.createObjectURL(f)
                }
            })),
    ...(o.type === 'video' || o.type === 'audio' || o.type === 'link' ? [L('Clip start (m:ss)', F(o, 'cs', 'text', '0:30')), L('Clip end (m:ss)', F(o, 'ce', 'text', '1:45'))] : []),
    L('Auto-show at minute(s)', F(o, 'times', 'text', 'e.g. 0, 45')), L('Hide after (min, 0 = manual)', F(o, 'mdur', 'number', '0'))
    ]);
    hints()
}
let nc = 0;
$('#addsec').onclick = () => {
    const r = cfg.dur - used(cfg.sections);
    if (r < 1) return alert('All ' + cfg.dur + ' minutes are already used by sections.');
    cfg.sections.push({
        id: newSectionId(),
        name: '',
        min: Math.min(10, r),
        color: COL[cfg.sections.length % 6],
        sound: 'chime',
        desc: ''
    });
    save();
    renderLists()
};
$('#preset').onclick = () => {
    const r = cfg.dur - used(cfg.sections);
    if (r < 2) return alert('Not enough unused minutes.');
    const a = Math.min(5, r - 1);
    cfg.sections.push({
        id: newSectionId(),
        name: 'Reading time',
        min: a,
        color: COL[2],
        sound: 'chime',
        desc: 'You may read the paper but not write.'
    }, {
        id: newSectionId(),
        name: 'Working time',
        min: r - a,
        color: COL[0],
        sound: 'triple',
        desc: ''
    });
    save();
    renderLists()
};
$('#addguide').onclick = () => {
    const r = cfg.dur - used(cfg.guides);
    if (r < 1) return alert('All ' + cfg.dur + ' minutes are already used by guides.');
    cfg.guides.push({
        name: '',
        min: Math.min(20, r),
        color: COL[(cfg.guides.length + 3) % 6],
        sound: 'beep',
        section: ''
    });
    save();
    renderLists()
};
$('#addmat').onclick = () => {
    cfg.mats.push({
        id: 'm' + Date.now() + (nc++),
        name: '',
        type: 'text',
        text: '',
        src: '',
        url: '',
        cs: '',
        ce: '',
        times: '',
        mdur: 0
    });
    save();
    renderLists()
};

document.querySelectorAll('.mm').forEach(x => x.onchange = () => {
    cfg.matMode = x.value;
    save();
    document.querySelectorAll('.mm').forEach(y => y.value = cfg.matMode)
});
/* presets */
function fillForm() {
    let sectionsChanged = false;
    cfg.sections.forEach(s => {
        if (!s.id) {
            s.id = newSectionId();
            sectionsChanged = true
        }
    });
    cfg.guides.forEach(g => {
        if (g.section && !cfg.sections.some(s => s.id === g.section)) {
            g.section = '';
            sectionsChanged = true
        }
    });
    [
        ['title', 'title'],
        ['subject', 'subject'],
        ['desc0', 'desc'],
        ['rules', 'rules']
    ].forEach(([id, k]) => $('#' + id).value = cfg[k]);
    $('#dur').value = cfg.dur;
    document.querySelectorAll('.mm').forEach(x => x.value = cfg.matMode || 'r');
    $('#cueOn').checked = cfg.cueOn;
    $('#cueMode').value = cfg.cueMode;
    $('#cueMarks').value = cfg.cueMarks;
    [
        ['vrate', 'rate'],
        ['vpitch', 'pitch'],
        ['vvol', 'vol']
    ].forEach(([id, k]) => $('#' + id).value = cfg.voice[k]);
    $('#start').value = $('#start2').value = cfg.startAt ? toTime(cfg.startAt) : '';
    cfg.mats.forEach((m, i) => m.id = m.id || 'm' + i + Date.now());
    if (sectionsChanged) save();
    voices();
    vis();
    renderTests();
    renderLists();
    renderPresets()
}

function loadSnap(s) {
    const keep = {
        startAt: cfg.startAt,
        pausedAt: cfg.pausedAt,
        endedAt: cfg.endedAt
    };
    cfg = Object.assign(DEF(), s, keep);
    cfg.voice = Object.assign(DEF().voice, cfg.voice);
    save();
    fillForm();
    shown = {};
    curKey = null
}

function renderPresets() {
    const h = $('#plist');
    h.replaceChildren(...Object.keys(presets).map(n => E('div', {
        className: 'item'
    }, E('b', {
        textContent: n,
        style: 'flex:1'
    }),
        E('button', {
            className: 'btn alt',
            textContent: 'Load',
            onclick: () => loadSnap(presets[n])
        }), E('button', {
            className: 'btn alt',
            textContent: 'Export',
            onclick: () => exportP(n, presets[n])
        }),
        E('button', {
            className: 'x',
            textContent: '✕',
            title: 'Delete',
            onclick: () => {
                if (confirm('Delete preset “' + n + '”?')) {
                    delete presets[n];
                    savePs();
                    renderPresets()
                }
            }
        }))));
    if (!h.children.length) h.textContent = 'No presets saved yet.'
}

function exportP(n, d) {
    const t = JSON.stringify({
        examRunnerPreset: 1,
        name: n,
        data: d
    }, null, 1);
    $('#pio').value = t;
    try {
        E('a', {
            href: URL.createObjectURL(new Blob([t], {
                type: 'application/json'
            })),
            download: n.replace(/[^\w-]+/g, '_') + '.json'
        }).click()
    } catch (e) { }
}

function importText(t) {
    try {
        const j = JSON.parse(t),
            d = j.data || j,
            n = j.name || 'Imported preset';
        if (typeof d !== 'object') throw 0;
        presets[n] = d;
        savePs();
        loadSnap(d);
        alert('Imported and loaded “' + n + '”.')
    } catch (e) {
        alert('That is not a valid preset.')
    }
}
$('#psave').onclick = () => {
    const n = $('#pname').value.trim();
    if (!n) return alert('Give the preset a name first.');
    if (presets[n] && !confirm('Overwrite “' + n + '”?')) return;
    presets[n] = snap();
    savePs();
    renderPresets()
};
$('#pnew').onclick = () => {
    if (confirm('Clear the current setup? Save it as a preset first if you want to keep it.')) loadSnap(DEF())
};
$('#pexp').onclick = () => exportP($('#pname').value.trim() || 'exam-setup', snap());
$('#pimp').onclick = () => importText($('#pio').value);
$('#pfile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importText(r.result);
    r.readAsText(f);
    e.target.value = ''
};
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => $('#' + b.dataset.go).scrollIntoView({
    behavior: 'smooth',
    block: 'start'
}));

/* tabs */
function tab(t) {
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('#setup').hidden = t !== 'setup';
    $('#run').hidden = t !== 'run';
    if (t === 'run') {
        buildCtl();
        fitCv($('#stage'))
    }
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => tab(b.dataset.t));

/* display stages */
const STAGE = `<div id="stage"><button id="fsb" title="Full screen" aria-label="Full screen">⛶</button><div id="cv"><div id="info"><div id="top"><div><h1 id="h1"></h1><h2 id="sub"></h2><p id="desc"></p></div><div id="mid"><div id="state"></div><div id="big">0:00:00</div><div id="now"></div><div id="sec" hidden><div id="secname"></div><div id="secleft"></div><div id="secdesc"></div></div><div id="guide" hidden></div><div id="bar"><i></i></div></div></div><div id="bot"><div id="rulesbox"></div></div></div><div id="mat" hidden></div></div></div>`;
const toggleFS = s => {
    const d = s.ownerDocument;
    d.fullscreenElement ? d.exitFullscreen() : s.requestFullscreen().catch(() => { })
};
$('#stageHost').innerHTML = STAGE;
addEventListener('resize', () => fitCv($('#stage')));
document.addEventListener('fullscreenchange', () => fitCv($('#stage')));
const stage = $('#stage');
stage.querySelector('#fsb').onclick = () => toggleFS(stage);
let pop = null,
    popStage = null,
    curKey = null,
    fired = {},
    ls = null,
    lg = null,
    shown = {};
const DM = location.hash === '#display' && !!window.opener;
let lastV = null,
    lastA = null;
window.__x = () => ({
    cfg,
    shown,
    V: lastV,
    a: lastA
});
const popOpen = () => !!(pop && !pop.closed);

function closePop() {
    pop = popStage = null;
    curKey = null;
    window.__dispReady = false;
    $('#pop').textContent = 'Pop out display'
}

function blankPop(w) {
    pop = w;
    const d = w.document;
    d.title = 'Exam display';
    d.head.innerHTML = '';
    d.head.append(Object.assign(d.createElement('style'), {
        textContent: $('style').textContent + 'body{margin:0;background:var(--card);overflow:hidden}#stage{aspect-ratio:auto;width:100vw;height:100vh;border:0;border-radius:0}'
    }));
    d.body.innerHTML = STAGE;
    popStage = d.querySelector('#stage');
    d.querySelector('#fsb').onclick = () => toggleFS(popStage);
    d.addEventListener('dblclick', () => toggleFS(popStage));
    w.addEventListener('pagehide', closePop);
    w.addEventListener('resize', () => fitCv(popStage));
    d.addEventListener('fullscreenchange', () => fitCv(popStage));
    curKey = null
}
$('#pop').onclick = () => {
    if (popOpen()) {
        pop.close();
        closePop();
        return
    }
    pop = window.open(location.href.split('#')[0] + '#display', 'examdisplay', 'width=1100,height=700');
    if (!pop) return alert('The browser blocked the pop-up. Allow pop-ups for this page and try again.');
    $('#pop').textContent = 'Close display window';
    curKey = null;
    setTimeout(() => {
        if (popOpen() && !window.__dispReady) {
            try {
                blankPop(window.open('about:blank', 'examdisplay'))
            } catch (e) {
                closePop()
            }
        }
    }, 2500)
};
$('#full').onclick = () => popOpen() ? pop.focus() : toggleFS(stage);

function media(kind, src, m) {
    const s = tsec(m.cs),
        e = tsec(m.ce),
        el = E(kind, {
            src,
            controls: true,
            autoplay: true
        });
    el.addEventListener('loadedmetadata', () => {
        if (s) el.currentTime = s
    });
    el.addEventListener('timeupdate', () => {
        if (e && el.currentTime >= e) {
            el.pause();
            delete shown[m.id];
            buildCtl()
        }
    });
    return el
}

function showMat(r, m, isMain) {
    const h = r.querySelector('#mat');
    h.replaceChildren();
    if (!m) {
        h.hidden = true;
        return
    }
    h.hidden = false;
    if (isMain && popOpen() && m.type !== 'text' && m.type !== 'image') {
        h.append(E('div', {
            className: 'mtext',
            textContent: 'Showing in the display window: ' + (m.name || m.type)
        }));
        return
    }
    const s = tsec(m.cs),
        e = tsec(m.ce),
        id = ytId(m.url);
    let c;
    if (m.type === 'text') c = E('div', {
        className: 'mtext',
        textContent: m.text
    });
    else if (m.type === 'image') c = E('img', {
        src: m.src
    });
    else if (m.type === 'link') {
        if (id) c = E('iframe', {
            src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1${s ? '&start=' + s : ''}${e ? '&end=' + e : ''}`,
            allow: 'autoplay; fullscreen; encrypted-media',
            allowFullscreen: true,
            referrerPolicy: 'strict-origin-when-cross-origin'
        });
        else if (/\.(mp4|webm|mov)(\?|$)/i.test(m.url)) c = media('video', m.url, m);
        else if (/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(m.url)) c = media('audio', m.url, m);
        else c = E('iframe', {
            src: m.url,
            allow: 'autoplay; fullscreen',
            allowFullscreen: true
        })
    } else c = media(m.type, m.src, m);
    h.append(c)
}

function buildCtl() {
    $('#matbtns').replaceChildren(...cfg.mats.flatMap(m => {
        const b = E('button', {
            className: 'btn alt',
            textContent: (shown[m.id] ? 'Hide: ' : 'Show: ') + (m.name || m.type)
        });
        b.onclick = () => {
            if (shown[m.id]) delete shown[m.id];
            else shown[m.id] = {
                at: Date.now(),
                until: Infinity
            };
            buildCtl()
        };
        return m.type === 'link' && m.url ? [b, E('a', {
            href: m.url,
            target: '_blank',
            rel: 'noopener',
            textContent: 'Open ↗',
            className: 'btn alt',
            style: 'text-decoration:none'
        })] : [b]
    }))
}

/* controls */
const T0 = () => cfg.dur * 60;
const fmt = s => {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
};

function setStart(ms) {
    cfg.startAt = ms;
    cfg.pausedAt = cfg.endedAt = null;
    fired = {};
    ls = lg = null;
    shown = {};
    save();
    $('#start').value = $('#start2').value = ms ? toTime(ms) : ''
}

function schedFrom(v) {
    if (!v) {
        alert('Pick a start time first.');
        return false
    }
    const [h, m] = v.split(':'), d = new Date();
    d.setHours(+h, +m, 0, 0);
    let ms = d.getTime();
    if (ms < Date.now() - 1000) {
        if (!confirm('That time has already passed today. Start now instead?')) return false;
        ms = Date.now()
    }
    setStart(ms);
    return true
}
$('#sched').onclick = () => {
    if (schedFrom($('#start').value)) tab('run')
};
$('#setStart').onclick = () => schedFrom($('#start2').value);
$('#start').onchange = e => $('#start2').value = e.target.value;
$('#start2').onchange = e => $('#start').value = e.target.value;
$('#startNow').onclick = () => setStart(Date.now());
$('#pause').onclick = () => {
    if (cfg.pausedAt) {
        cfg.startAt += Date.now() - cfg.pausedAt;
        cfg.pausedAt = null;
        $('#start2').value = toTime(cfg.startAt)
    } else cfg.pausedAt = Date.now();
    save()
};
$('#stop').onclick = () => {
    if (confirm('Stop the exam now? The display will show that it has ended.')) {
        cfg.endedAt = Date.now();
        cfg.pausedAt = null;
        save()
    }
};
$('#hold').onclick = () => {
    if (confirm('Clear the start time? You can start it manually with Start now.')) setStart(null)
};
$('#delay').onclick = () => {
    const n = +$('#dly').value;
    if (!cfg.startAt || cfg.endedAt) return alert('Schedule or start the exam first.');
    if (!(n > 0)) return;
    cfg.startAt += n * 60000;
    fired = {};
    save();
    $('#start2').value = $('#start').value = toTime(cfg.startAt)
};
$('#mic').onclick = toggleMic;
$('#sayBtn').onclick = () => {
    const v = $('#say').value.trim();
    if (v) say(v)
};

function fitCv(r) {
    const cv = r.querySelector('#cv'),
        w = r.clientWidth,
        h = r.clientHeight;
    if (!w || !h) return;
    const sc = Math.min(w / 1600, h / 900);
    cv.style.transform = `translate(${(w - 1600 * sc) / 2}px,${(h - 900 * sc) / 2}px) scale(${sc})`
}

function paint(r, V) {
    const q = s => r.querySelector(s),
        cv = q('#cv');
    q('#h1').textContent = cfg.title || 'Exam';
    q('#sub').textContent = cfg.subject;
    q('#sub').hidden = !cfg.subject;
    q('#desc').textContent = cfg.desc;
    q('#desc').hidden = !cfg.desc;
    const lay = ((V.layout || '') + (cfg.rules ? '' : ' norules')).trim();
    if (cv.className !== lay) cv.className = lay;
    const rb = q('#rulesbox'),
        rk = cfg.rules + '|' + lay;
    if (r._rk !== rk) {
        r._rk = rk;
        rb.replaceChildren(...(cfg.rules ? [E('b', {
            textContent: 'Rules'
        }), document.createTextNode('\n' + cfg.rules)] : []));
        if (cfg.rules) {
            let f = lay.includes('sp') ? 20 : 26;
            const bot = q('#bot');
            rb.style.fontSize = f + 'px';
            while (bot.scrollHeight > bot.clientHeight + 1 && f > 11) {
                f--;
                rb.style.fontSize = f + 'px'
            }
        }
    }
    q('#state').textContent = V.state;
    q('#big').textContent = V.big;
    q('#now').innerHTML = '<span>Now</span> ' + V.now;
    q('#bar i').style.width = V.pct + '%';
    const sec = q('#sec'),
        gd = q('#guide');
    sec.hidden = !V.sec;
    gd.hidden = !V.guide;
    if (V.sec) {
        sec.style.background = V.sec.color;
        q('#secname').textContent = V.sec.name;
        q('#secleft').textContent = V.sec.left + ' left in this section' + V.sec.next;
        q('#secdesc').textContent = V.sec.desc;
        q('#secdesc').hidden = !V.sec.desc
    }
    if (V.guide) {
        gd.style.background = V.guide.color;
        gd.textContent = V.guide.text
    }
    fitCv(r)
}

function tick() {
    const now = Date.now();
    $('#clock').textContent = t12(now);
    if (pop && pop.closed) closePop();
    const T = T0(),
        paused = !!cfg.pausedAt;
    let st = 'idle',
        el = 0;
    if (cfg.startAt) {
        el = ((cfg.pausedAt || cfg.endedAt || now) - cfg.startAt) / 1000;
        st = cfg.endedAt ? 'done' : el < 0 ? 'wait' : el < T ? 'run' : 'done'
    }
    const stAt = cfg.startAt ? t12(cfg.startAt, false) : '';
    const V = {
        st,
        now: t12(now),
        pct: st === 'run' ? Math.min(100, el / T * 100) : st === 'done' ? 100 : 0,
        sec: null,
        guide: null,
        state: paused && st === 'run' ? 'Paused' : paused ? 'Paused. Time until start (' + stAt + ')' : {
            idle: 'Not started. Total time ' + fmt(T),
            wait: 'Starts at ' + stAt + ', in',
            run: 'Time remaining',
            done: cfg.endedAt ? 'The exam has ended.' : 'Time is up. Pens down.'
        }[st],
        big: st === 'wait' ? fmt(-el) : st === 'run' ? fmt(T - el) : st === 'done' ? '0:00:00' : fmt(T)
    };
    if (st === 'run') {
        let c = 0;
        let activeSection = null,
            sectionStart = 0;
        for (let i = 0; i < cfg.sections.length; i++) {
            const s = cfg.sections[i],
                d = s.min * 60;
            if (el < c + d) {
                activeSection = s;
                sectionStart = c;
                V.sec = {
                    name: s.name || 'Section ' + (i + 1),
                    left: fmt(c + d - el),
                    color: s.color,
                    desc: s.desc || '',
                    next: cfg.sections[i + 1] ? '. Next: ' + (cfg.sections[i + 1].name || 'Section ' + (i + 2)) : ''
                };
                if (!paused && i !== ls) {
                    if (ls !== null || el - c < 3) {
                        play(s.sound);
                        if (cfg.cueOn && cfg.cueMode === 'voice' && s.sound !== 'none') say((s.name || 'Next section') + ' begins')
                    }
                    ls = i
                }
                break
            }
            c += d
        }
        const showGuide = (guides, elapsed, keyPrefix) => {
            let guideTime = 0;
            for (let i = 0; i < guides.length; i++) {
                const g = guides[i],
                    d = g.min * 60;
                if (elapsed < guideTime + d) {
                    const key = keyPrefix + i,
                        name = g.name || 'Part ' + (i + 1),
                        left = guideTime + d - elapsed;
                    V.guide = {
                        color: g.color,
                        name,
                        left: fmt(left),
                        text: `Guide: ${name} (about ${g.min} min). ${fmt(left)} left`
                    };
                    if (!paused && key !== lg) {
                        if (lg !== null || elapsed - guideTime < 3) play(g.sound);
                        lg = key
                    }
                    return true
                }
                guideTime += d
            }
            return false
        };
        const sectionGuides = activeSection ? cfg.guides.filter(g => g.section === activeSection.id) : [];
        const generalGuides = cfg.guides.filter(g => !g.section);
        if (!showGuide(sectionGuides, el - sectionStart, 's' + (activeSection ? activeSection.id : '') + ':')) {
            showGuide(generalGuides, el, 'g:')
        }
        if (!paused) {
            if (cfg.cueOn) {
                const r = T - el;
                cfg.cueMarks.split(',').map(Number).filter(n => n > 0).forEach(m => {
                    if (r <= m * 60 && r > m * 60 - 3 && !fired['c' + m]) {
                        fired['c' + m] = 1;
                        cue(m)
                    }
                })
            }
            cfg.mats.forEach(m => String(m.times || '').split(',').map(parseFloat).filter(x => !isNaN(x)).forEach(t => {
                const k = m.id + ':' + t;
                if (el >= t * 60 && el < t * 60 + 3 && !fired[k]) {
                    fired[k] = 1;
                    shown[m.id] = {
                        at: now,
                        until: m.mdur ? now + m.mdur * 60000 : Infinity
                    };
                    buildCtl()
                }
            }))
        }
    }
    if (st === 'done' && !fired.end) {
        fired.end = 1;
        if (cfg.endedAt ? now - cfg.endedAt < 3000 : el < T + 5) {
            cfg.cueOn && cfg.cueMode === 'voice' ? say('Time is up. Please put your pens down.') : play('triple')
        }
    }
    let a = null;
    for (const id in shown) {
        if (shown[id].until <= now) {
            delete shown[id];
            buildCtl();
            continue
        }
        if (!a || shown[id].at > shown[a].at) a = id
    }
    V.layout = a ? ({
        r: 'sp split-r',
        l: 'sp split-l',
        c: 'cover'
    }[cfg.matMode || 'r'] || 'sp split-r') : '';
    const key = (a || '') + '|' + popOpen() + '|' + cfg.matMode;
    if (key !== curKey) {
        curKey = key;
        const m = a && cfg.mats.find(x => x.id === a);
        showMat(stage, m, true);
        if (popStage) showMat(popStage, m, false)
    }
    lastV = V;
    lastA = a;
    if (popOpen() && typeof pop.__updateDisplay === 'function') {
        pop.__updateDisplay({ cfg, shown, V, a })
    }
    paint(stage, V);
    if (popStage) paint(popStage, V);
    /* control panel */
    const sn = $('#startNow');
    sn.textContent = st === 'run' ? 'Started…' : st === 'done' ? 'Start again' : 'Start now';
    sn.disabled = st === 'run';
    $('#pause').textContent = paused ? 'Resume' : 'Pause';
    $('#pause').disabled = !(st === 'run' || st === 'wait');
    $('#stop').disabled = st !== 'run';
    $('#setStart').disabled = st === 'run';
    $('#lvSt').textContent = paused ? 'Paused' : {
        idle: 'Not started',
        wait: 'Waiting to start',
        run: 'Running',
        done: cfg.endedAt ? 'Ended early' : 'Finished'
    }[st];
    $('#lvMainK').textContent = st === 'wait' ? 'Starts in' : 'Time remaining';
    $('#lvMain').textContent = st === 'wait' ? fmt(-el) + ' (at ' + stAt + ')' : st === 'idle' ? fmt(T) : V.big;
    $('#lvSec').textContent = V.sec ? V.sec.name + ', ' + V.sec.left + ' left' : 'None';
    $('#lvGuide').textContent = V.guide ? V.guide.name + ', ' + V.guide.left + ' left' : 'None';
}

function dispLoop() {
    document.body.classList.add('dm');
    $('#run').hidden = false;
    let ck = null;
    addEventListener('resize', () => fitCv(stage));
    document.addEventListener('fullscreenchange', () => fitCv(stage));
    stage.addEventListener('dblclick', () => toggleFS(stage));
    window.__updateDisplay = x => {
        if (!x || !x.V) return;
        cfg = x.cfg;
        shown = x.shown;
        const k = (x.a || '') + '|' + cfg.matMode;
        if (k !== ck) {
            ck = k;
            showMat(stage, x.a && cfg.mats.find(m => m.id === x.a), false)
        }
        paint(stage, x.V)
    };
    const O = window.opener;
    if (!O || O.closed) return window.close();
    window.__updateDisplay(O.__x());
    O.__dispReady = true;
    setInterval(() => {
        if (!window.opener || window.opener.closed) window.close()
    }, 1000)
}
fillForm();
if (DM) dispLoop();
else {
    setInterval(tick, 250);
    tick()
}