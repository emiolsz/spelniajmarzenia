if (document.querySelector("#donate")) {
const amount = document.querySelector('#amount');
const purpose = document.querySelector('#purpose');
const impact = document.querySelector('#impact');
const donate = document.querySelector('#donate');
const result = document.querySelector('#result');
const presets = document.querySelectorAll('[data-amount]');
const rates = { 'Działalność stowarzyszenia': [25, 'materiały do działań lokalnych'], 'Edukacja i bezpieczeństwo': [50, 'materiały edukacyjne'], 'Kultura i młode talenty': [50, 'materiały do zajęć'] };
function refresh() {
  const [rate, unit] = rates[purpose.value];
  const count = Math.floor(Number(amount.value) / rate);
  impact.textContent = count > 0 ? 'Przykładowy przelicznik: ' + count + ' × jednostka wsparcia (' + unit + ').' : 'Przykładowy koszt jednej jednostki wsparcia: ' + rate + ' zł.';
  presets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.amount === amount.value)));
  result.textContent = '';
}
presets.forEach(button => button.addEventListener('click', () => { amount.value = button.dataset.amount; refresh(); }));
document.querySelectorAll('[data-program]').forEach(link => link.addEventListener('click', () => { purpose.value = link.dataset.program; refresh(); }));
donate.addEventListener('input', refresh);
donate.addEventListener('submit', event => {
  event.preventDefault();
  const frequency = new FormData(donate).get('freq');
  result.textContent = 'Symulacja: ' + amount.value + ' zł, ' + frequency + '. Cel: ' + purpose.value + '. Metoda: ' + document.querySelector('#method').value + '. Nie pobrano środków.';
});
refresh();
}
const topic = document.querySelector('#topic');
document.querySelector('#partner')?.addEventListener('click', () => { topic.value = 'Współpraca dla firm'; });
document.querySelector('#help')?.addEventListener('click', () => { topic.value = 'Szukam pomocy'; });
document.querySelector('#contact')?.addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#contact-result').textContent = 'Formularz testowy jest poprawny. Wiadomość nie została wysłana.';
});

document.querySelector('#business-form')?.addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#business-result').textContent = 'Formularz testowy jest poprawny. Wiadomość nie została wysłana.';
});

const recurring = document.querySelector('#donate input[value="co miesiąc"]');
function applyDonationLink() {
  const frequency = { '#regularnie': 'co miesiąc', '#jednorazowo': 'jednorazowo' }[location.hash];
  if (!frequency) return;
  const option = document.querySelector('#donate input[value="' + frequency + '"]');
  if (option) {
    option.checked = true;
    option.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
if (recurring) {
  applyDonationLink();
  window.addEventListener('hashchange', applyDonationLink);
}

const actionForm = document.querySelector('#action-form');
const adminLogin = document.querySelector('#admin-login');
const logout = document.querySelector('#admin-logout');
async function adminRequest(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Nie udało się wykonać operacji.');
  return result;
}
function adminPost(path, data) {
  return adminRequest(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
function showSession(authorized) {
  adminLogin.hidden = authorized;
  actionForm.hidden = !authorized;
  logout.hidden = !authorized;
}
if (adminLogin) {
  const output = document.querySelector('#login-result');
  const email = adminLogin.elements.email;
  adminRequest('/api/admin/sesja').then(s => showSession(s.authorized)).catch(e => {output.textContent=e.message;});
  document.querySelector('#send-code').addEventListener('click', async event => {
    if (!email.reportValidity()) return;
    const button = event.currentTarget;
    button.disabled = true;
    try { await adminPost('/api/admin/kod',{email:email.value}); output.textContent='Kod został wysłany.'; }
    catch(e) {output.textContent=e.message;}
    finally {button.disabled=false;}
  });
  adminLogin.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await adminPost('/api/admin/logowanie',{email:email.value,token:adminLogin.elements.token.value});
      adminLogin.reset();
      output.textContent='';
      showSession(true);
    } catch(e) {output.textContent=e.message;}
  });
  logout.addEventListener('click', async () => {
    try {await adminPost('/api/admin/wyloguj',{}); showSession(false);}
    catch(e) {document.querySelector('#admin-result').textContent=e.message;}
  });
}
actionForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const output = document.querySelector('#admin-result');
  const button = actionForm.querySelector('button');
  const form = new FormData(actionForm);
  const files = form.getAll('photos').filter(file=>file.size);
  const captions = String(form.get('captions') || '').trim().split(/\r?\n/).map(line=>line.trim());
  if (files.length>10 || files.some(file=>file.size>2097152) || (files.length && (captions.length!==files.length || captions.some(line=>!line || line.length>250)))) {
    output.textContent='Dodaj do 10 zdjęć po maksymalnie 2 MB i po jednym krótkim opisie każdego zdjęcia.';
    return;
  }
  button.disabled = true;
  try {
    const photos=[];
    for (const [index,file] of files.entries()) {
      output.textContent='Przesyłanie zdjęcia '+(index+1)+' z '+files.length+'…';
      const uploaded=await adminRequest('/api/admin/zdjecie',{method:'POST',headers:{'Content-Type':file.type},body:file});
      photos.push({path:uploaded.path,alt:captions[index]});
    }
    await adminPost('/api/dzialania',{title:form.get('title'),date:form.get('date'),body:form.get('body'),photos});
    actionForm.reset();
    output.textContent='Działanie zostało opublikowane.';
  } catch (error) {output.textContent=error.message;}
  finally {button.disabled=false;}
});

