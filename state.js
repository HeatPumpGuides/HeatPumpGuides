/* Heat Pump Guides — state page
   Pulls the live feed and shows only the episodes tagged to this state in
   states.data.json. With none tagged yet, it renders placeholder slots so the
   page still reads as finished.
*/
(function () {
  'use strict';

  var FEED = 'https://anchor.fm/s/f8c1cc3c/podcast/rss';
  var PLACEHOLDERS = 3;

  var host = document.getElementById('stEpisodes');
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
  if (!host) return;

  var match = [];
  try { match = JSON.parse(host.getAttribute('data-match') || '[]'); } catch (e) { match = []; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function splitNum(t) {
    var m = /^\s*(\d+)\s*[-–—]\s*(.+)$/.exec(t || '');
    return m ? { n: m[1], t: m[2] } : { n: null, t: t || '' };
  }
  function humanDate(str) {
    var d = new Date(str);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function humanDur(v) {
    if (!v) return '';
    var p = String(v).split(':').map(Number);
    var s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
    if (!s) return '';
    var m = Math.round(s / 60);
    return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : m + ' min';
  }

  function slots(n) {
    var out = '<p class="ep-hint">No episodes from here yet. When we record one, it lands in these slots.</p><ul class="ep-slots">';
    for (var i = 0; i < n; i++) {
      out += '<li class="ep-slot">'
        + '<span class="ep-slot-n">' + (i + 1) + '</span>'
        + '<span class="ep-slot-bar"></span>'
        + '<span class="ep-slot-t">Episode slot</span>'
        + '</li>';
    }
    return out + '</ul>';
  }

  function cards(list) {
    return '<ul class="ep-list ep-list--state">' + list.map(function (ep) {
      var s = splitNum(ep.title);
      return '<li class="ep-row">'
        + '<span class="ep-num">' + (s.n ? esc(s.n) : '') + '</span>'
        + '<div class="ep-main">'
        + '<p class="ep-title"><a href="' + esc(ep.link) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></p>'
        + '<p class="ep-sub">' + esc(humanDate(ep.date)) + (ep.dur ? ' · ' + esc(humanDur(ep.dur)) : '') + '</p>'
        + '</div>'
        + '<span class="ep-when">' + esc(humanDate(ep.date)) + '</span>'
        + '<span class="ep-dur">' + esc(humanDur(ep.dur)) + '</span>'
        + '<a class="ep-btn" href="' + esc(ep.link) + '" target="_blank" rel="noopener" aria-label="Listen to ' + esc(s.t) + '">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></a>'
        + '</li>';
    }).join('') + '</ul>';
  }

  // Nothing tagged: don't even hit the network.
  if (!match.length) { host.innerHTML = slots(PLACEHOLDERS); return; }

  host.innerHTML = '<p class="ep-hint">Loading episodes…</p>';

  fetch(FEED, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('bad feed');
      var tag = function (el, n) { var x = el.getElementsByTagName(n)[0]; return x ? x.textContent.trim() : ''; };

      var all = Array.prototype.map.call(doc.getElementsByTagName('item'), function (it) {
        return {
          title: tag(it, 'title'),
          date: tag(it, 'pubDate'),
          dur: tag(it, 'itunes:duration'),
          link: tag(it, 'link'),
          guid: tag(it, 'guid')
        };
      });

      var needles = match.map(function (m) { return String(m).toLowerCase(); });
      var hits = all.filter(function (ep) {
        var hay = (ep.guid + ' ' + ep.title).toLowerCase();
        return needles.some(function (n) { return hay.indexOf(n) !== -1; });
      });

      host.innerHTML = hits.length ? cards(hits) : slots(PLACEHOLDERS);
    })
    .catch(function () {
      host.innerHTML = '<p class="ep-hint">Couldn\'t reach the podcast feed. '
        + '<a href="https://open.spotify.com/show/3lVeTOxvayjJ8xgR7nVGGZ" target="_blank" rel="noopener">Listen on Spotify</a> instead.</p>';
    });
})();
