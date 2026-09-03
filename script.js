/* Heat Pump Guides — one-page site
   - heat pump diagram: heating / cooling modes
   - episodes: painted from baked data, then refreshed from the live RSS feed
   - one shared audio element; the scrubber moves to whatever is playing
   - state map: shape, label and callout chip highlight together
*/
(function () {
  'use strict';

  var FEED = 'https://anchor.fm/s/f8c1cc3c/podcast/rss';
  var SHOW_IN_LIST = 5; // below the featured latest episode
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------------- diagram */
  var rig = $('#rig');
  if (rig) {
    var READOUT = {
      heat: { inside: '68°F', outside: '23°F' },
      cool: { inside: '72°F', outside: '94°F' }
    };
    var tIn = $('#tIn'), tOut = $('#tOut');
    var modeBtns = $$('.rig-mode');
    var cycle = null;

    function setMode(mode) {
      rig.classList.toggle('is-heat', mode === 'heat');
      rig.classList.toggle('is-cool', mode === 'cool');
      if (tIn) tIn.textContent = READOUT[mode].inside;
      if (tOut) tOut.textContent = READOUT[mode].outside;
      modeBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
      });
    }

    modeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (cycle) { clearInterval(cycle); cycle = null; } // hand control over
        setMode(b.dataset.mode);
      });
    });

    // Demonstrate the reversal on its own until someone takes over.
    if (!reduced) {
      var m = 'heat';
      cycle = setInterval(function () {
        m = m === 'heat' ? 'cool' : 'heat';
        setMode(m);
      }, 7000);
    }
  }

  /* --------------------------------------------------------------- episodes */
  var elLatest = $('#epLatest');
  var elList = $('#epList');
  var elStatus = $('#epStatus');

  var audio = new Audio();
  audio.preload = 'none';
  var playingId = null;

  var scrub = document.createElement('div');
  scrub.className = 'scrub';
  scrub.hidden = true;
  scrub.innerHTML =
    '<span class="scrub-t" data-now>0:00</span>' +
    '<div class="scrub-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
    '<div class="scrub-fill"></div></div>' +
    '<span class="scrub-t" data-dur>0:00</span>';
  var fill = $('.scrub-fill', scrub);
  var bar = $('.scrub-bar', scrub);
  var tNow = $('[data-now]', scrub);
  var tDur = scrub.querySelectorAll('.scrub-t')[1];

  function clock(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function humanDur(hhmmss) {
    if (!hhmmss) return '';
    var p = String(hhmmss).split(':').map(Number);
    var s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
    if (!s) return '';
    var mins = Math.round(s / 60);
    if (mins >= 60) return Math.floor(mins / 60) + ' hr ' + (mins % 60) + ' min';
    return mins + ' min';
  }

  function humanDate(str) {
    var d = new Date(str);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Titles arrive as "7 - California Legislation ..."; split the number out so it
  // can be set as its own column.
  function splitNum(title) {
    var m = /^\s*(\d+)\s*[-–—]\s*(.+)$/.exec(title || '');
    return m ? { n: m[1], t: m[2] } : { n: null, t: title || '' };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var icons = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
  };

  function renderLatest(ep, i) {
    var s = splitNum(ep.title);
    elLatest.innerHTML =
      '<article class="ep-latest" data-ep="' + i + '">' +
        (ep.img ? '<img class="ep-art" src="' + esc(ep.img) + '" alt="" loading="lazy" width="260" height="260">' : '<div class="ep-art"></div>') +
        '<div class="ep-latest-body">' +
          '<div class="ep-tag">' +
            '<span class="ep-badge">Latest' + (s.n ? ' · Episode ' + esc(s.n) : '') + '</span>' +
            '<span class="ep-meta">' + esc(humanDate(ep.date)) + (ep.dur ? ' · ' + esc(humanDur(ep.dur)) : '') + '</span>' +
          '</div>' +
          '<h3>' + esc(s.t) + '</h3>' +
          (ep.desc ? '<p class="ep-desc">' + esc(ep.desc) + '</p>' : '') +
          '<div class="ep-actions">' +
            '<button class="ep-play" type="button" data-play="' + i + '">' + icons.play + '<span data-label>Play episode</span></button>' +
            (ep.link ? '<a class="ep-out" href="' + esc(ep.link) + '" target="_blank" rel="noopener">Open in Spotify →</a>' : '') +
          '</div>' +
          '<div data-slot></div>' +
        '</div>' +
      '</article>';
  }

  function renderList(eps) {
    elList.innerHTML = eps.map(function (ep, k) {
      var i = k + 1; // index into the full array
      var s = splitNum(ep.title);
      var when = humanDate(ep.date);
      var dur = ep.dur ? humanDur(ep.dur) : '';
      return '<li class="ep-row" data-ep="' + i + '">' +
        '<span class="ep-num">' + (s.n ? esc(s.n) : '') + '</span>' +
        '<div class="ep-main">' +
          '<p class="ep-title">' + esc(s.t) + '</p>' +
          '<p class="ep-sub">' + esc(when) + (dur ? ' · ' + esc(dur) : '') + '</p>' +
          '<div data-slot></div>' +
        '</div>' +
        '<span class="ep-when">' + esc(when) + '</span>' +
        '<span class="ep-dur">' + esc(dur) + '</span>' +
        '<button class="ep-btn" type="button" data-play="' + i + '" aria-label="Play ' + esc(s.t) + '">' + icons.play + '</button>' +
      '</li>';
    }).join('');
  }

  var episodes = [];

  function render(eps) {
    episodes = eps || [];
    if (!episodes.length) {
      elLatest.innerHTML = '';
      elList.innerHTML = '<li class="ep-empty">Episodes are on their way. Subscribe in Spotify to hear the first one.</li>';
      return;
    }
    renderLatest(episodes[0], 0);
    renderList(episodes.slice(1, 1 + SHOW_IN_LIST));
    syncPlayingUI();
  }

  function itemFor(i) { return document.querySelector('[data-ep="' + i + '"]'); }

  function syncPlayingUI() {
    $$('[data-play]').forEach(function (b) {
      var on = String(playingId) === b.dataset.play && !audio.paused;
      b.innerHTML = (on ? icons.pause : icons.play) + (b.classList.contains('ep-play')
        ? '<span data-label>' + (on ? 'Pause episode' : 'Play episode') + '</span>' : '');
      if (!b.classList.contains('ep-play')) {
        b.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' episode');
      }
    });
    $$('.ep-row').forEach(function (r) {
      r.classList.toggle('is-playing', String(playingId) === r.dataset.ep && !audio.paused);
    });
    var host = playingId != null ? itemFor(playingId) : null;
    if (host) {
      var slot = $('[data-slot]', host);
      if (slot && scrub.parentNode !== slot) slot.appendChild(scrub);
      scrub.hidden = false;
    } else {
      scrub.hidden = true;
    }
  }

  function play(i) {
    var ep = episodes[i];
    if (!ep || !ep.audio) return;
    if (String(playingId) === String(i)) {
      if (audio.paused) { audio.play().catch(noop); } else { audio.pause(); }
      syncPlayingUI();
      return;
    }
    playingId = i;
    audio.src = ep.audio;
    audio.play().catch(noop);
    if (tDur) tDur.textContent = '0:00';
    fill.style.width = '0%';
    syncPlayingUI();
  }

  function noop() {}

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-play]');
    if (btn) { e.preventDefault(); play(Number(btn.dataset.play)); return; }
    var latest = e.target.closest && e.target.closest('[data-play-latest]');
    if (latest) {
      var sec = $('#episodes');
      if (sec) sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      play(0);
    }
  });

  audio.addEventListener('play', syncPlayingUI);
  audio.addEventListener('pause', syncPlayingUI);
  audio.addEventListener('ended', function () { playingId = null; syncPlayingUI(); });
  audio.addEventListener('loadedmetadata', function () {
    if (tDur) tDur.textContent = clock(audio.duration);
  });
  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = pct + '%';
    tNow.textContent = clock(audio.currentTime);
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  function seekFromEvent(e) {
    var r = bar.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    if (audio.duration) audio.currentTime = Math.max(0, Math.min(1, x)) * audio.duration;
  }
  bar.addEventListener('click', seekFromEvent);
  bar.addEventListener('keydown', function (e) {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 15); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 15); e.preventDefault(); }
  });

  /* ------------------------------------------------------- live feed refresh */
  function parseFeed(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Malformed feed');
    var showArt = '';
    var chImg = doc.querySelector('channel > image > url');
    if (chImg) showArt = chImg.textContent.trim();

    var tag = function (el, name) {
      var n = el.getElementsByTagName(name)[0];
      return n ? n.textContent.trim() : '';
    };

    return Array.prototype.map.call(doc.getElementsByTagName('item'), function (it) {
      var enc = it.getElementsByTagName('enclosure')[0];
      var img = it.getElementsByTagName('itunes:image')[0];
      var raw = tag(it, 'description');
      var txt = raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        title: tag(it, 'title'),
        date: tag(it, 'pubDate'),
        dur: tag(it, 'itunes:duration'),
        link: tag(it, 'link'),
        audio: enc ? enc.getAttribute('url') : '',
        img: (img && img.getAttribute('href')) || showArt,
        desc: txt.slice(0, 400)
      };
    });
  }

  render(window.__EPS__ || []);

  fetch(FEED, { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('Feed responded ' + r.status);
      return r.text();
    })
    .then(function (text) {
      var live = parseFeed(text);
      if (!live.length) return;
      var wasPlaying = playingId != null ? episodes[playingId] : null;
      render(live);
      // keep the transport attached to the same episode after a re-render
      if (wasPlaying) {
        var again = live.findIndex(function (e) { return e.audio === wasPlaying.audio; });
        playingId = again >= 0 ? again : null;
        syncPlayingUI();
      }
      if (elStatus) elStatus.textContent = 'Synced from the podcast feed';
    })
    .catch(function () {
      // The baked episodes are already on screen; just say the list may lag.
      if (elStatus) {
        elStatus.textContent = 'Showing saved episodes';
        elStatus.title = 'Could not reach the podcast feed just now.';
      }
    });

  /* -------------------------------------------------------------- state map */
  var map = $('.usmap');
  if (map) {
    // The callout column is hidden on small screens, so reclaim its width.
    var narrow = window.matchMedia('(max-width: 779px)');
    var fitBox = function () {
      map.setAttribute('viewBox', narrow.matches ? '0 0 975 620' : '0 0 1124 620');
    };
    fitBox();
    if (narrow.addEventListener) narrow.addEventListener('change', fitBox);

    var hot = [];
    var clearHot = function () {
      hot.forEach(function (n) { n.classList.remove('is-hot'); });
      hot = [];
    };
    var lightUp = function (abbr) {
      clearHot();
      if (!abbr) return;
      hot = $$('[data-st="' + abbr + '"]', map);
      hot.forEach(function (n) { n.classList.add('is-hot'); });
    };
    var abbrOf = function (t) {
      var n = t && t.closest ? t.closest('[data-st]') : null;
      return n ? n.getAttribute('data-st') : null;
    };
    map.addEventListener('mouseover', function (e) { lightUp(abbrOf(e.target)); });
    map.addEventListener('mouseleave', clearHot);
    map.addEventListener('focusin', function (e) { lightUp(abbrOf(e.target)); });
    map.addEventListener('focusout', clearHot);
  }

  var yr = $('#yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
