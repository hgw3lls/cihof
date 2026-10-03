// What the app is doing, or why it cannot open the review yet.
(() => {
  const params = new URLSearchParams(location.search);
  const state = params.get('state') ?? 'starting';
  document.body.dataset.state = state;
  document.getElementById('message').textContent = params.get('message')
    || (state === 'choose' ? 'To work on what a display shows, open the content exported from it. To review records the developer set up, choose the review data folder.' : '');
  const detail = params.get('detail');
  if (detail) { const pre = document.getElementById('detail'); pre.textContent = detail; pre.hidden = false; }
  if (state !== 'starting') document.getElementById('actions').hidden = false;
  document.getElementById('retry').hidden = state === 'choose';
  document.getElementById('open').addEventListener('click', () => window.cihofReview.openContent());
  document.getElementById('choose').addEventListener('click', () => window.cihofReview.chooseFolder());
  document.getElementById('retry').addEventListener('click', () => window.cihofReview.retry());
})();
