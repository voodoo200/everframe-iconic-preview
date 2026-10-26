const ICONIC_BUILD = "ICONIC-2026.10.27-03";
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $=id=>document.getElementById(id),cfg=window.ICONIC_CONFIG||{};
const keys=['name','company','profession','city','country','contact','link','type','priority','status','next','amount','reason','notes'];
const types=['Участник','Спикер','Партнёр','Бренд'],statuses=['Новый контакт','Проверен','Написали','Ответил','Переговоры','Сделка','Не подходит'];
const state={db:null,user:null,workspace:null,contacts:[],selected:null,page:'candidates',quick:'',tab:'details',busy:false};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(id,s)=>$(id).textContent=s;
const fmt=d=>d?new Date(d).toLocaleString('ru-RU'):'';
function msg(s){say('drawerMessage',s||'')}
function initial(s){return (s||'И').trim().slice(0,1).toUpperCase()}
function image(url,klass,letter){try{let u=new URL(url);if(u.protocol==='https:')return `<img class="${klass}" src="${safe(u.href)}" alt="" loading="lazy" referrerpolicy="no-referrer">`}catch{}return `<span class="${klass}">${safe(letter)}</span>`}
function metric(label,num,symbol){return `<div class="metric"><span class="symbol">${symbol}</span><div class="num">${num}</div><small>${label}</small></div>`}
function render(){
const c=state.contacts,open=c.filter(x=>!['Сделка','Не подходит','Новый контакт'].includes(x.status));
$('metrics').innerHTML=metric('Всего контактов',c.length,'♙')+metric('В работе',open.length,'♧')+metric('Запланированных действий',c.filter(x=>x.next).length,'▦')+metric('Сделок',c.filter(x=>x.status==='Сделка').length,'✓');
let list=c.filter(x=>[x.name,x.company,x.profession,x.city,x.country,x.contact].join(' ').toLowerCase().includes($('search').value.toLowerCase().trim())).filter(x=>!$('statusFilter').value||x.status===$('statusFilter').value).filter(x=>!$('typeFilter').value||x.type===$('typeFilter').value).filter(x=>!$('priorityFilter').value||x.priority===$('priorityFilter').value);
if(state.quick)list=list.filter(x=>x.status===state.quick);if(state.page==='tasks')list=list.filter(x=>x.next).sort((a,b)=>a.next.localeCompare(b.next));
say('pageTitle',state.page==='tasks'?'Запланированные действия':state.page==='overview'?'Центр управления':'Кандидаты');say('count',`${list.length} из ${c.length}`);
$('content').innerHTML=list.length?list.map(x=>`<div class="personrow" data-contact="${safe(x.id)}">${image(x.photo_url,'mini-photo',initial(x.name))}<div class="personprimary"><b>${safe(x.name)}</b><small>${safe([x.profession,x.company].filter(Boolean).join(' · ')||'Контакт')}</small><div class="rowtags"><span>${safe(x.type||'Участник')}</span><span>Приоритет ${safe(x.priority||'B')}</span></div></div><div class="secondary"><small>⌖ ${safe([x.city,x.country].filter(Boolean).join(', ')||'География не указана')}</small></div><div class="secondary"><span class="chip ${x.status==='Сделка'?'green':x.status==='Новый контакт'?'blue':''}">${safe(x.status||'Новый контакт')}</span></div><span class="priority" title="Приоритет ${safe(x.priority||'B')}">★</span></div>`).join(''):'<div class="empty"><div class="empty-mark">✧</div><h3>Пока здесь тихо</h3><p>Добавьте первый контакт или измените параметры поиска.</p></div>';
}
async function reload(){
const {data,error}=await state.db.from('contacts').select('*').eq('workspace_id',state.workspace).order('created_at',{ascending:false}).limit(1000);
if(error)throw error;state.contacts=data||[];render();renderPeopleRecent();if(state.selected&&!state.contacts.some(x=>x.id===state.selected))closeDrawer();
}
function openDrawer(id=null){state.selected=id;state.tab='details';$('drawer').classList.remove('hidden');$('drawerBackdrop').classList.remove('hidden');document.body.classList.add('profile-open');msg('');renderDrawer();}
function closeDrawer(){$('drawer').classList.add('hidden');$('drawerBackdrop').classList.add('hidden');document.body.classList.remove('profile-open');state.selected=null}
const fields=[
['name','Имя / название','text'],['company','Компания / проект','text'],['profession','Профессия / сфера','text'],['city','Город','text'],['country','Страна','text'],['contact','Telegram / WhatsApp / email','text'],['link','Ссылка на профиль','url'],['photo_url','Ссылка на фото (HTTPS)','url'],['type','Категория','select',types],['priority','Приоритет','select',['A','B','C']],['status','Статус','select',statuses],['next','Следующее действие','date'],['amount','Сумма сделки, ₽','number'],['reason','Почему подходит','textarea'],['notes','Заметки','textarea']];
function detailsForm(c){return `<form id="detailsForm"><div class="formgrid">${fields.map(([key,label,kind,options])=>`<label class="field ${['link','photo_url','reason','notes'].includes(key)?'wide':''}">${label}${kind==='select'?`<select name="${key}">${options.map(v=>`<option ${v===(c[key]|| (key==='type'?'Участник':key==='priority'?'B':'Новый контакт'))?'selected':''}>${safe(v)}</option>`).join('')}</select>`:kind==='textarea'?`<textarea name="${key}" rows="3">${safe(c[key]||'')}</textarea>`:`<input name="${key}" type="${kind}" value="${safe(c[key]??'')}" ${kind==='number'?'min="0" step="any"':''} ${key==='name'?'required maxlength="200"':''}>`}</label>`).join('')}</div><div class="actions">${state.selected?'<button type="button" id="deleteContact" class="outline">Удалить контакт</button>':''}<button type="submit" class="goldbtn">Сохранить контакт</button></div></form>`}
function renderDrawer(){
$('goHistory').disabled=!state.selected;$('goTasks').disabled=!state.selected;
const c=state.contacts.find(x=>x.id===state.selected)||{};
say('personName',c.name||'Новый контакт');say('personMeta',[c.company,c.profession].filter(Boolean).join(' · ')||'THE ICONIC');
say('personStatus',c.status||'Новый контакт');$('portrait').outerHTML=image(c.photo_url,'portrait',initial(c.name)).replace('class="portrait"','id="portrait" class="portrait"');
document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.disabled=!state.selected&&b.dataset.tab!=='details'});
if(state.tab==='details'){$('drawerBody').innerHTML=detailsForm(c);return}
$('drawerBody').innerHTML='<div class="empty">Загрузка…</div>';
if(state.tab==='history')loadHistory();else loadTasks();
}
async function loadHistory(){
const id=state.selected;if(!id)return;
const {data,error}=await state.db.from('contact_activities').select('id,kind,body,happened_at').eq('workspace_id',state.workspace).eq('contact_id',id).order('happened_at',{ascending:false}).limit(100);
if(state.selected!==id||state.tab!=='history')return;
if(error){msg('Ошибка загрузки истории: '+error.message);return}
$('drawerBody').innerHTML=`<form id="historyForm" class="stack"><select name="kind"><option value="note">Заметка</option><option value="call">Звонок</option><option value="message">Сообщение</option><option value="meeting">Встреча</option><option value="email">Email</option></select><textarea name="body" rows="3" maxlength="4000" required placeholder="Что обсудили, о чём договорились?"></textarea><button class="goldbtn">Добавить запись</button></form><h3 style="margin:25px 0 10px">История общения</h3>${data.length?data.map(x=>`<div class="entry"><small>${safe(({note:'Заметка',call:'Звонок',message:'Сообщение',meeting:'Встреча',email:'Email'})[x.kind]||x.kind)} · ${safe(fmt(x.happened_at))}</small><p>${safe(x.body)}</p></div>`).join(''):'<p>Записей пока нет.</p>'}`;
}
async function loadTasks(){
const id=state.selected;if(!id)return;
const {data,error}=await state.db.from('contact_tasks').select('id,title,due_on,completed').eq('workspace_id',state.workspace).eq('contact_id',id).order('created_at',{ascending:false}).limit(100);
if(state.selected!==id||state.tab!=='tasks')return;
if(error){msg('Ошибка загрузки задач: '+error.message);return}
$('drawerBody').innerHTML=`<form id="taskForm" class="stack"><input name="title" required maxlength="250" placeholder="Что нужно сделать?"><input name="due_on" type="date"><button class="goldbtn">Создать задачу</button></form><h3 style="margin:25px 0 10px">Задачи клиента</h3>${data.length?data.map(x=>`<div class="entry taskrow"><label class="${x.completed?'done':''}"><input type="checkbox" data-task="${safe(x.id)}" ${x.completed?'checked':''}><span>${safe(x.title)}</span></label><small>${safe(x.due_on||'Без срока')}</small></div>`).join(''):'<p>Задач пока нет.</p>'}`;
}
async function guarded(action){if(state.busy)return;state.busy=true;msg('Сохранение…');try{await action();msg('Сохранено в облаке')}catch(e){msg('Ошибка: '+e.message)}finally{state.busy=false}}
$('drawerBody').addEventListener('submit',async e=>{
e.preventDefault();const f=e.target,fd=new FormData(f);
if(f.id==='detailsForm')return guarded(async()=>{
const payload={};for(const key of keys)payload[key]=String(fd.get(key)||'').trim()||null;
payload.photo_url=String(fd.get('photo_url')||'').trim()||null;
if(!payload.name)throw Error('Укажите имя');
if(payload.photo_url&&!/^https:\/\//i.test(payload.photo_url))throw Error('Фото должно быть по HTTPS');
if(payload.amount!==null){payload.amount=Number(payload.amount);if(!Number.isFinite(payload.amount)||payload.amount<0)throw Error('Некорректная сумма')}
let q;if(state.selected)q=state.db.from('contacts').update(payload).eq('workspace_id',state.workspace).eq('id',state.selected);else q=state.db.from('contacts').insert({...payload,workspace_id:state.workspace});
const {data,error}=await q.select('id').single();if(error)throw error;if(!data?.id)throw Error('База не подтвердила сохранение');
await reload();state.selected=data.id;renderDrawer();
});
if(f.id==='historyForm')return guarded(async()=>{
const {error}=await state.db.from('contact_activities').insert({workspace_id:state.workspace,contact_id:state.selected,author_id:state.user.id,kind:fd.get('kind'),body:String(fd.get('body')||'').trim()});if(error)throw error;await loadHistory();
});
if(f.id==='taskForm')return guarded(async()=>{
const {error}=await state.db.from('contact_tasks').insert({workspace_id:state.workspace,contact_id:state.selected,created_by:state.user.id,title:String(fd.get('title')||'').trim(),due_on:fd.get('due_on')||null});if(error)throw error;await loadTasks();
});
});
$('drawerBody').addEventListener('change',e=>{const box=e.target.closest('[data-task]');if(!box)return;guarded(async()=>{const {data,error}=await state.db.from('contact_tasks').update({completed:box.checked}).eq('workspace_id',state.workspace).eq('id',box.dataset.task).select('id');if(error)throw error;if(!data?.length)throw Error('Обновление не подтверждено');await loadTasks()})});
$('drawerBody').addEventListener('click',e=>{if(e.target.id!=='deleteContact')return;if(!confirm('Удалить контакт и связанную историю без возможности восстановления?'))return;guarded(async()=>{const {data,error}=await state.db.from('contacts').delete().eq('workspace_id',state.workspace).eq('id',state.selected).select('id');if(error)throw error;if(!data?.length)throw Error('Удаление не подтверждено');closeDrawer();await reload()})});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if(!state.selected&&b.dataset.tab!=='details')return;state.tab=b.dataset.tab;msg('');renderDrawer()}));
$('content').addEventListener('click',e=>{const row=e.target.closest('[data-contact]');if(row)openDrawer(row.dataset.contact)});
$('newContact').onclick=()=>openDrawer();$('closeDrawer').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;
function setMenu(open){const isMobile=window.matchMedia('(max-width:650px)').matches;const active=Boolean(open&&isMobile);$('sidebar').classList.toggle('show',active);$('sideShade').classList.toggle('hidden',!active);$('menuBtn').setAttribute('aria-expanded',String(active));document.body.classList.toggle('menu-open',active)}
$('menuBtn').onclick=()=>setMenu(!$('sidebar').classList.contains('show'));
$('sideClose').onclick=()=>setMenu(false);
$('sideShade').onclick=()=>setMenu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width:650px)').matches)setMenu(false)});
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{state.quick=b.dataset.quick;document.querySelectorAll('[data-quick]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('goHistory').onclick=()=>{if(!state.selected)return;state.tab='history';renderDrawer()};$('goTasks').onclick=()=>{if(!state.selected)return;state.tab='tasks';renderDrawer()};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));state.page=b.dataset.page;setMenu(false);$('peopleFinder').classList.toggle('hidden',state.page!=='people');$('crmWorkspace').classList.toggle('hidden',state.page==='people');if(state.page==='people')renderPeopleRecent();else render()});
function renderPeopleRecent(){const target=$('pfRecent');if(!target)return;target.replaceChildren();const items=state.contacts.slice(0,8);if(!items.length){const p=document.createElement('p');p.className='finder-muted';p.textContent='Контактов пока нет.';target.append(p);return}for(const c of items){const row=document.createElement('button');row.type='button';row.className='finder-recent-row';const name=document.createElement('strong');name.textContent=c.name||'Без имени';const meta=document.createElement('span');meta.textContent=[c.profession,c.city,c.status].filter(Boolean).join(' · ');row.append(name,meta);row.onclick=()=>openDrawer(c.id);target.append(row)}}
function pfQuery(){const role=$('pfRole').value,city=$('pfCity').value,extra=$('pfExtra').value.trim();const source=$('pfSource').value;const domain=source==='instagram'?'site:instagram.com/':source==='telegram'?'site:t.me/':'';return [domain,'"'+role+'"','"'+city+'"',extra].filter(Boolean).join(' ')}
function pfSearch(){const q=pfQuery(),r=$('pfResults');r.replaceChildren();const label=document.createElement('p');label.textContent='Запрос: '+q;label.className='finder-muted';r.append(label);const links=document.createElement('div');links.className='finder-links';const encoded=encodeURIComponent(q);for(const [name,url] of [['Google','https://www.google.com/search?q='+encoded],['Яндекс','https://yandex.ru/search/?text='+encoded],['Bing','https://www.bing.com/search?q='+encoded]]){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Открыть '+name;links.append(a)}r.append(links);const hint=document.createElement('p');hint.className='finder-muted';hint.textContent='Откройте результаты, проверьте профессиональный профиль и заполните карточку ниже.';r.append(hint)}
$('pfSearch').onclick=pfSearch;$('pfNext').onclick=()=>{const s=$('pfRole');s.selectedIndex=(s.selectedIndex+1)%s.options.length;pfSearch()};
$('pfForm').addEventListener('submit',async e=>{e.preventDefault();if(state.busy)return;const form=e.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim(),link=String(fd.get('link')||'').trim();if(!name||!link){say('pfMessage','Заполните имя и ссылку.');return}let url;try{url=new URL(link);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('URL')}catch{say('pfMessage','Укажите корректную ссылку на публичный профиль.');return}if(state.contacts.some(c=>c.link&&c.link.replace(/\/$/,'').toLowerCase()===link.replace(/\/$/,'').toLowerCase())){say('pfMessage','Этот профиль уже есть в CRM.');return}state.busy=true;$('pfSave').disabled=true;say('pfMessage','Сохраняем в CRM…');try{if(!state.db||!state.workspace)throw Error('Нет активного подключения к рабочей области');const payload={workspace_id:state.workspace,name,link,profession:String(fd.get('profession')||'').trim()||null,city:String(fd.get('city')||'').trim()||null,reason:String(fd.get('reason')||'').trim()||null,priority:String(fd.get('priority')||'B'),type:String(fd.get('type')||'Участник'),status:'Новый контакт'};const {data,error}=await state.db.from('contacts').insert(payload).select('id').single();if(error)throw error;if(!data?.id)throw Error('База не подтвердила сохранение');await reload();form.reset();say('pfMessage','Контакт сохранён в общей CRM.');openDrawer(data.id)}catch(err){say('pfMessage','Ошибка сохранения: '+err.message)}finally{state.busy=false;$('pfSave').disabled=false}});
pfSearch();
['search','statusFilter','typeFilter','priorityFilter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
for(const x of statuses)$('statusFilter').insertAdjacentHTML('beforeend',`<option>${safe(x)}</option>`);
for(const x of types)$('typeFilter').insertAdjacentHTML('beforeend',`<option>${safe(x)}</option>`);
async function init(){
if(!cfg.supabaseUrl?.startsWith('https://')||!cfg.supabaseAnonKey){say('loginMessage','Нужен config.js из существующего проекта (ключ anon/publishable).');return}
if(!state.db)state.db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const {data:{user}}=await state.db.auth.getUser();if(!user)return;
state.user=user;const {data:membership,error}=await state.db.from('workspace_members').select('workspace_id').eq('user_id',user.id).limit(1).maybeSingle();
if(error||!membership){say('loginMessage','Нет доступа к рабочему пространству');return}
state.workspace=membership.workspace_id;try{await reload();say('userEmail',user.email||'');say('initial',initial(user.email));$('login').classList.add('hidden')}catch(e){say('loginMessage','Ошибка базы: '+e.message)}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!state.db)return;say('loginMessage','Входим…');const {error}=await state.db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){say('loginMessage',error.message);return}await init()};
$('logout').onclick=async()=>{if(state.db)await state.db.auth.signOut();state.user=null;state.workspace=null;state.contacts=[];closeDrawer();$('login').classList.remove('hidden');say('loginMessage','Вы вышли из системы')};
init().catch(e=>say('loginMessage','Ошибка запуска: '+e.message));
