/* clock.js — keeps the clock displays updated */

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

function tick() {
  const now  = new Date();
  const h24  = now.getHours();
  const h12  = h24 % 12 || 12;
  const m    = pad(now.getMinutes());
  const s    = pad(now.getSeconds());
  const ampm = h24 < 12 ? 'AM' : 'PM';

  document.getElementById('time-display').textContent = `${h12}:${m}:${s} ${ampm}`;
  document.getElementById('date-display').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  const cv = document.getElementById('compact-time');
  if (cv) cv.textContent = `${h12}:${m} ${ampm}`;
}

tick();
setInterval(tick, 1000);
