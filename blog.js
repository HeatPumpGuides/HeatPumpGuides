/* Heat Pump Guides — blog post
   - one audio element behind the main player, the mini player and the transcript
   - the mini player docks at the bottom once the episode is playing and the
     main player has scrolled out of view, so you can read and listen at once
   - transcript timestamps seek and play
*/
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var yr = $('#yr');
  if (yr) yr.textContent = String(new Date().getFullYear());

  var player = $('.player');
  if (!player) return;

  var audio = new Audio();
  audio.preload = 'none';
  audio.src = player.getAttribute('data-audio');

  var mini = $('.mini');
  var bar = $('.scrub-bar', player);
  var fills = $$('.scrub-fill');
  var nows = $$('[data-now]');
  var dur = $('[data-dur]', player);
  var rateBtn = $('[data-rate]', player);
  var RATES = [1, 1.25, 1.5, 2];
  var started = false;
  var playerVisible = true;

  var icons = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
  };

  function clock(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function sync() {
    var on = !audio.paused;
    $$('[data-toggle]').forEach(function (b) {
      var label = $('[data-label]', b);
      b.innerHTML = (on ? icons.pause : icons.play) + (label ? '<span data-label>' + (on ? 'Pause episode' : (started ? 'Resume episode' : 'Play episode')) + '</span>' : '');
      if (!label) b.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' episode');
    });
    player.classList.toggle('is-playing', on);
    if (mini) mini.hidden = !(started && !playerVisible);
  }

  function toggle() {
    if (audio.paused) { started = true; audio.play().catch(function () {}); }
    else audio.pause();
  }

  function seekTo(t, andPlay) {
    started = true;
    var go = function () { audio.currentTime = t; if (andPlay) audio.play().catch(function () {}); };
    if (audio.readyState >= 1) go();
    else { audio.addEventListener('loadedmetadata', go, { once: true }); audio.load(); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest('[data-toggle]')) { e.preventDefault(); toggle(); return; }
    var ts = t.closest('.ts');
    if (ts) { e.preventDefault(); seekTo(Number(ts.getAttribute('data-t')), true); return; }
    if (t.closest('[data-rate]')) {
      var i = (RATES.indexOf(audio.playbackRate) + 1) % RATES.length;
      audio.playbackRate = RATES[i];
      rateBtn.textContent = RATES[i] + '×';
    }
  });

  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', function () { started = false; sync(); });
  audio.addEventListener('loadedmetadata', function () { if (dur) dur.textContent = clock(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    fills.forEach(function (f) { f.style.width = pct + '%'; });
    nows.forEach(function (n) { n.textContent = clock(audio.currentTime); });
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  function seekFromEvent(e) {
    var r = bar.getBoundingClientRect();
    var x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (audio.duration) seekTo(x * audio.duration, false);
    else seekTo(0, false); // first interaction loads the file; the next click lands
  }
  bar.addEventListener('click', seekFromEvent);
  bar.addEventListener('keydown', function (e) {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 15); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 15); e.preventDefault(); }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      playerVisible = entries[0].isIntersecting;
      sync();
    }, { rootMargin: '-76px 0px 0px 0px' }).observe(player);
  }

  // Opening the transcript from the contents list or a #transcript link.
  function openTranscript() {
    var d = $('#transcript');
    if (d && location.hash === '#transcript') d.open = true;
  }
  window.addEventListener('hashchange', openTranscript);
  openTranscript();
})();
