// What the app is doing, or why it cannot open the review yet.
(() => {
  const params = new URLSearchParams(location.search);
  const state = params.get('state') ?? 'starting';
  document.body.dataset.state = state;
  document.getElementById('message').textContent = params.get('message')
    || (state === 'choose' ? 'To work on what a display shows, connect to it, or open the content exported from it. To review records the developer set up, choose the review data folder.' : '');
  const detail = params.get('detail');
  if (detail) { const pre = document.getElementById('detail'); pre.textContent = detail; pre.hidden = false; }
  if (state !== 'starting') document.getElementById('actions').hidden = false;
  document.getElementById('retry').hidden = state === 'choose';
  document.getElementById('open').addEventListener('click', () => window.cihofReview.openContent());
  const form = document.getElementById('connect');
  if (state === 'connect') { form.hidden = false; document.getElementById('address').focus(); }
  document.getElementById('connectButton').hidden = state === 'connect';
  document.getElementById('connectButton').addEventListener('click', () => { form.hidden = false; document.getElementById('address').focus(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.cihofReview.connectDisplay(document.getElementById('address').value, document.getElementById('code').value);
  });
  document.getElementById('choose').addEventListener('click', () => window.cihofReview.chooseFolder());
  document.getElementById('retry').addEventListener('click', () => window.cihofReview.retry());
})();
