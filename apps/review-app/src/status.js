// What the app is doing, or why it cannot open the review yet.
(() => {
  const params = new URLSearchParams(location.search);
  const state = params.get('state') ?? 'starting';
  document.body.dataset.state = state;
  document.getElementById('message').textContent = params.get('message')
    || (state === 'choose' ? 'Choose the review data folder to begin: the one the developer set up, with a folder called data inside it.' : '');
  const detail = params.get('detail');
  if (detail) { const pre = document.getElementById('detail'); pre.textContent = detail; pre.hidden = false; }
  if (state !== 'starting') document.getElementById('actions').hidden = false;
  document.getElementById('retry').hidden = state === 'choose';
  document.getElementById('choose').addEventListener('click', () => window.cihofReview.chooseFolder());
  document.getElementById('retry').addEventListener('click', () => window.cihofReview.retry());
})();
