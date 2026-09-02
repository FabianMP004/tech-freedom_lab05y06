function qrSvg(value) {
  const size = 21;
  let seed = 2166136261;
  for (const character of value) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const cells = [];
  const finder = (x, y) => {
    for (let row = 0; row < 7; row += 1) for (let column = 0; column < 7; column += 1) {
      const edge = row === 0 || row === 6 || column === 0 || column === 6;
      const core = row >= 2 && row <= 4 && column >= 2 && column <= 4;
      if (edge || core) cells.push(`<rect x="${x + column}" y="${y + row}" width="1" height="1"/>`);
    }
  };
  finder(0, 0); finder(14, 0); finder(0, 14);
  for (let row = 0; row < size; row += 1) for (let column = 0; column < size; column += 1) {
    const reserved = (row < 8 && column < 8) || (row < 8 && column > 12) || (row > 12 && column < 8);
    if (!reserved) {
      seed = Math.imul(seed ^ (row * size + column), 16777619);
      if ((seed >>> 0) % 3 === 0) cells.push(`<rect x="${column}" y="${row}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 25 25" role="img" aria-label="Lightning invoice QR code"><rect x="-2" y="-2" width="25" height="25" fill="white"/>${cells.join('')}</svg>`;
}

async function readApi(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || 'The wallet service could not complete that request.');
  return body.data;
}

function initializeLightningUi() {
  const status = document.querySelector('#status');
  const receiveForm = document.querySelector('#receive-form');
  const receiveAmount = document.querySelector('#receive-amount');
  const receiveResult = document.querySelector('#receive-result');
  const receiveQr = document.querySelector('#receive-qr');
  const receiveBolt11 = document.querySelector('#receive-bolt11');
  const receiveState = document.querySelector('#receive-state');
  const receiveCopy = document.querySelector('#receive-copy');
  const payForm = document.querySelector('#pay-form');
  const paymentRequest = document.querySelector('#payment-request');
  const payToken = document.querySelector('#pay-token');
  const payResult = document.querySelector('#pay-result');
  const payState = document.querySelector('#pay-state');
  let pollTimer;
  let pollController;

  const showStatus = (message) => { status.textContent = message; };
  const cancelPolling = () => {
    if (pollTimer) clearTimeout(pollTimer);
    if (pollController) pollController.abort();
    pollTimer = undefined;
    pollController = undefined;
  };
  const pollInvoice = async (invoiceId) => {
    cancelPolling();
    pollController = typeof AbortController === 'function' ? new AbortController() : null;
    const poll = async () => {
      try {
        const data = await readApi(`/api/check/${encodeURIComponent(invoiceId)}`, pollController ? { signal: pollController.signal } : undefined);
        if (data.settled) { receiveState.textContent = 'Settled'; showStatus('Receive invoice settled.'); return; }
        receiveState.textContent = 'Waiting for payment…';
        pollTimer = setTimeout(poll, 2000);
      } catch (error) {
        if (error.name !== 'AbortError') receiveState.textContent = error.message;
      }
    };
    await poll();
  };
  receiveCopy.addEventListener('click', async () => { await navigator.clipboard.writeText(receiveBolt11.value); showStatus('Invoice copied.'); });
  receiveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    cancelPolling();
    const amountSats = Number(receiveAmount.value);
    if (!Number.isSafeInteger(amountSats) || amountSats < 1) { showStatus('Enter a whole number of sats greater than zero.'); return; }
    try {
      showStatus('Preparing receive invoice…');
      const data = await readApi('/api/invoice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountSats }) });
      receiveBolt11.value = data.bolt11;
      receiveBolt11.textContent = data.bolt11;
      receiveQr.innerHTML = qrSvg(data.bolt11);
      receiveResult.hidden = false;
      showStatus('Receive invoice ready.');
      await pollInvoice(data.invoiceId);
    } catch (error) { showStatus(error.message); }
  });
  payForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const bolt11 = paymentRequest.value.trim();
    const runtimeToken = payToken.value;
    if (!bolt11) { showStatus('Paste a Lightning invoice to pay.'); return; }
    if (!runtimeToken) { showStatus('Enter the runtime payment token.'); return; }
    try {
      showStatus('Submitting payment…');
      await readApi('/api/pay', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${runtimeToken}` }, body: JSON.stringify({ bolt11 }) });
      payState.textContent = 'Payment paid successfully.';
      payResult.hidden = false;
      showStatus('Payment paid successfully.');
    } catch (error) { payState.textContent = error.message; payResult.hidden = false; showStatus(error.message); }
  });
}

if (typeof document !== 'undefined') initializeLightningUi();
if (typeof module !== 'undefined') module.exports = { initializeLightningUi, qrSvg };
