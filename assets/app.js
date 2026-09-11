const CATS = {
  eco:     'Экология',
  people:  'Помощь людям',
  animals: 'Животные',
  edu:     'Образование'
};

const PROJECTS = [
  {id:1,  title:'Уборка берега реки Тихой', org:'Эко-движение «Чистый берег»', cat:'eco', fmt:'Офлайн', city:'Казань', hours:3, urgent:true,
   desc:'Субботние выезды на мусорные завалы вдоль русла. Инвентарь и перчатки выдаём, обед за счёт организаторов.'},
  {id:2,  title:'Горячие обеды для подопечных', org:'Фонд «Тёплый дом»', cat:'people', fmt:'Офлайн', city:'Москва', hours:2, urgent:false,
   desc:'Помощь на раздаче и упаковке порций дважды в неделю. Нужна медкнижка, оформим бесплатно.'},
  {id:3,  title:'Выгул собак в приюте', org:'Приют «Верный друг»', cat:'animals', fmt:'Офлайн', city:'Санкт-Петербург', hours:4, urgent:true,
   desc:'Прогулки, расчёсывание, социализация щенков. Первая смена всегда в паре с куратором.'},
  {id:4,  title:'Онлайн-репетитор по математике', org:'Проект «Равные шансы»', cat:'edu', fmt:'Онлайн', city:'Любой город', hours:2, urgent:false,
   desc:'Два занятия в неделю со школьником 6–9 класса по видеосвязи. Методички и план занятий дадим.'},
  {id:5,  title:'Высадка деревьев в городском парке', org:'Городская экослужба', cat:'eco', fmt:'Офлайн', city:'Новосибирск', hours:5, urgent:false,
   desc:'Сезонные посадки саженцев и уход за молодыми деревьями. Работа физическая, но неспешная.'},
  {id:6,  title:'Звонки одиноким пожилым людям', org:'Служба «Не один»', cat:'people', fmt:'Онлайн', city:'Любой город', hours:1, urgent:false,
   desc:'Раз в неделю поговорить по телефону 20–30 минут. Перед стартом обучающий вебинар по общению.'},
  {id:7,  title:'Фотосъёмка питомцев для карточек', org:'Приют «Верный друг»', cat:'animals', fmt:'Офлайн', city:'Санкт-Петербург', hours:3, urgent:false,
   desc:'Хорошие фото ускоряют пристройство в разы. Нужна своя камера или смартфон с приличной оптикой.'},
  {id:8,  title:'Кружок робототехники для подростков', org:'Центр «Поколение»', cat:'edu', fmt:'Офлайн', city:'Екатеринбург', hours:4, urgent:true,
   desc:'Ведём занятия на наборах Arduino по субботам. Нужны базовые знания электроники и программирования.'},
  {id:9,  title:'Сортировка вещей в гуманитарном складе', org:'Фонд «Тёплый дом»', cat:'people', fmt:'Офлайн', city:'Москва', hours:6, urgent:false,
   desc:'Разбор, проверка и упаковка одежды для семей в трудной ситуации. График гибкий, будни и выходные.'},
  {id:10, title:'Перевод материалов фонда', org:'Фонд «Тёплый дом»', cat:'people', fmt:'Онлайн', city:'Любой город', hours:2, urgent:false,
   desc:'Перевод отчётов и новостей на английский. Подойдёт уровень от B2, дедлайны мягкие.'},
  {id:11, title:'Мониторинг незаконных свалок', org:'Эко-движение «Чистый берег»', cat:'eco', fmt:'Онлайн', city:'Любой город', hours:1, urgent:false,
   desc:'Отмечаете свалки на карте по спутниковым снимкам и жалобам жителей. Полностью из дома.'},
  {id:12, title:'Передержка кошек после операций', org:'Волонтёры «Девять жизней»', cat:'animals', fmt:'Офлайн', city:'Казань', hours:8, urgent:false,
   desc:'Дом на 7–14 дней для восстановления животного. Корм, лекарства и ветеринара обеспечивает организация.'}
];

const $ = s => document.querySelector(s);
const cards = $('#cards'), countEl = $('#count'), emptyEl = $('#empty');
const qEl = $('#q'), catEl = $('#cat'), fmtEl = $('#fmt'), hoursEl = $('#hours'), hoursOut = $('#hoursOut');

const plural = (n, forms) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
};

