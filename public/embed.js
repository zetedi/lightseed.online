/**
 * lifeseed widget embed script
 * Usage: <script src="https://lifeseed.online/embed.js" async></script>
 */
(function () {
  'use strict';

  var ORIGIN = 'https://lifeseed.online';
  var domain = window.location.hostname;

  /* ── Floating button ── */
  var btn = document.createElement('button');
  btn.id = 'lifeseed-btn';
  btn.title = 'Trees growing here · lifeseed.online';
  btn.setAttribute('aria-label', 'Open lifeseed tree widget');
  btn.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px',
    'width:52px', 'height:52px', 'border-radius:50%',
    'background:#ffffff', 'border:2px solid #334155',
    'cursor:pointer', 'z-index:2147483646',
    'box-shadow:0 4px 14px rgba(0,0,0,0.18)',
    'padding:6px', 'box-sizing:border-box',
    'display:flex', 'align-items:center', 'justify-content:center',
    'transition:transform 0.15s ease,box-shadow 0.15s ease',
    'outline:none'
  ].join(';');
  btn.innerHTML = '<img src="' + ORIGIN + '/favicon.svg" width="36" height="36" alt="" style="display:block;border-radius:50%;"/>';
  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.08)';
    btn.style.boxShadow = '0 6px 22px rgba(0,0,0,0.24)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)';
  });

  /* ── Overlay backdrop ── */
  var overlay = document.createElement('div');
  overlay.id = 'lifeseed-overlay';
  overlay.style.cssText = [
    'display:none', 'position:fixed', 'inset:0',
    'background:rgba(0,0,0,0.35)',
    'z-index:2147483647',
    'align-items:flex-end', 'justify-content:flex-end'
  ].join(';');

  /* ── Panel ── */
  var panel = document.createElement('div');
  panel.style.cssText = [
    'width:360px', 'max-width:100vw',
    'height:520px', 'max-height:85vh',
    'border-radius:16px 16px 0 0',
    'overflow:hidden',
    'box-shadow:0 -4px 30px rgba(0,0,0,0.15)'
  ].join(';');

  /* ── iframe ── */
  var iframe = document.createElement('iframe');
  iframe.id = 'lifeseed-iframe';
  iframe.src = ORIGIN + '/?widget=true&domain=' + encodeURIComponent(domain);
  iframe.title = 'Trees at ' + domain + ' · lifeseed';
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';

  panel.appendChild(iframe);
  overlay.appendChild(panel);

  /* ── Open / Close ── */
  function openWidget() {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeWidget() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openWidget);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeWidget();
  });
  window.addEventListener('message', function (e) {
    if (e.origin === ORIGIN && e.data === 'lifeseed-close') closeWidget();
  });

  /* ── Inject ── */
  function inject() {
    document.body.appendChild(overlay);
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
}());