async function loadActions() {
  const status = document.querySelector('#actions-status');
  if (!status) return;
  try {
    const list = await fetch('/api/dzialania');
    if (!list.ok) throw new Error();
    const entries = await list.json();
    if (!entries.length) return;
    const dated = [...document.querySelectorAll('[data-date]')];
    for (const entry of entries) {
      const url = '/api/dzialania/' + entry.id;
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const article = document.createElement('article');
      article.className = 'news-article';
      article.dataset.date = data.date;
      const row = document.createElement('div');
      row.className = data.photos.length ? 'news-row' : 'news-row no-photo';
      const copy = document.createElement('div');
      const time = document.createElement('time');
      time.dateTime = data.date;
      time.textContent = new Intl.DateTimeFormat('pl', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(data.date));
      const title = document.createElement('h2');
      title.textContent = data.title;
      const intro = document.createElement('p');
      const text = data.body.trim();
      let cut = text.length;
      if (cut > 220) {
        cut = text.lastIndexOf(' ', 220);
        if (cut < 100) cut = 220;
      }
      intro.textContent = text.slice(0, cut) + (cut < text.length ? '…' : '');
      copy.append(time, title, intro);
      function photoAt(photo, index) {
        const link = document.createElement('a');
        link.href = photo.src || url + '/' + index;
        const image = document.createElement('img');
        image.src = link.href;
        image.alt = photo.alt;
        image.loading = 'lazy';
        link.append(image);
        return link;
      }
      if (data.photos.length) row.append(photoAt(data.photos[0], 0));
      if (cut < text.length || data.photos.length > 1) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Czytaj więcej';
        details.append(summary);
        if (cut < text.length) {
          const body = document.createElement('p');
          body.className = 'action-body';
          body.textContent = text;
          details.append(body);
        }
        if (data.photos.length > 1) {
          const gallery = document.createElement('div');
          gallery.className = 'action-photos';
          data.photos.slice(1).forEach((photo, index) => gallery.append(photoAt(photo, index + 1)));
          details.append(gallery);
        }
        copy.append(details);
      }
      row.append(copy);
      article.append(row);
      dated.push(article);
    }
    dated.sort((a, b) => b.dataset.date.localeCompare(a.dataset.date));
    for (const article of dated) {
      status.before(article);
    }
  } catch {
    status.textContent = 'Nie udało się wczytać nowych działań. Odśwież stronę, aby spróbować ponownie.';
  }
}
loadActions();

document.querySelectorAll('[data-stardust], [data-heart-dust]').forEach(trigger => trigger.addEventListener('click', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  event.preventDefault();
  const link = event.currentTarget;
  if (document.querySelector('.stardust')) return;
  const box = link.getBoundingClientRect();
  const dust = document.createElement('div');
  dust.className = 'stardust';
  dust.setAttribute('aria-hidden', 'true');
  dust.style.setProperty('--x', box.left + box.width / 2 + 'px');
  dust.style.setProperty('--y', box.top + box.height / 2 + 'px');
  const heart = link.hasAttribute('data-heart-dust');
  if (heart) {
    dust.classList.add('stardust-heart');
    dust.style.setProperty('--y', Math.max(98, box.top - 24) + 'px');
  }
  const colors = ['#ffe89d', '#fff', '#a1d5ff', '#debaff'];
  for (let index = 0; index < 160; index++) {
    const spark = document.createElement('i');
    const angle = index * Math.PI * 2 / 160;
    const distance = 30 + Math.random() * 100;
    spark.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
    spark.style.setProperty('--color', colors[index % colors.length]);
    if (heart) {
      const x = 16 * Math.sin(angle) ** 3;
      const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
      spark.style.setProperty('--dx', x * 5 + 'px');
      spark.style.setProperty('--dy', -y * 5 + 'px');
      spark.style.setProperty('--fall', 85 + Math.random() * 55 + 'px');
    }
    dust.append(spark);
  }
  document.body.append(dust);
  window.setTimeout(() => { dust.remove(); location.assign(link.href); }, 2400);
}));