function cardHtml(p) {
  return `<article class="card">
    <h3>${p.title}</h3>
    <p class="org">${p.org} · ${p.city}</p>
    <p class="desc">${p.desc}</p>
    <div class="tags">
      <span class="tag cat-${p.cat}">${CATS[p.cat]}</span>
      <span class="tag">${p.fmt}</span>
      <span class="tag">${p.hours} ${plural(p.hours, ['час','часа','часов'])}/нед</span>
    </div>
    <div class="card-foot">
      <span class="urgent">${p.urgent ? 'Нужны срочно' : ''}</span>
      <button class="btn btn-small" data-apply="${p.id}">Откликнуться</button>
    </div>
  </article>`;
}

function render() {
  const q = qEl.value.trim().toLowerCase();
  const maxH = Number(hoursEl.value);
  const list = PROJECTS.filter(p =>
    (!catEl.value || p.cat === catEl.value) &&
    (!fmtEl.value || p.fmt === fmtEl.value) &&
    p.hours <= maxH &&
    (!q || `${p.title} ${p.org} ${p.desc} ${p.city} ${CATS[p.cat]}`.toLowerCase().includes(q))
  );
  cards.innerHTML = list.map(cardHtml).join('');
  emptyEl.hidden = list.length > 0;
  countEl.textContent = `${list.length} ${plural(list.length, ['проект','проекта','проектов'])} найдено`;
}

['input','change'].forEach(ev => $('#filters').addEventListener(ev, () => {
  hoursOut.textContent = hoursEl.value;
  render();
}));
$('#filters').addEventListener('reset', () => setTimeout(() => { hoursOut.textContent = hoursEl.value; render(); }));
render();

/* отклик на проект */
const dialog = $('#applyDialog'), applyForm = $('#applyForm');
let currentProject = null;

cards.addEventListener('click', e => {
  const btn = e.target.closest('[data-apply]');
  if (!btn) return;
  currentProject = PROJECTS.find(p => p.id === Number(btn.dataset.apply));
  $('#applyProject').textContent = `${currentProject.title} — ${currentProject.org}`;
  applyForm.reset();
  dialog.showModal();
});

dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'send' || !currentProject) return;
  const data = Object.fromEntries(new FormData(applyForm));
  save('applications', {...data, project: currentProject.title, at: new Date().toISOString()});
  alert(`Отклик отправлен. Координатор проекта «${currentProject.title}» свяжется с вами.`);
});

$('#applySubmit').addEventListener('click', e => {
  if (!applyForm.checkValidity()) { e.preventDefault(); applyForm.reportValidity(); }
});

/* анкета волонтёра */
const joinForm = $('#joinForm');
const MSG = {name:'Укажите имя, минимум 2 символа', contact:'Нужен телефон или e-mail для связи', agree:'Без согласия мы не сможем обработать анкету'};

joinForm.addEventListener('submit', e => {
  e.preventDefault();
  let ok = true;
  joinForm.querySelectorAll('.err').forEach(el => el.textContent = '');
  for (const key of Object.keys(MSG)) {
    const input = joinForm.elements[key];
    if (!input.checkValidity()) {
      const slot = joinForm.querySelector(`.err[data-for="${key}"]`);
      if (slot) slot.textContent = MSG[key];
      if (ok) input.focus();
      ok = false;
    }
  }
  if (!ok) return;
  save('volunteers', {...Object.fromEntries(new FormData(joinForm)), at: new Date().toISOString()});
  joinForm.reset();
  $('#joinOk').hidden = false;
});

function save(key, item) {
  try {
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    all.push(item);
    localStorage.setItem(key, JSON.stringify(all));
  } catch (_) { /* приватный режим — просто не сохраняем */ }
}

/* счётчики в шапке */
const counters = document.querySelectorAll('.stats dd');
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    const target = Number(en.target.dataset.count);
    const step = Math.ceil(target / 40);
    let v = 0;
    const t = setInterval(() => {
      v = Math.min(v + step, target);
      en.target.textContent = v.toLocaleString('ru-RU');
      if (v >= target) clearInterval(t);
    }, 25);
  });
}, {threshold: .4});
counters.forEach(c => io.observe(c));

/* мобильное меню */
const burger = document.querySelector('.burger'), mnav = $('#mobile-nav');
burger.addEventListener('click', () => {
  const open = mnav.hidden;
  mnav.hidden = !open;
  burger.setAttribute('aria-expanded', String(open));
});
mnav.addEventListener('click', e => {
  if (e.target.tagName === 'A') { mnav.hidden = true; burger.setAttribute('aria-expanded','false'); }
});
