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
  document.querySelector("#article-manager").hidden = !authorized;
  if (authorized) document.dispatchEvent(new Event("admin-ready"));
  else document.querySelector("#article-list").replaceChildren();
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
if (actionForm) {
  const photoFields = document.querySelector('#photo-fields');
  const photoList = document.querySelector('#photo-list');
  const addPhoto = document.querySelector('#add-photo');
  const preview = document.querySelector('#action-preview');
  const previewContent = document.querySelector('#action-preview-content');
  const output = document.querySelector('#admin-result');
  const publish = actionForm.querySelector('button[type="submit"]');
  const photos = [];
  let editing = null, busy = false, baseline = '';
  const manager = document.querySelector('#article-manager');
  const listStatus = document.querySelector('#article-list-status');
  const list = document.querySelector('#article-list');
  const cancel = document.querySelector('#cancel-edit');
  const state = () => JSON.stringify([actionForm.elements.title.value, actionForm.elements.date.value, actionForm.elements.body.value, photos.filter(p=>p.src).map(p=>[p.src,p.caption.value])]);
  const canLeave = () => !busy && (state() === baseline || confirm('Masz niezapisane zmiany. Odrzucić je?'));
  function openEditor(article = null) {
    editing = article;
    actionForm.reset();
    photos.splice(0).forEach(p=>{if(p.src.startsWith('blob:')) URL.revokeObjectURL(p.src);});
    photoList.replaceChildren();
    for(const field of ['title','date','body']) actionForm.elements[field].value = article?.[field] || '';
    if(article?.photos.length) article.photos.forEach(photo=>addPhotoRow(photo));
    else addPhotoRow();
    document.querySelector('#editor-title').textContent=article ? 'Edytuj artykuł: '+article.title : 'Nowy artykuł';
    publish.textContent=article ? 'Zapisz zmiany' : 'Opublikuj działanie';
    cancel.hidden=!article;
    output.textContent='';
    baseline=state();
    renderPreview();
  }
  async function refreshArticles() {
    listStatus.textContent='Wczytywanie artykułów…';
    try {
      const articles=await adminRequest('/api/admin/artykuly');
      list.replaceChildren();
      for(const article of articles) {
        const row=document.createElement('div'); row.className='admin-article-row';
        const info=document.createElement('div');
        const title=document.createElement('strong'); title.textContent=article.title;
        const meta=document.createElement('p'); meta.textContent=(article.date || 'Bez pełnej daty')+' · Zdjęcia: '+article.photos.length;
        info.append(title,meta);
        const edit=document.createElement('button'); edit.type='button'; edit.className='btn'; edit.textContent='Edytuj';
        edit.addEventListener('click',()=>{if(canLeave()){openEditor(article); actionForm.scrollIntoView({behavior:'smooth',block:'start'}); actionForm.elements.title.focus({preventScroll:true});}});
        edit.hidden=Boolean(article.deleted);
        const remove=document.createElement('button'); remove.type='button'; remove.className='btn delete-article';
        remove.textContent=article.deleted ? 'Ponów usuwanie zdjęć' : 'Usuń wpis';
        remove.addEventListener('click',async()=>{
          if(!canLeave()) return;
          if(!article.deleted && !confirm('Usunąć wpis „'+article.title+'” razem z treścią i zdjęciami? Tej operacji nie można cofnąć.')) return;
          busy=true; manager.inert=true; actionForm.inert=true; logout.disabled=true;
          listStatus.textContent=article.deleted ? 'Usuwanie zdjęć…' : 'Usuwanie wpisu…';
          try {
            const result=await adminPost('/api/admin/usun',{id:article.id,revision:article.revision});
            if(editing?.id===article.id) openEditor();
            await refreshArticles();
            listStatus.textContent=result.cleanupPending ? 'Wpis został usunięty ze strony. Nie udało się jeszcze usunąć plików zdjęć — kliknij „Ponów usuwanie zdjęć”.' : 'Wpis został usunięty razem z treścią i zdjęciami. Możesz dodać nowy artykuł.';
          } catch(error) {listStatus.textContent=error.message;}
          finally {busy=false;manager.inert=false;actionForm.inert=false;logout.disabled=false;}
        });
        const buttons=document.createElement('div'); buttons.className='admin-article-buttons'; buttons.append(edit,remove);
        row.append(info,buttons); list.append(row);
      }
      listStatus.textContent='Liczba artykułów: '+articles.filter(a=>!a.deleted).length;
    } catch(error) {listStatus.textContent=error.message;}
  }
  document.addEventListener('admin-ready',refreshArticles);
  document.querySelector('#refresh-articles').addEventListener('click',()=>{if(!busy) refreshArticles();});
  document.querySelector('#new-article').addEventListener('click',()=>{if(canLeave()){openEditor();actionForm.scrollIntoView({behavior:'smooth'});}});
  cancel.addEventListener('click',()=>{if(canLeave()) openEditor();});
  window.addEventListener('beforeunload',event=>{if(state()!==baseline){event.preventDefault();event.returnValue='';}});


  function renderPreview() {
    if (!preview.open) return;
    const galleryOpen = previewContent.querySelector('details')?.open;
    const article = renderAction({
      title: actionForm.elements.title.value.trim() || 'Tytuł artykułu',
      date: actionForm.elements.date.validity.valid ? actionForm.elements.date.value : '',
      body: actionForm.elements.body.value || 'Opis zdarzenia',
      photos: photos.filter(photo => photo.src).map(photo => ({src: photo.src, alt: photo.caption.value}))
    });
    const gallery = article.querySelector('details');
    if (gallery && galleryOpen) gallery.open = true;
    previewContent.replaceChildren(article);
  }

  function updatePhotos() {
    photos.forEach((photo, index) => {
      const position = index + 1;
      photo.title.textContent = 'Zdjęcie ' + position + (position === 1 ? ' – główne' : '');
      photo.file.setAttribute('aria-label', 'Wybierz plik zdjęcia ' + position);
      photo.caption.setAttribute('aria-label', 'Opis zdjęcia ' + position + ' dla czytników ekranu');
      photo.cover.hidden = index === 0 || !photo.src || !photos[0].src;
    });
    addPhoto.disabled = photos.length >= 10 || photos.some(photo => !photo.src);
    renderPreview();
  }

  function addPhotoRow(existing = null) {
    const row = document.querySelector('#photo-template').content.firstElementChild.cloneNode(true);
    const photo = {
      row,
      title: row.querySelector('h3'),
      file: row.querySelector('input[type="file"]'),
      caption: row.querySelector('input[type="text"]'),
      thumbnail: row.querySelector('img'),
      cover: row.querySelector('[data-cover]'),
      src: existing?.src || '',
      uploadedPath: existing?.path || ''
    };
    if(existing) {
      photo.thumbnail.src=existing.src;
      photo.thumbnail.hidden=false;
      photo.caption.value=existing.alt;
      photo.caption.required=true;
    }
    photos.push(photo);
    photoList.append(row);
    photo.file.addEventListener('change', () => {
      if (photo.src.startsWith('blob:')) URL.revokeObjectURL(photo.src);
      const file = photo.file.files[0];
      photo.src = file ? URL.createObjectURL(file) : '';
      photo.uploadedPath = '';
      photo.thumbnail.hidden = !file;
      if (file) photo.thumbnail.src = photo.src;
      else photo.thumbnail.removeAttribute('src');
      photo.caption.required = Boolean(file);
      photo.file.setCustomValidity(file?.size > 2097152 ? 'To zdjęcie przekracza 2 MB.' :
        file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'Wybierz zdjęcie JPG, PNG lub WebP.' : '');
      updatePhotos();
      photo.file.reportValidity();
    });
    photo.cover.addEventListener('click', () => {
      photos.splice(photos.indexOf(photo), 1);
      photos.unshift(photo);
      photoList.prepend(row);
      updatePhotos();
      photo.file.focus();
    });
    row.querySelector('[data-remove]').addEventListener('click', () => {
      if (photo.src.startsWith('blob:')) URL.revokeObjectURL(photo.src);
      photos.splice(photos.indexOf(photo), 1);
      row.remove();
      if (photos.length === 0) addPhotoRow().focus();
      else {
        updatePhotos();
        photos[photos.length - 1].file.focus();
      }
    });
    updatePhotos();
    return photo.file;
  }

  openEditor();
  addPhoto.addEventListener('click', () => addPhotoRow().focus());
  preview.addEventListener('toggle', renderPreview);
  actionForm.addEventListener('input', renderPreview);

  actionForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(actionForm);
    const selected = photos.filter(photo => photo.src).map((photo, index) => ({
      photo, file: photo.file.files[0], alt: photo.caption.value.trim(), position: index + 1
    }));
    const missing = selected.find(photo => !photo.alt);
    if (missing) {
      output.textContent = 'Wpisz krótki opis zdjęcia ' + missing.position + '.';
      missing.photo.caption.focus();
      return;
    }
    busy = true;
    manager.inert = true;
    cancel.disabled = true;
    publish.disabled = true;
    photoFields.disabled = true;
    const textFields = [actionForm.elements.title, actionForm.elements.date, actionForm.elements.body];
    textFields.forEach(field => { field.readOnly = true; });
    try {
      const uploadedPhotos = [];
      for (const {photo, file, alt, position} of selected) {
        output.textContent = 'Przesyłanie zdjęcia ' + position + ' z ' + selected.length + '…';
        if (!photo.uploadedPath) {
          const uploaded = await adminRequest('/api/admin/zdjecie', {method: 'POST', headers: {'Content-Type': file.type}, body: file});
          photo.uploadedPath = uploaded.path;
        }
        uploadedPhotos.push({path: photo.uploadedPath, alt});
      }
      output.textContent = 'Zapisywanie działania…';
      const wasEditing = Boolean(editing);
      await adminPost(editing ? '/api/admin/edycja' : '/api/dzialania', {id:editing?.id, revision:editing?.revision, title: form.get('title'), date: form.get('date'), body: form.get('body'), photos: uploadedPhotos});
      openEditor();
      output.textContent = wasEditing ? 'Zmiany zostały zapisane. Zobacz wpis na stronie Nasze działania.' : 'Działanie zostało opublikowane.';
      await refreshArticles();
    } catch (error) {
      output.textContent = error.message;
    } finally {
      busy = false;
      manager.inert = false;
      cancel.disabled = false;
      publish.disabled = false;
      photoFields.disabled = false;
      textFields.forEach(field => { field.readOnly = false; });
    }
  });
}

function renderAction(data, url) {
  const article = document.createElement('article');
  article.className = 'news-article';
  article.dataset.date = data.date;
  const row = document.createElement('div');
  row.className = data.photos.length ? 'news-row' : 'news-row no-photo';
  const copy = document.createElement('div');
  const time = document.createElement('time');
  time.dateTime = data.date;
  time.textContent = data.date ? new Intl.DateTimeFormat('pl', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(data.date)) : '';
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
    const src = photo.src || url + '/' + index;
    if (url) link.href = src;
    const image = document.createElement('img');
    image.src = src;
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
  return article;
}

async function loadActions() {
  const status = document.querySelector('#actions-status');
  if (!status) return;
  try {
    const list = await fetch('/api/dzialania');
    if (!list.ok) throw new Error();
    const entries = await list.json();
    if (!entries.length) return;
    for(const entry of entries.filter(entry=>entry.deleted)) document.querySelector('[data-article-id="'+entry.id+'"]')?.remove();
    const dated = [...document.querySelectorAll('[data-date]')];
    const updates=await Promise.all(entries.filter(entry=>!entry.builtin && !entry.deleted).map(async entry=>{
      const url='/api/dzialania/'+entry.id;
      const response=await fetch(url);
      if(!response.ok) throw new Error();
      return {entry,url,data:await response.json()};
    }));
    for (const {entry,url,data} of updates) {
      const article = renderAction(data, url);
      const original=document.querySelector('[data-article-id="'+entry.id+'"]');
      const oldIndex=dated.indexOf(original);
      if(oldIndex!==-1) dated.splice(oldIndex,1);
      original?.remove();
      article.dataset.articleId=entry.id;
      if(data.date) dated.push(article);
      else document.querySelector('#undated-actions').after(article);
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
