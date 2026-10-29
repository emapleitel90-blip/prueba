import './style.css';
import {units,unitLabel,compatibleUnits,compatible,convertQuantity,formatQuantity,inputQuantity,recipeQuantity,stockUnitFactor,changeStockUnit} from './units.js';
import {packageQuantity,purchaseChanges} from './purchasing.js';
import {familyPortions,familyEntry,saveFamily,removeFamily,validateFamily} from './family.js';
import {report,advice} from './analytics.js';
import {recipeCosts} from './costing.js';
import {orderStatuses,orderPortions,saveOrder,removeOrder,validateOrders} from './orders.js';
import {cloud,readShared,writeShared} from './shared.js';
const money = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Cordoba'});
const initial = {demo:true,stock:[{id:'carne',name:'Carne picada',unit:'kg',qty:8,cost:8500,min:2},{id:'pasta',name:'Tapas para canelones',unit:'unidad',qty:80,cost:180,min:20},{id:'verdura',name:'Acelga',unit:'kg',qty:3,cost:2200,min:1},{id:'envase',name:'Envase con tapa',unit:'unidad',qty:45,cost:350,min:20}],recipes:[{id:'canelones',name:'Canelones de carne y verdura',yield:20,price:6500,items:[{id:'carne',qty:2},{id:'pasta',qty:40},{id:'verdura',qty:1},{id:'envase',qty:20}]}],days:[],expenses:[]};
let state;
try {state=JSON.parse(localStorage.getItem('filo-v1'))||structuredClone(initial)}catch{state=structuredClone(initial)}
let tab='Hoy'; let message=''; let selectedMonth=today().slice(0,7); let editingSales=null; let purchaseFilter=''; let familyMonth=today().slice(0,7);
let session=null,version=null,busy=Boolean(cloud),syncError='',draftAvailable=Boolean(localStorage.getItem('filo-unsent')),dirty=false;
let refreshing=null;let orderDate=today(),orderFilter='all';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=async()=>{
 dirty=false;
 if(cloud){
  if(!session||version===null||syncError){message='Primero iniciá sesión y actualizá los datos compartidos.';render();return false}
  busy=true;render();
  try{version=await writeShared(state,version);localStorage.removeItem('filo-unsent');draftAvailable=false;}
  catch(error){message='';localStorage.setItem('filo-unsent',JSON.stringify(state));draftAvailable=true;syncError=error.message;busy=false;render();return false}
  busy=false;
 }
 let saved=true;
 try{localStorage.setItem('filo-v1',JSON.stringify(state))}
 catch{message='No se pudo guardar. Exportá una copia antes de cerrar.';saved=false}
 render();return saved;
};
const costMoney=n=>n.toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2});
const rate=n=>n.toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:6});
const decimal = value => { const text=String(value).trim().replace(',', '.'); return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)?Number(text):NaN; };
const unitOptions=(list=units,selected)=>list.map(u=>`<option value="${u}" ${u===selected?'selected':''}>${unitLabel(u)}</option>`).join('');
const options=()=>state.stock.map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.unit)})</option>`).join('');
const field=(label,name,type='text',value='',extra='')=>`<label>${label}<input name="${name}" type="${type==='number'?'text':type}" ${type==='number'?`inputmode="decimal" data-number ${extra.includes('step="1"')?'data-integer':''}`:''} value="${esc(value)}" ${extra} required></label>`;
const empty=t=>`<div class="empty">${t}</div>`;
function render(){

document.querySelector('#app').innerHTML=`<aside><a class="brand" href="#" aria-label="Filo viandas, inicio"><img src="/filo-logo.svg" width="190" height="144" alt="Filo viandas"></a><div class="workspace">COCINA EN FAMILIA</div><nav>${['Hoy','Pedidos','Compras','Stock','Recetas','Familia','Resumen'].map((x,i)=>`<button class="nav ${tab===x?'active':''}" data-tab="${x}"><span>${['◷','☷','＋','▦','▤','⌂','↗'][i]}</span>${x}</button>`).join('')}</nav><div class="aside-bottom">Hecho para tu día a día.<br><small>Tu cocina, en orden.</small></div></aside><main><header><div class="header-brand"><img class="mobile-logo" src="/filo-logo.svg" width="80" height="61" alt="Filo viandas"><span class="header-location">Filo viandas <span class="muted">/ ${tab}</span></span></div><span class="date">${new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long'}).format(new Date())}</span></header><div class="content"><div class="heading"><div><div class="eyebrow">MENOS CUADERNO, MÁS CLARIDAD</div><h1>${{Hoy:'¡Buen día, equipo!',Pedidos:'Cada porción tiene un nombre.',Compras:'Cada compra, en orden.',Stock:'Lo que hay en la cocina.',Recetas:'El secreto está en los números.',Familia:'La cocina también es de casa.',Resumen:'Mirá cómo viene Filo.'}[tab]}</h1><p>${{Hoy:'Todo listo para organizar las viandas de hoy.',Pedidos:'Clientes, porciones y entregas, en un mismo lugar.',Compras:'Registrá lo que comprás y mantené el stock al día.',Stock:'Ingredientes, precios y cantidades. Todo editable.',Recetas:'Guardá tus preparaciones y conocé el costo por porción.',Familia:'Para ustedes cuatro, con el mismo stock y un registro propio.',Resumen:'Tu mes en números y acciones para seguir creciendo.'}[tab]}</p></div><span class="pill">● Tu cocina</span></div>${sharingPanel()}${editingNotice()}${state.demo?'<div class="notice">✦ Estás explorando con ingredientes y una receta de ejemplo. <button id="clear-demo">Empezar sin ejemplos</button></div>':''}${message?`<div role="status" class="notice">${esc(message)}</div>`:''}${tab==='Hoy'?home():tab==='Pedidos'?orders():tab==='Stock'?stock():tab==='Compras'?purchases():tab==='Recetas'?recipes():tab==='Familia'?family():summary()}<footer>Filo viandas · Hecho con cariño, gestionado con claridad.<span>${cloud?'Guardado compartido con acceso familiar':'Datos solo en este navegador'} · <button id="export">Exportar copia</button> · <button id="import">Importar copia</button><input id="import-file" type="file" accept="application/json,.json" hidden></span></footer></div></main>`;
bind();
if(cloud&&(!session||version===null||syncError||busy)){document.querySelectorAll('form:not(#login) input,form:not(#login) select,form:not(#login) button,[data-recipe],[data-purchase],[data-delete-purchase],[data-edit-sales],[data-delete-day],[data-family-edit],[data-family-delete],[data-order-edit],[data-order-delete],[data-order-status],#clear-demo,#import').forEach(e=>e.disabled=true);}
document.querySelector('#app').inert=busy;
if(busy){const n=document.createElement('div');n.className='sync-loading';n.textContent='Conectando con los datos compartidos…';document.body.append(n)}else document.querySelectorAll('.sync-loading').forEach(e=>e.remove());
}
function sharingPanel(){if(!cloud)return `<div class="notice">Modo de prueba local. Para ver los mismos datos entre celulares, falta configurar Supabase. Podés exportar e importar una copia; eso no sincroniza cambios.</div>`;return `<section class="sharing"><h2>Datos compartidos · Filo en familia</h2>${session?`<p>Conectado como ${esc(session.user.email)}. Actualizá antes de editar para ver lo que cargó otra persona.</p><button id="refresh-cloud">↻ Actualizar datos</button> · <button id="logout">Cerrar sesión</button>`:`<p>Ingresá con un correo autorizado de la familia. Te enviaremos un enlace para entrar.</p><form id="login">${field('Tu correo','email','email')}<button class="primary">Enviar enlace de acceso</button></form>`}${syncError?`<p role="alert">${esc(syncError)}</p>`:''}${localStorage.getItem('filo-before-cloud')?'<p><button id="export-before-cloud">Descargar copia previa de este dispositivo</button>. Podés importarla para iniciar los datos familiares.</p>':''}${draftAvailable?'<p>Hay un borrador local que no se guardó en la nube. <button id="export-draft">Descargar borrador</button></p>':''}</section>`}
function editingNotice(){
 if(!cloud||busy)return '';
 if(!session)return `<div class="editing-notice" role="status"><span>Para ajustar cantidades o precios, ingresá con tu correo autorizado.</span><button type="button" data-recover-edit>Ir al acceso</button></div>`;
 if(syncError||version===null)return `<div class="editing-notice" role="alert"><span>La edición necesita actualizar los datos compartidos.${draftAvailable?' Tu carga anterior se conserva como borrador.':''}</span><button type="button" data-recover-edit>Actualizar y habilitar edición</button></div>`;
 return '';
}
function showLogin(){
 message='Ingresá con tu correo autorizado para ajustar el inventario y el precio.';render();
 document.querySelector('#login')?.scrollIntoView({behavior:'smooth',block:'center'});document.querySelector('#login input')?.focus();
}
async function refreshCloud(){
 if(refreshing)return refreshing;
 if(!session){showLogin();return false}
 if(dirty&&!confirm('Hay un formulario sin guardar. ¿Descartarlo y cargar los datos compartidos?'))return false;
 const account=session.user.email;busy=true;render();
 refreshing=(async()=>{
  try{
   const row=await readShared();
   if(!session||session.user.email!==account)return false;
   validateBackup(row.payload);state=row.payload;version=row.version;syncError='';dirty=false;editingSales=null;
   localStorage.setItem('filo-v1',JSON.stringify(state));message='Datos compartidos actualizados. Ya podés editar.';return true;
  }catch(error){syncError=error.message;return false}
  finally{busy=false;refreshing=null;render()}
 })();
 return refreshing;
}
function openStockEditor(id){
 const x=state.stock.find(i=>i.id===id),f=document.querySelector('#stock');if(!x||!f)return;
 f.unitChanges=[];f.dataset.pendingTo='';
 f.elements.packaged.checked=false;Object.entries(x).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v});
 setUnitSelect(f.elements.costUnit,x.unit,x.unit);f.dataset.unit=x.unit;f.elements.qty.value=inputQuantity(x.qty,x.unit);f.elements.min.value=inputQuantity(x.min,x.unit);updateStockFields();
 document.querySelector('#stock-title').textContent='Ajustar inventario y precio';
 document.querySelector('#stock-purpose').textContent='Cargá el total que contaron: reemplaza la cantidad disponible. Para agregar una compra al stock existente usá «Sumar compra». Cambiar el precio acá no registra un pago.';
 f.scrollIntoView({behavior:'smooth',block:'start'});f.elements.qty.focus({preventScroll:true});
}
function startStockAction(id,action){
 if(busy)return;
 if(cloud&&!session){showLogin();return}
 const open=()=>{if(!state.stock.some(x=>x.id===id)){message='El producto cambió. Revisá el stock actualizado.';render();return}if(action==='purchase')openPurchases(id);else openStockEditor(id)};
 if(cloud&&(syncError||version===null)){
  refreshCloud().then(ok=>{if(ok)open()});return;
 }
 open();
}
function download(data,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function home(){const d=state.days.filter(x=>x.date===today());return `<div class="stats"><article><small>Viandas preparadas hoy</small><strong>${d.reduce((s,x)=>s+x.made,0)} <em>porciones</em></strong><span>Un día a la vez</span></article><article><small>Ventas de hoy</small><strong>${money(d.reduce((s,x)=>s+x.sold*x.price,0))}</strong><span>Ingresos registrados</span></article><article><small>Stock para revisar</small><strong>${state.stock.filter(x=>x.qty<=x.min).length} <em>ingredientes</em></strong><span>Según tus mínimos de stock</span></article></div><div class="notice">¿Usaron ingredientes o viandas para comer en casa? <button data-tab="Familia">Registrar consumo familiar</button></div>${ordersToday()}<div class="columns"><section><div class="section-title"><h2>El menú de hoy</h2><span class="tag">A cocinar</span></div><p>Registrá la producción y las ventas iniciales. Después podés actualizar las vendidas en Jornadas de hoy.</p>${state.recipes.length?`<form id="day"><label>¿Qué preparamos?<select name="recipe">${state.recipes.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label>${field('Fecha de producción y venta','date','date',today(),`max="${today()}"`)}<div class="form-grid">${field('Preparadas','made','number',20,'min="1" step="1"')}${field('Vendidas hasta ahora','sold','number',0,'min="0" step="1"')}</div><button class="primary">Registrar jornada <span>↗</span></button></form>`:empty('Primero agregá ingredientes y una receta.')}<div class="hint">💡 El costo se guarda con el precio actual de los ingredientes. Las compras futuras no cambian tu historial.</div></section><section class="green"><div class="eyebrow">PASO A PASO</div><h2>Una cocina organizada<br>rinde más.</h2><p>Tu rutina en tres momentos simples.</p><ol><li><b>Cargá tus compras</b><span>Los ingredientes entran al stock.</span></li><li><b>Elegí el menú</b><span>Calculamos el costo de cada vianda.</span></li><li><b>Registrá cómo fue el día</b><span>Preparadas, vendidas y sobrantes.</span></li></ol><div class="green-bottom">Pequeños registros. Mejores decisiones. ✳</div></section></div><section><h2>Jornadas de hoy</h2>${d.length?d.map(x=>daySalesRow(x)).join(''):empty('Todavía no registraron una jornada. ¡Vamos con la primera!')}</section>`}
function orderCard(order){
 return `<article class="order-card"><div class="section-title"><h3>${esc(order.customer)}</h3><span class="tag ${order.status==='cancelled'?'warn':''}">${orderStatuses[order.status]}</span></div><p><b>${order.portions} ${order.portions===1?'porción':'porciones'} · ${esc(order.name)}</b><br>${esc(order.date)}${order.time?` · ${esc(order.time)} hs`:''}</p><p class="order-destination"><b>${order.fulfillment==='delivery'?'Entrega a domicilio':'Retira el cliente'}</b>${order.fulfillment==='delivery'?`<br>${esc(order.address)}`:''}</p>${order.phone?`<p>Teléfono: ${esc(order.phone)}</p>`:''}${order.notes?`<p class="order-notes">${esc(order.notes)}</p>`:''}<small>${order.day?'Porciones vinculadas a una jornada preparada':'Sin jornada vinculada'}</small><div class="order-actions"><button type="button" data-order-edit="${esc(order.id)}">Editar pedido</button>${order.status==='pending'?`<button type="button" data-order-status="ready" data-order-id="${esc(order.id)}">Marcar listo</button>`:order.status==='ready'?`<button type="button" data-order-status="delivered" data-order-id="${esc(order.id)}">Marcar entregado</button>`:''}<button type="button" data-order-delete="${esc(order.id)}">Eliminar carga errónea</button></div></article>`;
}
function ordersToday(){
 const entries=(state.orders||[]).filter(o=>o.date===today()&&o.status!=='cancelled').sort((a,b)=>(a.time||'23:59').localeCompare(b.time||'23:59'));
 return `<section class="orders-today"><div class="section-title"><h2>Pedidos de hoy</h2><button type="button" data-tab="Pedidos">Ver / registrar pedidos</button></div>${entries.length?`<p>${entries.reduce((sum,o)=>sum+o.portions,0)} porciones pedidas · ${entries.filter(o=>o.status==='delivered').length} pedidos entregados</p><div class="order-grid">${entries.slice(0,3).map(orderCard).join('')}</div>${entries.length>3?'<p>Hay más pedidos en la sección Pedidos.</p>':''}`:empty('Anotá quién pidió cada vianda y si la retira o se la llevan.')}</section>`;
}
function orders(){
 const entries=(state.orders||[]).filter(o=>(!orderDate||o.date===orderDate)&&(orderFilter==='all'||o.status===orderFilter)).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'23:59').localeCompare(b.time||'23:59')||a.customer.localeCompare(b.customer,'es'));
 const active=entries.filter(o=>o.status!=='cancelled');
 return `<div class="notice">Anotá también los pedidos para próximos días. Cuando haya producción, podés asignar una jornada para separar esas porciones. Las ventas se siguen cargando en «Actualizar ventas»; guardar un pedido o marcarlo entregado no registra un cobro ni vuelve a descontar ingredientes.</div><section><h2 id="order-title">Nuevo pedido</h2>${state.recipes.length?`<form id="order"><input type="hidden" name="id"><div class="form-grid">${field('Nombre del cliente','customer','text','','maxlength="120" autocomplete="name"')}<label>Teléfono (opcional)<input name="phone" type="tel" maxlength="100" autocomplete="tel"></label>${field('Fecha de retiro o entrega','date','date',orderDate||today())}<label>Horario (opcional)<input name="time" type="time"></label><label>Menú<select name="recipe" required>${state.recipes.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label>${field('Cantidad de porciones','portions','number',1,'min="1" step="1"')}<label>¿Cómo lo recibe?<select name="fulfillment"><option value="pickup">Retira el cliente</option><option value="delivery">Entrega a domicilio</option></select></label><label>Estado<select name="status">${Object.entries(orderStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><label id="order-address" hidden>Dirección de entrega<input name="address" maxlength="500" autocomplete="street-address" disabled placeholder="Calle, número, piso, departamento y barrio"></label><label>Observaciones (opcional)<textarea name="notes" rows="3" maxlength="1000" placeholder="Ej.: tocar timbre, sin cebolla, entrega en recepción"></textarea></label><label>Jornada preparada (opcional)<select name="day"><option value="">Sin jornada asignada / preparar después</option></select></label><p id="order-capacity" class="purchase-preview" aria-live="polite"></p><button class="primary">Guardar pedido</button><button type="button" id="cancel-order">Cancelar edición / nuevo pedido</button></form>`:empty('Primero guardá un menú en Recetas. Después vas a poder registrar sus pedidos. No hace falta preparar una jornada para anotarlos.')}</section><section><div class="section-title"><h2>Lista de pedidos</h2><button type="button" id="orders-all-dates">Ver todas las fechas</button></div><div class="form-grid"><label>Fecha<input id="orders-date" type="date" value="${esc(orderDate)}"></label><label>Estado<select id="orders-status"><option value="all">Todos los estados</option>${Object.entries(orderStatuses).map(([value,label])=>`<option value="${value}" ${orderFilter===value?'selected':''}>${label}</option>`).join('')}</select></label></div><p>${entries.length} pedidos · ${active.reduce((sum,o)=>sum+o.portions,0)} porciones sin contar cancelados</p>${entries.length?`<div class="order-grid">${entries.map(orderCard).join('')}</div>`:empty('No hay pedidos para esta fecha y estado.')}</section>`;
}
function updateOrderForm(){
 const f=document.querySelector('#order');if(!f)return;
 const delivery=f.elements.fulfillment.value==='delivery';document.querySelector('#order-address').hidden=!delivery;f.elements.address.disabled=!delivery;f.elements.address.required=delivery;
 const selected=f.elements.day.value;
 f.elements.day.innerHTML='<option value="">Sin jornada asignada / preparar después</option>'+state.days.map((day,index)=>day.recipe===f.elements.recipe.value&&day.date<=f.elements.date.value?`<option value="${esc(day.id||`day:${index}`)}">${esc(day.date)} · ${esc(day.name)} · ${day.made} preparadas</option>`:'').join('');
 if([...f.elements.day.options].some(o=>o.value===selected))f.elements.day.value=selected;
 const day=state.days.find(d=>d.id&&d.id===f.elements.day.value)||(/^day:\d+$/.test(f.elements.day.value)?state.days[Number(f.elements.day.value.slice(4))]:null);
 document.querySelector('#order-capacity').textContent=day?`${day.made-familyPortions(state,day)-orderPortions(state,day,f.elements.id.value)} porciones para asignar en esta jornada, sin contar el pedido que estás editando. Podés identificar porciones que ya figuren como vendidas: el pedido no las suma otra vez.`:'Sin jornada vinculada: no separa porciones de una producción registrada ni descuenta stock. Cuando registren la producción, editá el pedido y elegí la jornada correspondiente.';
}
function bindOrders(){
 const locked=()=>cloud&&(!session||version===null||syncError||busy);
 const changeView=change=>{if(dirty&&!confirm('Hay un formulario sin guardar. ¿Descartarlo para cambiar la vista de pedidos?'))return false;change();dirty=false;render();return true};
 document.querySelector('#orders-date')?.addEventListener('change',e=>{const value=e.target.value;if(!changeView(()=>orderDate=value))e.target.value=orderDate});
 document.querySelector('#orders-status')?.addEventListener('change',e=>{const value=e.target.value;if(!changeView(()=>orderFilter=value))e.target.value=orderFilter});
 document.querySelector('#orders-all-dates')?.addEventListener('click',()=>changeView(()=>orderDate=''));
 document.querySelector('#order')?.addEventListener('change',updateOrderForm);updateOrderForm();
 document.querySelector('#cancel-order')?.addEventListener('click',()=>{dirty=false;render()});
 document.querySelector('#order')?.addEventListener('submit',async e=>{
  e.preventDefault();if(locked())return;
  const data=new FormData(e.target),input=Object.fromEntries(data.entries());input.id=input.id||crypto.randomUUID();input.portions=decimal(input.portions);
  try{state=saveOrder(state,input)}catch(error){alert(error.message);return}
  orderDate=input.date;orderFilter='all';message='';if(await save()){message='Pedido guardado con los datos del cliente. Las ventas se actualizan desde Hoy o Resumen.';render()}
 });
 document.querySelectorAll('[data-order-edit]').forEach(button=>button.onclick=()=>{
  if(locked())return;
  const order=(state.orders||[]).find(o=>o.id===button.dataset.orderEdit);if(!order)return;
  tab='Pedidos';orderDate=order.date;orderFilter='all';message='';dirty=false;render();
  const f=document.querySelector('#order');for(const key of ['id','customer','phone','date','time','recipe','portions','fulfillment','status','address','notes'])f.elements[key].value=order[key]??'';
  updateOrderForm();f.elements.day.value=order.day||'';updateOrderForm();document.querySelector('#order-title').textContent='Editar pedido';f.scrollIntoView({behavior:'smooth',block:'start'});f.elements.customer.focus({preventScroll:true});
 });
 document.querySelectorAll('[data-order-status]').forEach(button=>button.onclick=async()=>{
  if(locked())return;
  const order=(state.orders||[]).find(o=>o.id===button.dataset.orderId);if(!order)return;
  try{state=saveOrder(state,{...order,status:button.dataset.orderStatus})}catch(error){alert(error.message);return}
  message='';if(await save()){message=`Pedido de ${order.customer}: ${orderStatuses[button.dataset.orderStatus].toLocaleLowerCase()}.`;render()}
 });
 document.querySelectorAll('[data-order-delete]').forEach(button=>button.onclick=async()=>{
  if(locked())return;
  const order=(state.orders||[]).find(o=>o.id===button.dataset.orderDelete);if(!order||!confirm(`¿Eliminar la carga errónea del pedido de ${order.customer}? Para conservar el historial de un pedido que no se concretó, elegí Editar pedido y estado Cancelado. Las ventas y el stock no cambian.`))return;
  try{state=removeOrder(state,order.id)}catch(error){alert(error.message);return}
  message='';if(await save()){message='Carga de pedido eliminada.';render()}
 });
}
function daySalesRow(day,showDate=false){
 const index=state.days.indexOf(day),editing=editingSales===index,atHome=familyPortions(state,day),available=day.made-atHome;
 return `<div class="day-record"><div class="row"><div><b>${esc(day.name)}</b><small>${showDate?`${esc(day.date)} · `:''}${day.made} preparadas · ${day.sold} vendidas · ${atHome?`${atHome} para casa · `:''}${day.made-day.sold-atHome} disponibles</small>${orderPortions(state,day)?`<small>${orderPortions(state,day)} porciones identificadas en pedidos · ${day.made-atHome-Math.max(day.sold,orderPortions(state,day))} sin vender ni asignar</small>`:''}${day.overheadCost?`<small>Costo presupuestado por vianda: ${costMoney(day.cost+day.overheadCost)} · ingredientes ${costMoney(day.cost)} + ${day.overheadPercent.toLocaleString('es-AR')}% adicional ${costMoney(day.overheadCost)}</small>`:''}<button type="button" data-edit-sales="${index}" aria-expanded="${editing}" aria-controls="sales-editor-${index}">Actualizar ventas</button> · <button type="button" data-delete-day="${index}">Eliminar jornada errónea</button></div><b>${money(day.sold*day.price)}</b></div>${editing?`<form id="sales-editor-${index}" data-sales-form="${index}" class="sales-editor"><h3>Actualizar ventas de ${esc(day.name)}</h3><p id="sales-help-${index}">Tenías ${day.sold} vendidas de ${day.made} preparadas${atHome?`, de las cuales ${atHome} son para casa`:''}. Ingresá el total acumulado: si tenías 5 y vendiste 3 más, ingresá 8.</p>${field('Total de viandas vendidas','sold','number',day.sold,`min="0" max="${available}" step="1" aria-describedby="sales-help-${index}"`)}<small>El stock, las porciones preparadas y el precio de esta jornada se conservan.</small><div class="sales-editor-actions"><button class="primary">Guardar ventas</button><button type="button" data-cancel-sales>Cancelar</button></div></form>`:''}</div>`;
}
function bindSales(){
 document.querySelectorAll('[data-delete-day]').forEach(button=>button.addEventListener('click',async()=>{
  if(cloud&&(!session||version===null||syncError||busy))return;
  const index=Number(button.dataset.deleteDay),day=state.days[index];if(!day)return;
  if(day.id&&(state.orders||[]).some(o=>o.day===day.id)){alert('Esta jornada tiene pedidos vinculados. Reasignalos o eliminá las cargas erróneas desde Pedidos antes de eliminar la jornada.');return}
  if(familyPortions(state,day)){alert('Esta jornada tiene viandas registradas para la familia. Corregí o anulá primero esos consumos desde Familia.');return}
  const recipe=state.recipes.find(r=>r.id===day.recipe);
  let consumed;try{const originalConsumed=day.consumed||recipe?.items.map(i=>({id:i.id,qty:recipeQuantity(i,state.stock.find(s=>s.id===i.id))*day.made/recipe.yield,unit:state.stock.find(s=>s.id===i.id).unit}));consumed=originalConsumed?.map(i=>({...i,qty:convertQuantity(i.qty,i.unit||state.stock.find(s=>s.id===i.id)?.unit,state.stock.find(s=>s.id===i.id)?.unit)}))}catch{alert('No se pudo convertir el consumo de esta jornada. Revisá sus unidades.');return}
  if(!consumed||!consumed.every(i=>state.stock.some(s=>s.id===i.id)&&Number.isFinite(i.qty)&&i.qty>=0)){alert('No se puede reconstruir el consumo de esta jornada. Revisá los ingredientes antes de eliminarla.');return}
  const detail=consumed.map(i=>{const s=state.stock.find(s=>s.id===i.id);return i.qty.toLocaleString('es-AR',{maximumFractionDigits:6})+' '+s.unit+' de '+s.name}).join('\n');
  if(!confirm('¿Eliminar la jornada de '+day.name+' del '+day.date+' ('+day.made+' preparadas, '+day.sold+' vendidas)? Se quitarán su producción y sus ventas del resumen. Usá esto solo para una carga errónea, no para comida sobrante.\n\nSe devolverá al stock:\n'+detail+(!day.consumed?'\n\nEste registro antiguo no guardó el consumo original: se calculó usando la receta ACTUAL. Continuá solo si coincide con la receta usada al cargarlo.':'')))return;
  for(const i of consumed)state.stock.find(s=>s.id===i.id).qty+=i.qty;
  state.days.splice(index,1);editingSales=null;message='';
  if(await save()){message='Jornada errónea eliminada. Ingredientes devueltos al stock; resumen actualizado.';render()}
 }));

 document.querySelectorAll('[data-edit-sales]').forEach(button=>button.addEventListener('click',()=>{
  if(cloud&&(!session||version===null||syncError||busy))return;
  const index=Number(button.dataset.editSales);if(!state.days[index])return;
  if(dirty&&!confirm('Hay un formulario sin guardar. ¿Descartarlo para actualizar estas ventas?'))return;
  editingSales=index;dirty=false;message='';render();
  document.querySelector(`[data-sales-form="${index}"] input[name="sold"]`)?.focus();
 }));
 document.querySelector('[data-cancel-sales]')?.addEventListener('click',()=>{editingSales=null;dirty=false;render()});
 document.querySelector('[data-sales-form]')?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(cloud&&(!session||version===null||syncError||busy))return;
  const day=state.days[Number(event.currentTarget.dataset.salesForm)];
  if(!day){message='La jornada cambió. Actualizá los datos antes de editar.';editingSales=null;render();return}
  const sold=decimal(new FormData(event.currentTarget).get('sold')),available=day.made-familyPortions(state,day);
  if(!Number.isInteger(sold)||sold<0||sold>available){alert(`Ingresá un total entero entre 0 y ${available} viandas vendidas. Las porciones para casa ya están reservadas.`);return}
  day.sold=sold;editingSales=null;message='';
  if(await save()){message='Ventas actualizadas. El stock no cambió.';render()}
 });
}
function packageFields(){return `<div class="package-counter"><label class="check-label"><input type="checkbox" name="packaged">Contar paquetes, bolsas o cajas</label><div class="package-fields form-grid" hidden>${field('Cantidad de paquetes','packageCount','number',1,'min="1" step="1" disabled')}${field('Contenido de cada paquete','packageSize','number',1,'min="0" step="any" disabled')}<label>Unidad del contenido<select name="packageUnit" disabled>${unitOptions()}</select></label><p class="package-help">Indicá el contenido real. Ej.: 15 paquetes de 500 g son 7,5 kg.</p></div></div>`}
function updatePackages(form,unit){
 const enabled=form.elements.packaged.checked;
 form.querySelector('.package-fields').hidden=!enabled;
 for(const key of ['packageCount','packageSize','packageUnit'])form.elements[key].disabled=!enabled;
 if(!compatible(form.elements.packageUnit.value,unit))setUnitSelect(form.elements.packageUnit,unit);
 else if(form.dataset.packageBase!==unit)setUnitSelect(form.elements.packageUnit,unit,form.elements.packageUnit.value);
 form.dataset.packageBase=unit;form.elements.qty.readOnly=enabled;
 if(enabled){try{form.elements.qty.value=inputQuantity(packageQuantity(decimal(form.elements.packageCount.value),decimal(form.elements.packageSize.value),form.elements.packageUnit.value,unit),unit)}catch{form.elements.qty.value=''}}
}
function stock(){return `<section><h2>Freezer y despensa</h2><p>Para el primer conteo, cargá el total que hay. Después usá «Sumar compra»: se agrega a lo disponible y podés poner un precio diferente cada vez.</p><div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th>Disponible</th><th>Precio actual para recetas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${state.stock.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${formatQuantity(x.qty,x.unit)} ${esc(x.unit)}</td><td>${rate(x.cost)} / ${esc(x.unit)}</td><td><span class="tag ${x.qty<=x.min?'warn':''}">${x.qty<=x.min?'Comprar pronto':'En orden'}</span></td><td class="stock-actions"><button class="primary" data-restock="${x.id}">＋ Sumar compra</button><button data-edit="${x.id}">Ajustar inventario / precio</button><button data-view-purchases="${x.id}">Ver compras y precios</button></td></tr>`).join('')}</tbody></table></div>${state.stock.length?'':empty('Agregá el inventario que cuenten en la cocina. La cantidad no tiene un tope fijo.')}</section><section><h2 id="stock-title">Inventario inicial / nuevo ingrediente</h2><p id="stock-purpose">Ingresá lo que hay hoy. Este conteo no registra un pago. Las reposiciones se cargan con «Sumar compra».</p><form id="stock"><input type="hidden" name="id"><div class="form-grid">${field('Nombre','name')}<label>Unidad del stock<select name="unit">${unitOptions()}</select></label>${field('Cantidad total disponible','qty','number',0,'min="0" step="any"')}${field('Precio actual de referencia ($)','cost','number',0,'min="0" step="any"')}<label>Precio por<select name="costUnit">${unitOptions(compatibleUnits('kg'),'kg')}</select></label>${field('Avisar cuando quede','min','number',1,'min="0" step="any"')}</div>${stockCorrectionFields()}${packageFields()}<p id="stock-unit-help" class="hint" aria-live="polite"></p><button id="save-stock" class="primary">Guardar inventario y precio</button><button type="button" id="cancel-stock">Cancelar edición / nuevo ingrediente</button></form></section>`}
function purchaseHistory(){
 const movements=[...state.expenses].reverse();
 return movements.length?movements.map(x=>{const item=state.stock.find(i=>i.id===x.ingredient),unit=x.unit||item?.unit;return `<div class="row" data-movement-product="${esc(x.ingredient||'')}" ${purchaseFilter&&purchaseFilter!==x.ingredient?'hidden':''}><div><b>${esc(item?.name||x.detail||x.category||'Movimiento')}</b><small>${esc(x.date)} · ${esc(x.category||(x.kind==='stock'?'Compra para stock':'Otro gasto'))}</small>${x.createdAt?`<small>Cargado: ${esc(new Date(x.createdAt).toLocaleString('es-AR'))}</small>`:''}${x.detail&&item?`<small>${esc(x.detail)}</small>`:''}${item?`<small>${formatQuantity(x.qty,unit)} ${esc(unit)} · ${rate(x.total/x.qty)} / ${esc(unit)}</small>`:''}${x.packages?`<small>${x.packages.count} paquetes de ${formatQuantity(x.packages.size,x.packages.unit)} ${esc(x.packages.unit)} · ${costMoney(x.total/x.packages.count)} por paquete</small>`:''}${x.id?`<button data-purchase="${x.id}">Editar compra</button> <button data-delete-purchase="${x.id}">Eliminar</button>`:'<small>Registro anterior: sin vínculo al ingrediente; se conserva en el historial.</small>'}</div><b>${costMoney(x.total)}</b></div>`}).join(''):empty('Todavía no hay movimientos. Podés crear un producto directamente al cargar tu primera compra.');
}
function purchases(){return `<div class="columns"><section><h2 id="purchase-title">Sumar compra / registrar gasto</h2><form id="purchase"><input name="id" type="hidden"><label>Tipo de movimiento<select name="kind"><option value="stock">Compra de ingrediente o insumo</option><option value="other">Otro gasto</option></select></label><div id="purchase-stock-fields"><label>Ingrediente o insumo<select name="ingredient"><option value="">Elegir producto del stock</option>${options()}<option value="__new">＋ Crear ingrediente o insumo</option></select></label><div id="new-ingredient" hidden>${field('Nombre del producto','newName','text','','disabled placeholder="Ej.: harina, mayonesa, arroz, envases"')}<label>Unidad del stock<select name="newUnit">${unitOptions()}</select></label></div><p id="purchase-unit" class="muted"></p>${packageFields()}</div><label>Categoría<input name="category" list="expense-categories" placeholder="Elegí o escribí una categoría"><datalist id="expense-categories">${['Carnes','Verduras','Almacén','Condimentos','Envases','Limpieza','Gas y servicios','Reparto','Trabajo','Otros'].map(c=>`<option value="${c}">`).join('')}</datalist></label>${field('Fecha de la compra','date','date',today())}<label>Detalle (opcional)<input name="detail" placeholder="Ej.: oferta en el mayorista"></label><div id="purchase-qty" class="form-grid">${field('Cantidad total comprada','qty','number',1,'min="0" step="any"')}<label>Unidad de la compra<select name="purchaseUnit">${unitOptions(compatibleUnits('kg'),'kg')}</select></label></div><label id="purchase-price-mode">Cómo cargar el precio<select name="priceMode"><option value="total">Total pagado por la compra</option><option value="unit">Precio por unidad o paquete</option></select></label><div class="form-grid"><label id="purchase-price"><span id="purchase-price-label">Precio por kg ($)</span><input name="unitPrice" inputmode="decimal" data-number min="0" readonly></label>${field('Total pagado ($)','total','number','','min="0.01" step="any"')}</div><div id="purchase-estimate" class="purchase-preview" aria-live="polite"></div><button class="primary">Guardar movimiento</button><button type="button" id="cancel-purchase">Cancelar edición / nuevo movimiento</button></form><p class="hint">Cada compra guarda su cantidad, precio y fecha. El precio de la compra guardada o corregida pasa a ser el precio actual para calcular nuevas recetas y producciones; las jornadas anteriores conservan su costo. Podés corregir el precio actual desde Stock. No hay un tope fijo de cantidad.</p></section><section id="purchase-history"><h2>Historial de compras y precios</h2><label>Filtrar por producto<select id="purchase-filter"><option value="">Todos los movimientos</option>${options()}</select></label>${purchaseHistory()}<p id="purchase-filter-empty" class="empty" hidden>Este producto todavía no tiene compras registradas.</p></section></div>`}
function changeStockUnitForEdit(current,edited,form){
 if(form.dataset.unit!==edited.unit)throw Error('Primero aplicá la equivalencia para corregir la unidad.');
 let next=structuredClone(current);
 for(const change of form.unitChanges||[])next=changeStockUnit(next,edited.id,change.to,change.equivalence);
 return next;
}
function setUnitSelect(select,base,selected){select.innerHTML=unitOptions(compatibleUnits(base),selected||base)}
function updatePurchaseFields(){
 const f=document.querySelector('#purchase');if(!f)return;
 const stock=f.elements.kind.value==='stock',fresh=f.elements.ingredient.value==='__new';
 for(const id of ['purchase-stock-fields','purchase-qty','purchase-price-mode','purchase-price'])document.getElementById(id).hidden=!stock;
 f.elements.ingredient.required=stock;f.elements.ingredient.disabled=!stock;f.elements.qty.disabled=!stock;f.elements.purchaseUnit.disabled=!stock;f.elements.packaged.disabled=!stock;f.elements.priceMode.disabled=!stock;f.elements.unitPrice.disabled=!stock;
 f.elements.newName.disabled=!stock||!fresh;f.elements.newUnit.disabled=!stock||!fresh;document.querySelector('#new-ingredient').hidden=!fresh;
 const item=state.stock.find(i=>i.id===f.elements.ingredient.value),base=fresh?f.elements.newUnit.value:item?.unit;
 const key=`${f.elements.ingredient.value}:${base}`;
 if(base&&f.dataset.unitKey!==key){setUnitSelect(f.elements.purchaseUnit,base);f.dataset.unitKey=key}
 const unit=f.elements.purchaseUnit.value;
 updatePackages(f,unit);
 if(!stock)for(const key of ['packageCount','packageSize','packageUnit'])f.elements[key].disabled=true;
 document.querySelector('#purchase-unit').textContent=base?`Disponible: ${formatQuantity(item?.qty||0,base)} ${base}. Las compras se suman a esta cantidad. Podés comprar en ${compatibleUnits(base).join(' o ')}.`:'Elegí un producto o crealo acá mismo.';
 const qty=decimal(f.elements.qty.value),priceQty=f.elements.packaged.checked?decimal(f.elements.packageCount.value):qty,byUnit=stock&&f.elements.priceMode.value==='unit';
 f.elements.total.readOnly=byUnit;f.elements.unitPrice.readOnly=!byUnit;f.elements.unitPrice.required=byUnit;
 document.querySelector('#purchase-price-label').textContent=`Precio por ${f.elements.packaged.checked?'paquete':unit} ($)`;
 if(byUnit){const price=decimal(f.elements.unitPrice.value);f.elements.total.value=Number.isFinite(price)&&Number.isFinite(priceQty)&&priceQty>0?inputQuantity(price*priceQty,'unidad'):''}
 else if(stock){const total=decimal(f.elements.total.value);f.elements.unitPrice.value=Number.isFinite(total)&&priceQty>0?inputQuantity(total/priceQty,'unidad'):''}
 const total=decimal(f.elements.total.value),previous=state.expenses.find(x=>x.id===f.elements.id.value),preview=document.querySelector('#purchase-estimate');
 preview.textContent='';
 if(stock&&Number.isFinite(qty)&&Number.isFinite(total)&&qty>0&&total>0&&base&&compatible(unit,base)){
  try{
   const normalized=convertQuantity(qty,unit,base),available=(item?.qty||0)-(previous?.kind==='stock'&&previous.ingredient===item?.id?convertQuantity(previous.qty,previous.unit||base,base):0)+normalized;
   const unitCost=total/normalized;
   if(!Number.isFinite(available)||!Number.isFinite(unitCost))throw Error('Revisá la cantidad y el precio.');
   preview.textContent=`${formatQuantity(qty,unit)} ${unit} = ${formatQuantity(normalized,base)} ${base}. Disponible después de guardar: ${formatQuantity(available,base)} ${base}. Precio actual: ${rate(item?.cost||0)} → ${rate(unitCost)} por ${base}. Total pagado: ${costMoney(total)}. Se usará este nuevo precio para los próximos cálculos.`;
  }catch(error){preview.textContent=error.message}
 }
}
function filterPurchases(){
 const select=document.querySelector('#purchase-filter');if(!select)return;
 select.value=purchaseFilter;
 const rows=[...document.querySelectorAll('[data-movement-product]')];
 for(const row of rows)row.hidden=Boolean(purchaseFilter&&row.dataset.movementProduct!==purchaseFilter);
 document.querySelector('#purchase-filter-empty').hidden=!purchaseFilter||rows.some(row=>!row.hidden);
}
function openPurchases(id){
 purchaseFilter=id;tab='Compras';message='';render();
 const f=document.querySelector('#purchase');f.elements.ingredient.value=id;updatePurchaseFields();
 f.scrollIntoView({behavior:'smooth'});
}
function stockCorrectionFields(){return `<div id="stock-unit-correction" class="unit-correction" hidden><h3>Corregir la unidad del producto</h3><p id="stock-equivalence-label"></p><div class="form-grid">${field('Equivale a','equivalenceQty','number','','min="0" step="any" disabled placeholder="Ej.: 900"')}<label>Medida equivalente<select name="equivalenceUnit" disabled>${unitOptions()}</select></label></div><p>Indicá el contenido real de cada unidad actual. Ej.: una botella puede contener 900 ml. Si solo cargaste mal el nombre de la unidad, indicá 1 en la nueva medida.</p><p id="stock-equivalence-preview" aria-live="polite"></p><button type="button" id="apply-stock-equivalence">Aplicar equivalencia</button><p>Después podés ajustar el total contado y el precio. Los cambios se guardan al pulsar «Guardar inventario y precio».</p></div>`}
function stockEquivalence(form){return {quantity:decimal(form.elements.equivalenceQty.value),unit:form.elements.equivalenceUnit.value}}
function applyStockEquivalence(){
 const f=document.querySelector('#stock'),from=f.dataset.unit,to=f.elements.unit.value;
 if(!f.elements.id.value||compatible(from,to))return;
 try{
  const equivalence=stockEquivalence(f),factor=stockUnitFactor(from,to,equivalence),values={};
  for(const key of ['qty','min'])values[key]=decimal(f.elements[key].value)*factor;
  values.cost=decimal(f.elements.cost.value)/convertQuantity(1,f.elements.costUnit.value,from)/factor;
  if(!Object.values(values).every(n=>Number.isFinite(n)&&n>=0)||['qty','min','cost'].some(key=>decimal(f.elements[key].value)>0&&values[key]===0))throw Error('Revisá las cantidades, el precio y la equivalencia: la conversión es demasiado grande o demasiado pequeña.');
  const packageSize=f.elements.packaged.checked?convertQuantity(decimal(f.elements.packageSize.value),f.elements.packageUnit.value,from)*factor:null;
  if(packageSize!=null&&(!Number.isFinite(packageSize)||packageSize<=0))throw Error('Revisá el contenido de cada paquete.');
  // Validar también los movimientos antes de modificar los campos del formulario.
  let preview=structuredClone(state);
  for(const change of f.unitChanges||[])preview=changeStockUnit(preview,f.elements.id.value,change.to,change.equivalence);
  changeStockUnit(preview,f.elements.id.value,to,equivalence);
  f.unitChanges||=[];f.unitChanges.push({to,equivalence});
  for(const [key,value] of Object.entries(values))f.elements[key].value=inputQuantity(value,to);
  if(packageSize!=null){f.elements.packageSize.value=inputQuantity(packageSize,to);setUnitSelect(f.elements.packageUnit,to,to)}
  setUnitSelect(f.elements.costUnit,to,to);f.dataset.unit=to;updateStockFields();
 }catch(error){alert(error.message)}
}
function updateStockFields(event){
 const f=document.querySelector('#stock');if(!f)return;
 const unit=f.elements.unit.value,from=f.dataset.unit||unit,existing=Boolean(f.elements.id.value),pending=existing&&!compatible(from,unit);
 const panel=f.querySelector('#stock-unit-correction');panel.hidden=!pending;
 for(const key of ['qty','cost','costUnit','min','packaged'])f.elements[key].disabled=pending;
 for(const key of ['equivalenceQty','equivalenceUnit'])f.elements[key].disabled=!pending;
 f.querySelector('#save-stock').disabled=pending;
 if(pending){
  if(f.dataset.pendingTo!==unit){f.elements.equivalenceQty.value='';setUnitSelect(f.elements.equivalenceUnit,unit,unit);f.dataset.pendingTo=unit;panel.scrollIntoView({behavior:'smooth',block:'center'})}
  for(const key of ['packageCount','packageSize','packageUnit'])f.elements[key].disabled=true;
  f.querySelector('#stock-equivalence-label').textContent=`¿A cuánto equivale 1 ${from} del producto en la nueva medida?`;
  let preview='Completá la equivalencia y aplicala para habilitar el ajuste.';
  try{const factor=stockUnitFactor(from,unit,stockEquivalence(f)),qty=decimal(f.elements.qty.value)*factor,cost=decimal(f.elements.cost.value)/convertQuantity(1,f.elements.costUnit.value,from)/factor;if(Number.isFinite(qty)&&Number.isFinite(cost))preview=`1 ${from} = ${formatQuantity(factor,unit)} ${unit}. Disponible: ${formatQuantity(qty,unit)} ${unit}. Precio equivalente: ${rate(cost)} por ${unit}. También se convertirán las cantidades de recetas, compras y consumos; los importes históricos se conservan.`}catch{}
  f.querySelector('#stock-equivalence-preview').textContent=preview;
  document.querySelector('#stock-unit-help').textContent='Para cambiar entre unidades, peso o volumen, primero indicá la equivalencia de este producto.';
  return;
 }
 f.dataset.pendingTo='';
 if(event?.target===f.elements.unit&&from!==unit){
  if(compatible(from,unit))for(const key of ['qty','min']){const value=decimal(f.elements[key].value);if(Number.isFinite(value))f.elements[key].value=inputQuantity(convertQuantity(value,from,unit),unit)}
  if(existing){f.unitChanges||=[];f.unitChanges.push({to:unit})}
 }
 if(!compatible(f.elements.costUnit.value,unit))setUnitSelect(f.elements.costUnit,unit,unit);
 else if(f.dataset.unit!==unit)setUnitSelect(f.elements.costUnit,unit,f.elements.costUnit.value);
 f.dataset.unit=unit;updatePackages(f,unit);
 const price=decimal(f.elements.cost.value),priceUnit=f.elements.costUnit.value;
 document.querySelector('#stock-unit-help').textContent=Number.isFinite(price)?`Precio ingresado: ${rate(price)} por ${priceUnit}. Equivale a ${rate(price/convertQuantity(1,priceUnit,unit))} por ${unit}. Al cambiar la medida, las cantidades vinculadas conservan su equivalencia. Los importes históricos no cambian.`:'Elegí la unidad del stock y la unidad del precio.';
}

function validateNumbers(form){for(const el of form.querySelectorAll('[data-number]:not(:disabled)')){if(!el.required&&!el.value.trim())continue;const n=el.readOnly&&el.value.trim()?Number(el.value.replace(',','.')):decimal(el.value);if(!Number.isFinite(n)||n<Number(el.getAttribute('min')||0)||(el.hasAttribute('data-integer')&&!Number.isInteger(n))){alert(`Revisá «${el.closest('label')?.firstChild?.textContent||'cantidad'}». Usá un número válido${el.hasAttribute('data-integer')?' entero':''}, mayor o igual a ${el.getAttribute('min')||0}. Podés usar coma o punto, sin separadores de miles.`);el.focus();return false}}return true}
function applyPurchase(next,previous){for(const change of purchaseChanges(state.stock,next,previous))Object.assign(state.stock.find(i=>i.id===change.id),change)}

function recipes(){return `<section><h2>Tus menús</h2>${state.recipes.map(r=>{
 const c=recipeCosts(r,state.stock);
 return `<div class="row"><div><b>${esc(r.name)}</b><small>Rinde ${r.yield} porciones · venta ${money(r.price)}</small><small>${r.items.map(i=>`${formatQuantity(i.qty,i.unit||state.stock.find(x=>x.id===i.id)?.unit)} ${esc(i.unit||state.stock.find(x=>x.id===i.id)?.unit||'')} de ${esc(state.stock.find(x=>x.id===i.id)?.name||'')}`).join(' · ')}</small></div><div><b>${costMoney(c.perPortion)}</b><small>costo estimado por vianda</small><small>Ingredientes: ${costMoney(c.ingredientPerPortion)}</small><small>Adicional ${c.percent.toLocaleString('es-AR')}%: ${costMoney(c.extraPerPortion)}</small><button data-recipe="${r.id}">Editar receta</button></div></div>`;
}).join('')||empty('Creá tu primer menú abajo.')}</section><section><h2 id="recipe-title">Nueva receta</h2><form id="recipe"><input name="id" type="hidden"><div class="form-grid">${field('Nombre del menú','name')}${field('Rinde (porciones)','yield','number',20,'min="1" step="1"')}${field('Precio de venta por vianda ($)','price','number',6500,'min="0" step="any"')}${field('Gastos adicionales (%)','overheadPercent','number',0,'min="0" step="any" aria-describedby="recipe-overhead-help"')}</div><div class="recipe-overhead"><p id="recipe-overhead-help">Sumá un porcentaje sobre el costo de los ingredientes para estimar electricidad, mano de obra, condimentos o envases que no hayas incluido en la receta. Ej.: $2.000 de ingredientes + 10% = $2.200 por vianda. El precio de venta se define en su propio campo.</p><button type="button" id="recipe-overhead-10">Aplicar 10% de gastos adicionales</button></div><h3>Ingredientes de toda la preparación</h3><div id="recipe-items">${ingredientRow()}</div><div id="recipe-estimate" class="notice" aria-live="polite"></div><button type="button" id="add-item">+ Agregar ingrediente</button><p class="muted">Cada cantidad corresponde a toda la preparación. Elegí g, kg, ml, L o unidades por ingrediente; el costo y el stock se convierten automáticamente.</p><button class="primary">Guardar receta</button></form></section>`}
function ingredientRow(item={}){
 const stock=state.stock.find(s=>s.id===item.id)||state.stock[0];
 const unit=item.unit||(item.id?stock?.unit:stock?.unit==='kg'?'g':stock?.unit==='litro'?'ml':stock?.unit)||'kg';
 return `<div class="ingredient-row"><label>Ingrediente<select name="item">${state.stock.map(s=>`<option value="${s.id}" ${s.id===(item.id||stock?.id)?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Cantidad<input aria-label="Cantidad del ingrediente" name="amount" type="text" inputmode="decimal" data-number min="0.001" value="${inputQuantity(item.qty??1,unit)}" required></label><label>Unidad<select name="itemUnit">${unitOptions(compatibleUnits(stock?.unit||'kg'),unit)}</select></label><button type="button" class="remove-item" aria-label="Quitar ingrediente">×</button><small class="ingredient-cost"></small></div>`;
}
function ingredientEstimate(f,event){
 let total=0,valid=true;
 for(const row of f.querySelectorAll('.ingredient-row')){
  const stock=state.stock.find(s=>s.id===row.querySelector('[name=item]').value),select=row.querySelector('[name=itemUnit]');
  if(event?.target===row.querySelector('[name=item]')&&stock)setUnitSelect(select,stock.unit,compatible(select.value,stock.unit)?select.value:stock.unit==='kg'?'g':stock.unit==='litro'?'ml':stock.unit);
  const qty=decimal(row.querySelector('[name=amount]').value),unit=select.value,output=row.querySelector('.ingredient-cost');
  if(!stock||!Number.isFinite(qty)||!(qty>0)||!compatible(unit,stock.unit)){valid=false;output.textContent='Elegí un ingrediente, una cantidad y una unidad compatibles.';continue}
  let used;try{used=convertQuantity(qty,unit,stock.unit)}catch{valid=false;output.textContent='La cantidad es demasiado grande.';continue}const amount=used*stock.cost;if(!Number.isFinite(amount)){valid=false;output.textContent='Revisá la cantidad o el precio: el costo es demasiado grande.';continue}total+=amount;
  output.textContent=`${formatQuantity(qty,unit)} ${unit} = ${formatQuantity(used,stock.unit)} ${stock.unit} · ${rate(stock.cost)} por ${stock.unit} · Costo del ingrediente: ${costMoney(amount)}`;
 }
 return {total,valid};
}
function updateRecipeEstimate(event){
 const f=document.querySelector('#recipe');if(!f)return;
 const {valid}=ingredientEstimate(f,event);
 const portions=decimal(f.elements.yield.value);
 const output=document.querySelector('#recipe-estimate');
 if(!valid||!f.querySelectorAll('.ingredient-row').length||!Number.isInteger(portions)||portions<=0){output.textContent='Agregá ingredientes y un rendimiento entero para calcular el costo.';return}
 try{
  const items=[...f.querySelectorAll('.ingredient-row')].map(row=>({id:row.querySelector('[name=item]').value,qty:decimal(row.querySelector('[name=amount]').value),unit:row.querySelector('[name=itemUnit]').value}));
  const c=recipeCosts({items,yield:portions,overheadPercent:decimal(f.elements.overheadPercent.value)},state.stock);
  output.innerHTML=`<dl class="cost-breakdown"><div><dt>Ingredientes por porción</dt><dd>${costMoney(c.ingredientPerPortion)}</dd></div><div><dt>Gastos adicionales (${c.percent.toLocaleString('es-AR')}%)</dt><dd>${costMoney(c.extraPerPortion)}</dd></div><div class="cost-total"><dt>Costo estimado por vianda</dt><dd>${costMoney(c.perPortion)}</dd></div></dl><small>Toda la preparación: ${costMoney(c.total)} · ${portions} porciones. Ingredientes: ${costMoney(c.ingredients)} + adicional: ${costMoney(c.extra)}.</small>`;
 }catch(error){output.textContent=error.message}
}

function family(){
 const entries=(state.family||[]).filter(x=>x.date.startsWith(familyMonth)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
 return `<div class="notice"><b>Cuatro en casa, un mismo stock.</b> Registrá solo lo que efectivamente usaron. Este consumo queda identificado como familiar y no genera ventas ni un nuevo pago.</div><section><h2 id="family-title">Registrar consumo familiar</h2><form id="family"><input type="hidden" name="id"><label>¿Qué consumieron?<select name="kind"><option value="ingredients">Ingredientes sueltos del stock</option><option value="recipe">Preparar una receta para casa</option><option value="prepared">Viandas de una jornada ya preparada</option></select></label><div class="form-grid">${field('Fecha del consumo','date','date',today(),`max="${today()}"`)}<label><span id="family-portions-label">Personas que comieron</span><input name="portions" inputmode="numeric" data-number data-integer min="1" value="4" required></label></div><label>Detalle (opcional)<input name="detail" placeholder="Ej.: cena en casa" maxlength="999"></label><label id="family-recipe">Receta<select name="recipe">${state.recipes.map(r=>`<option value="${r.id}">${esc(r.name)} · rinde ${r.yield}</option>`).join('')}</select></label><label id="family-prepared">Jornada de producción<select name="day">${state.days.map((d,index)=>`<option value="${esc(d.id||`day:${index}`)}">${esc(d.date)} · ${esc(d.name)} · ${d.made-Math.max(d.sold,orderPortions(state,d))-familyPortions(state,d)} disponibles</option>`).join('')}</select></label><div id="family-ingredients"><h3>Cantidades totales para casa</h3><div id="family-items">${ingredientRow()}</div><button type="button" id="family-add-item">＋ Agregar ingrediente</button><p>Indicá el total usado entre todos: si cocinaron 500 g para cuatro, ingresá 500 g.</p></div><p id="family-mode-help"></p><div id="family-estimate" class="notice" aria-live="polite"></div><button class="primary">Guardar consumo familiar</button><button type="button" id="family-cancel">Cancelar edición / nuevo consumo</button></form></section><section><div class="section-title"><h2>Historial familiar</h2><label>Elegir mes<input id="family-month" type="month" value="${familyMonth}" max="${today().slice(0,7)}"></label></div><p>${entries.length} consumos registrados · costo estimado ${costMoney(entries.reduce((sum,x)=>sum+x.total,0))}</p>${entries.length?entries.map(x=>`<div class="row family-record"><div><b>${esc(x.name)}</b><small>${esc(x.date)} · ${x.portions} ${x.kind==='ingredients'?'personas':'porciones'} · ${x.kind==='prepared'?'Viandas ya preparadas':x.kind==='recipe'?'Receta preparada para casa':'Ingredientes del stock'}</small>${x.detail?`<small>${esc(x.detail)}</small>`:''}${x.consumed.length?`<small>${x.consumed.map(i=>`${formatQuantity(i.qty,i.unit)} ${esc(i.unit)} de ${esc(i.name)}`).join(' · ')}</small>`:'<small>Los ingredientes ya se descontaron al producir la jornada.</small>'}<button data-family-edit="${esc(x.id)}">Corregir consumo</button><button data-family-delete="${esc(x.id)}">Anular carga errónea</button></div><b>${costMoney(x.total)}</b></div>`).join(''):empty('No hay consumo familiar registrado en este mes.')}</section>`;
}
function familyInput(form){return {id:form.elements.id.value||'preview',kind:form.elements.kind.value,date:form.elements.date.value,detail:form.elements.detail.value.trim(),portions:decimal(form.elements.portions.value),recipe:form.elements.recipe.value,day:form.elements.day.value,items:[...form.querySelectorAll('.ingredient-row')].map(row=>({id:row.querySelector('[name=item]').value,qty:decimal(row.querySelector('[name=amount]').value),unit:row.querySelector('[name=itemUnit]').value}))}}
function updateFamilyForm(event){
 const form=document.querySelector('#family');if(!form)return;
 const kind=form.elements.kind.value;
 for(const [id,enabled] of [['family-ingredients',kind==='ingredients'],['family-recipe',kind==='recipe'],['family-prepared',kind==='prepared']]){
  const group=document.getElementById(id);group.hidden=!enabled;
  for(const input of group.querySelectorAll('input,select,button'))input.disabled=!enabled;
 }
 form.elements.recipe.required=kind==='recipe';form.elements.day.required=kind==='prepared';
 document.querySelector('#family-portions-label').textContent=kind==='ingredients'?'Personas que comieron':'Porciones para casa';
 document.querySelector('#family-mode-help').textContent=kind==='prepared'?'Elegí viandas que ya registraron en Hoy. Solo se asignan a la familia las porciones disponibles; los ingredientes no vuelven a descontarse.':kind==='recipe'?'Calculamos todos los ingredientes e insumos según el rendimiento de la receta. Para variar cantidades o no usar envases, elegí ingredientes sueltos. Si la comida ya está registrada en una jornada, elegí «Viandas de una jornada ya preparada».':'Estas cantidades se descuentan una sola vez del stock, sin multiplicarlas por las personas.';
 if(kind==='ingredients')ingredientEstimate(form,event);
 const output=document.querySelector('#family-estimate');
 try{
  const input=familyInput(form),entry=familyEntry(state,input,today()),previous=(state.family||[]).find(x=>x.id===input.id);
  const needs=entry.consumed.map(i=>{
   const stock=state.stock.find(s=>s.id===i.id),old=previous?.consumed.find(c=>c.id===i.id),available=stock.qty+(old?convertQuantity(old.qty,old.unit,stock.unit):0),qty=convertQuantity(i.qty,i.unit,stock.unit);
   return `${formatQuantity(i.qty,i.unit)} ${i.unit} de ${i.name}${qty>available+1e-9?' (no alcanza el stock)':''}`;
  }).join(' · ');
  output.textContent=`Costo familiar estimado: ${costMoney(entry.total)}.${needs?` Se usará: ${needs}.`:' Se asignan las porciones a la familia.'}${previous?' Al corregir se conserva el precio original de los ingredientes ya registrados.':''}`;
 }catch(error){output.textContent=error.message}
}
function bindFamily(){
 document.querySelector('#family-month')?.addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value<=today().slice(0,7)){familyMonth=e.target.value;render()}});
 document.querySelector('#family-add-item')?.addEventListener('click',()=>{document.querySelector('#family-items').insertAdjacentHTML('beforeend',ingredientRow());updateFamilyForm()});
 document.querySelector('#family-items')?.addEventListener('click',e=>{if(e.target.closest('.remove-item')){e.target.closest('.ingredient-row').remove();updateFamilyForm()}});
 document.querySelector('#family')?.addEventListener('input',updateFamilyForm);document.querySelector('#family')?.addEventListener('change',updateFamilyForm);updateFamilyForm();
 document.querySelector('#family-cancel')?.addEventListener('click',()=>render());
 document.querySelector('#family')?.addEventListener('submit',async e=>{
  e.preventDefault();if(cloud&&(!session||version===null||syncError||busy))return;
  const input=familyInput(e.target);input.id=e.target.elements.id.value||crypto.randomUUID();
  try{state=saveFamily(state,input,today())}catch(error){alert(error.message);return}
  familyMonth=input.date.slice(0,7);message='';if(await save()){message='Consumo familiar guardado. Stock y porciones actualizados; sin registrar una venta ni otro pago.';render()}
 });
 document.querySelectorAll('[data-family-edit]').forEach(button=>button.onclick=()=>{
  if(cloud&&(!session||version===null||syncError||busy))return;
  const entry=(state.family||[]).find(x=>x.id===button.dataset.familyEdit),form=document.querySelector('#family');
  if(!entry)return;
  for(const key of ['id','kind','date','detail','portions','recipe','day'])if(entry[key]!=null)form.elements[key].value=entry[key];
  if(entry.kind==='ingredients')document.querySelector('#family-items').innerHTML=entry.items.map(i=>ingredientRow(i)).join('');
  document.querySelector('#family-title').textContent='Corregir consumo familiar';updateFamilyForm();form.scrollIntoView({behavior:'smooth'});
 });
 document.querySelectorAll('[data-family-delete]').forEach(button=>button.onclick=async()=>{
  if(cloud&&(!session||version===null||syncError||busy))return;
  const entry=(state.family||[]).find(x=>x.id===button.dataset.familyDelete);if(!entry)return;
  if(!confirm(`¿Anular la carga de ${entry.name} del ${entry.date}? Usalo solo si se cargó por error. ${entry.kind==='prepared'?'Las porciones volverán a quedar disponibles; el stock de ingredientes no cambia.':'Los ingredientes registrados volverán al stock.'}`))return;
  try{state=removeFamily(state,entry.id)}catch(error){alert(error.message);return}
  message='';if(await save()){message='Carga familiar anulada. Disponibilidad restituida.';render()}
 });
}

function recipeBudget(r){return r.overheadEstimate>0?`<section><h2>Presupuesto de recetas del mes</h2><div class="row"><span>Ingredientes para el negocio</span><b>${costMoney(r.production)}</b></div><div class="row"><span>Gastos adicionales presupuestados</span><b>${costMoney(r.overheadEstimate)}</b></div><div class="row"><span>Costo total presupuestado</span><b>${costMoney(r.productionBudget)}</b></div><p>Importes calculados con el porcentaje de cada receta al registrar la producción. Sirven para costear las viandas. El resultado del negocio usa los ingredientes consumidos y los gastos reales registrados; el porcentaje no se descuenta otra vez como si fuera un pago.</p></section>`:''}
const percent=n=>n===null?'Sin datos':new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:1}).format(n);
const monthName=m=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1));
const change=(value,previous,hasData)=>!hasData?'Sin base comparable':previous===0?(value===0?'Sin variación':'Sin base mayor a cero'):`${value>=previous?'+':''}${percent((value-previous)/previous)} vs. mes anterior`;
function summary(){const r=report(state,selectedMonth,today()),p=r.previous,max=Math.max(1,...r.trend.map(t=>t.sales));return `<section class="month-picker"><div><h2>Control mensual</h2><p>${esc(r.comparisonLabel)} · Solo registros hasta hoy.</p></div><label>Elegir mes<input id="report-month" type="month" value="${selectedMonth}" max="${today().slice(0,7)}"></label></section><div class="notice">Ventas registradas: se consideran cobradas. El saldo muestra ventas menos compras y gastos pagados; no es el saldo bancario. Las compras incluyen el stock compartido de la familia y el negocio. El resultado estimado usa los ingredientes destinados al negocio y los gastos reales registrados. Los porcentajes adicionales de recetas se muestran como presupuesto, para evitar sumarlos otra vez a los gastos pagados. El consumo familiar se muestra aparte, sin generar una venta ni otro pago. Las viandas para casa se separan del costo de su jornada; los ingredientes sueltos se descuentan solo del stock. ${r.current?'Mes en curso: comparación parcial con el mismo tramo del mes anterior.':''}</div><div class="stats"><article><small>Ventas del mes</small><strong>${money(r.sales)}</strong><span>${change(r.sales,p.sales,Boolean(p.days.length)&&Boolean(r.days.length))}</span></article><article><small>Compras y gastos pagados</small><strong>${money(r.outflow)}</strong><span>${r.expenses.length} movimientos registrados</span></article><article><small>Saldo de movimientos</small><strong>${money(r.cash)}</strong><span>Ventas − compras − otros gastos pagados</span></article><article><small>Resultado estimado</small><strong>${money(r.profit)}</strong><span>Ventas − producción para el negocio − otros gastos</span></article><article><small>Viandas vendidas / preparadas</small><strong>${r.sold} <em>/ ${r.made}</em></strong><span>${r.atHome} para casa · ${r.left} disponibles · ${r.dates} días registrados</span></article><article><small>Porcentaje vendido para el negocio</small><strong>${percent(r.sellThrough)}</strong><span>Margen estimado sobre ventas: ${percent(r.margin)}</span></article><article><small>Consumo familiar del mes</small><strong>${money(r.familyCost)}</strong><span>${r.family.length} registros de casa · costo de ingredientes</span></article></div>${recipeBudget(r)}<div class="columns"><section><h2>Ventas de los últimos seis meses</h2><p>Importes nominales, sin ajuste por inflación. Un mes sin registros no confirma que no hubo ventas.</p><div class="sales-chart">${r.trend.map(t=>`<div class="chart-row"><span>${esc(monthName(t.month))}${t.month===today().slice(0,7)?' *':''}</span><div class="chart-track"><div style="width:${t.sales/max*100}%"></div></div><b>${money(t.sales)}</b></div>`).join('')}</div><small class="muted">* Mes en curso. Consultá las cantidades antes de interpretar un aumento de precios como crecimiento.</small></section><section><h2>Volumen y ritmo de venta</h2><div class="row"><span>Viandas vendidas</span><b>${r.sold}<small>${change(r.sold,p.sold,Boolean(p.days.length)&&Boolean(r.days.length))}</small></b></div><div class="row"><span>Promedio por día registrado</span><b>${r.dates?(r.sold/r.dates).toLocaleString('es-AR',{maximumFractionDigits:1}):'Sin datos'}<small>Anterior: ${p.dates?(p.sold/p.dates).toLocaleString('es-AR',{maximumFractionDigits:1}):'Sin datos'}</small></b></div><div class="row"><span>Precio promedio vendido</span><b>${r.sold?money(r.sales/r.sold):'Sin datos'}</b></div><p>Los días sin cargar no se incluyen en el promedio. Para comparar bien, registrá también las jornadas con cero ventas.</p></section></div><section><h2>Acciones para mejorar el negocio</h2><p>Orientaciones basadas en lo registrado; no son pronósticos ni garantizan ventas.</p><div class="advice-grid">${advice(r).map(a=>`<article><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></article>`).join('')}</div></section><section><h2>¿Qué menús rindieron mejor en ${esc(monthName(selectedMonth))}?</h2><p>Ordenados por contribución total: ventas menos costo de las porciones destinadas al negocio. Las porciones para casa se muestran aparte. Todavía no reparte gastos generales entre menús.</p>${r.menus.length?`<div class="table-wrap"><table><thead><tr><th>Menú</th><th>Días</th><th>Preparadas</th><th>Vendidas</th><th>Para casa</th><th>Disponibles</th><th>Ventas</th><th>Contribución total</th><th>Por vendida</th></tr></thead><tbody>${r.menus.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td>${m.dates}</td><td>${m.made}</td><td>${m.sold}</td><td>${m.family}</td><td>${m.made-m.sold-m.family}</td><td>${money(m.sales)}</td><td>${money(m.contribution)}</td><td>${m.perSold===null?'Sin ventas':money(m.perSold)}</td></tr>`).join('')}</tbody></table></div>`:empty('Todavía no hay jornadas registradas en este mes.')}</section><div class="columns"><section><h2>¿En qué salió el dinero?</h2>${r.categories.length?r.categories.map(([category,total])=>`<div class="row"><span>${esc(category)}</span><b>${money(total)}</b></div>`).join(''):empty('No hay compras o gastos registrados en este mes.')}<div class="row"><span>Ingredientes usados para el negocio</span><b>${money(r.production)}</b></div><p>El consumo es parte del resultado estimado; no es otra salida de dinero para sumar a las compras.</p></section><section><h2>Jornadas del mes</h2>${r.days.length?[...r.days].sort((a,b)=>b.date.localeCompare(a.date)).map(d=>daySalesRow(d,true)).join(''):empty('Cargá una jornada desde Hoy. Podés elegir una fecha anterior.')}</section></div>`}
function validateBackup(s){const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;const str=v=>typeof v==='string'&&v.length<1000;const id=v=>str(v)&&v.length>0;const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));if(!s||!['stock','recipes','days','expenses'].every(k=>Array.isArray(s[k])&&s[k].length<=10000))throw Error('No es una copia de Filo válida.');const ids=new Set();for(const x of s.stock){if(!x||!id(x.id)||ids.has(x.id)||!str(x.name)||!units.includes(x.unit)||![x.qty,x.cost,x.min].every(num)||(x.unitCorrections!=null&&(!Array.isArray(x.unitCorrections)||x.unitCorrections.length>10000||!x.unitCorrections.every(c=>c&&units.includes(c.from)&&units.includes(c.to)&&!compatible(c.from,c.to)&&num(c.quantity)&&c.quantity>0&&str(c.at)&&Number.isFinite(Date.parse(c.at))))))throw Error('Ingrediente inválido.');ids.add(x.id)}const recipes=new Set();for(const r of s.recipes){if(!r||!id(r.id)||recipes.has(r.id)||!str(r.name)||!Number.isInteger(r.yield)||r.yield<=0||!num(r.price)||(r.overheadPercent!=null&&!num(r.overheadPercent))||!Array.isArray(r.items)||!r.items.length||!r.items.every(i=>i&&ids.has(i.id)&&num(i.qty)&&i.qty>0&&(i.unit==null||compatible(i.unit,s.stock.find(x=>x.id===i.id)?.unit))))throw Error('Receta inválida.');recipeCosts(r,s.stock);recipes.add(r.id)}for(const d of s.days)if(!d||!date(d.date)||!str(d.name)||!recipes.has(d.recipe)||!Number.isInteger(d.made)||d.made<1||!Number.isInteger(d.sold)||d.sold<0||d.sold>d.made||!num(d.price)||!num(d.cost)||((d.overheadPercent!=null||d.overheadCost!=null)&&(!num(d.overheadPercent)||!num(d.overheadCost)||Math.abs(d.cost*(d.overheadPercent/100)-d.overheadCost)>1e-6))||(d.consumed!=null&&(!Array.isArray(d.consumed)||!d.consumed.every(i=>i&&ids.has(i.id)&&num(i.qty)&&(i.unit==null||compatible(i.unit,s.stock.find(x=>x.id===i.id)?.unit))))))throw Error('Jornada inválida.');const expenses=new Set();for(const x of s.expenses){if(!x||!['stock','other'].includes(x.kind)||!str(x.detail)||!date(x.date)||!num(x.total)||!num(x.qty)||(x.category!=null&&!str(x.category))||(x.createdAt!=null&&(!str(x.createdAt)||!Number.isFinite(Date.parse(x.createdAt))))||(x.updatedAt!=null&&(!str(x.updatedAt)||!Number.isFinite(Date.parse(x.updatedAt))))||(x.packages!=null&&(x.kind!=='stock'||!Number.isInteger(x.packages.count)||x.packages.count<=0||!num(x.packages.size)||x.packages.size<=0||!compatible(x.packages.unit,x.unit||s.stock.find(i=>i.id===x.ingredient)?.unit)))||(x.kind==='stock'&&x.unit!=null&&!compatible(x.unit,s.stock.find(i=>i.id===x.ingredient)?.unit))||(x.ingredient!=null&&(!ids.has(x.ingredient)||x.qty<=0))||(x.id!=null&&(!id(x.id)||expenses.has(x.id)||(x.kind==='stock'&&!ids.has(x.ingredient)))))throw Error('Movimiento inválido.');if(x.id)expenses.add(x.id)} validateFamily(s);validateOrders(s); }
function bind(){document.querySelector('#report-month')?.addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value<=today().slice(0,7)){selectedMonth=e.target.value;render()}});document.querySelector('#login')?.addEventListener('submit',async e=>{e.preventDefault();const email=new FormData(e.target).get('email');busy=true;render();const {error}=await cloud.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}});message=error?error.message:'Revisá tu correo y abrí el enlace de acceso en este dispositivo.';busy=false;render()});
document.querySelector('#refresh-cloud')?.addEventListener('click',refreshCloud);
document.querySelectorAll('[data-recover-edit]').forEach(button=>button.onclick=()=>{if(!session)showLogin();else refreshCloud()});
document.querySelector('#logout')?.addEventListener('click',async()=>{if(dirty&&!confirm('¿Cerrar sesión y descartar el formulario sin guardar?'))return;const {error}=await cloud.auth.signOut();if(error){message=error.message;render();return}session=null;version=null;state={demo:false,stock:[],recipes:[],days:[],expenses:[]};message='Sesión cerrada.';render()});
document.querySelector('#export-before-cloud')?.addEventListener('click',()=>download(JSON.parse(localStorage.getItem('filo-before-cloud')),`filo-antes-de-conectar-${today()}.json`));
document.querySelector('#export-draft')?.addEventListener('click',()=>download(JSON.parse(localStorage.getItem('filo-unsent')),`filo-borrador-${today()}.json`));
document.querySelectorAll('form').forEach(f=>f.addEventListener('input',()=>dirty=true));
document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{if(!validateNumbers(f)){e.preventDefault();e.stopImmediatePropagation();}},true));bindSales();bindFamily();bindOrders();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;message='';editingSales=null;render()});document.querySelector('#clear-demo')?.addEventListener('click',()=>{if(confirm(cloud?'¿Vaciar los datos compartidos para toda la familia? Exportá una copia antes.':'¿Borrar todos los registros e ingredientes para empezar de cero? Exportá una copia si ya cargaste datos.')){state={demo:false,stock:[],recipes:[],days:[],expenses:[]};save()}});
document.querySelector('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`filo-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
document.querySelector('#import').onclick=()=>document.querySelector('#import-file').click();
document.querySelector('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('Archivo demasiado grande.');const next=JSON.parse(await file.text());validateBackup(next);if(!confirm('Importar reemplaza todos los datos actuales (para TODA la familia si está conectado a Supabase). No combina cambios. Exportá una copia antes. ¿Reemplazar?'))return;state=next;message=cloud?'Copia importada para toda la familia.':'Copia importada solo en este navegador; no se sincroniza automáticamente.';save()}catch(error){alert('No se pudo importar: '+error.message)}};
document.querySelector('#stock')?.addEventListener('submit',e=>{e.preventDefault();if(cloud&&(!session||version===null||syncError||busy))return;const d=new FormData(e.target);const x={id:d.get('id')||crypto.randomUUID(),name:d.get('name').trim(),unit:d.get('unit'),qty:decimal(d.get('qty')),cost:decimal(d.get('cost')),min:decimal(d.get('min'))};if(!x.name)return;if(![x.qty,x.cost,x.min].every(Number.isFinite)){alert('Revisá las cantidades y el precio del inventario.');return}if(state.stock.some(i=>i.id!==x.id&&i.name.toLocaleLowerCase()===x.name.toLocaleLowerCase())){alert('Ese producto ya existe. Elegilo en el listado para editarlo.');return}try{x.cost=x.cost/convertQuantity(1,d.get('costUnit'),x.unit);if(!Number.isFinite(x.cost))throw Error('El precio es demasiado grande.');const next=changeStockUnitForEdit(state,x,e.target),idx=next.stock.findIndex(i=>i.id===x.id);idx<0?next.stock.push(x):next.stock[idx]={...next.stock[idx],...x};validateBackup(next);state=next}catch(error){alert(error.message);return}message='Inventario y precio guardados. La cantidad indica el total disponible.';save()});
document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>startStockAction(b.dataset.edit,'edit'));
document.querySelector('#cancel-stock')?.addEventListener('click',()=>render());
document.querySelector('#apply-stock-equivalence')?.addEventListener('click',applyStockEquivalence);
document.querySelector('#stock')?.addEventListener('change',updateStockFields);document.querySelector('#stock')?.addEventListener('input',updateStockFields);updateStockFields();
document.querySelectorAll('[data-restock]').forEach(b=>b.onclick=()=>startStockAction(b.dataset.restock,'purchase'));
document.querySelectorAll('[data-view-purchases]').forEach(b=>b.onclick=()=>{openPurchases(b.dataset.viewPurchases);document.querySelector('#purchase-history').scrollIntoView({behavior:'smooth'})});
document.querySelector('#purchase-filter')?.addEventListener('change',e=>{purchaseFilter=e.target.value;filterPurchases()});filterPurchases();
document.querySelector('#cancel-purchase')?.addEventListener('click',()=>render());
document.querySelector('#purchase')?.addEventListener('input',updatePurchaseFields);
document.querySelector('#purchase')?.addEventListener('change',updatePurchaseFields);
updatePurchaseFields();
document.querySelector('#purchase')?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.target),kind=d.get('kind'),qty=kind==='stock'?decimal(d.get('qty')):0,total=decimal(d.get('total'));let ingredient=d.get('ingredient'),created;
if(kind==='stock'&&ingredient==='__new'){const name=String(d.get('newName')||'').trim();if(!name){alert('Escribí el nombre del producto.');return}if(state.stock.some(i=>i.name.toLocaleLowerCase()===name.toLocaleLowerCase())){alert('Ese producto ya existe: elegilo en el listado.');return}created={id:crypto.randomUUID(),name,unit:d.get('newUnit'),qty:0,cost:0,min:0};ingredient=created.id;}
if(kind==='stock'&&!created&&!state.stock.some(i=>i.id===ingredient)){alert('Elegí o creá un producto.');return}
const previous=state.expenses.find(x=>x.id===d.get('id'));const next={id:previous?.id||crypto.randomUUID(),kind,ingredient:kind==='stock'?ingredient:null,qty,unit:kind==='stock'?d.get('purchaseUnit'):undefined,total,detail:String(d.get('detail')||'').trim(),category:String(d.get('category')||'').trim(),date:d.get('date'),createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
if(!/^\d{4}-\d{2}-\d{2}$/.test(next.date)||!Number.isFinite(Date.parse(next.date))){alert('Elegí una fecha válida para la compra.');return}
if(kind==='stock'&&e.target.elements.packaged.checked)next.packages={count:decimal(d.get('packageCount')),size:decimal(d.get('packageSize')),unit:d.get('packageUnit')};
if(created)state.stock.push(created);try{applyPurchase(next,previous)}catch(error){if(created)state.stock.pop();alert(error.message);return}
if(previous)state.expenses[state.expenses.indexOf(previous)]=next;else state.expenses.push(next);
message=previous?'Movimiento corregido. Stock ajustado por la diferencia.':kind==='stock'?'Compra sumada al stock con su nuevo precio.':'Gasto guardado.';save();});
document.querySelectorAll('[data-purchase]').forEach(b=>b.onclick=()=>{
 const x=state.expenses.find(x=>x.id===b.dataset.purchase),f=document.querySelector('#purchase');
 f.elements.packaged.checked=false;f.elements.priceMode.value='total';
 for(const k of ['id','kind','ingredient','category','date','detail','qty','total'])f.elements[k].value=x[k]??'';
 document.querySelector('#purchase-title').textContent='Editar compra o gasto';updatePurchaseFields();
 if(x.kind==='stock')f.elements.purchaseUnit.value=x.unit||state.stock.find(i=>i.id===x.ingredient).unit;
 updatePurchaseFields();
 if(x.packages){f.elements.packaged.checked=true;updatePurchaseFields();f.elements.packageCount.value=x.packages.count;f.elements.packageSize.value=x.packages.size;f.elements.packageUnit.value=x.packages.unit;updatePurchaseFields()}
 f.scrollIntoView({behavior:'smooth'});
});
document.querySelectorAll('[data-delete-purchase]').forEach(b=>b.onclick=()=>{const x=state.expenses.find(x=>x.id===b.dataset.deletePurchase);if(!confirm('¿Eliminar este movimiento? Si es una compra, se descontará del stock. El costo unitario actual se conserva; podés corregirlo en Stock.'))return;try{applyPurchase(null,x)}catch(error){alert(error.message);return}state.expenses=state.expenses.filter(e=>e!==x);message='Movimiento eliminado. El costo unitario actual se conserva.';save()});

document.querySelector('#recipe-overhead-10')?.addEventListener('click',()=>{document.querySelector('#recipe').elements.overheadPercent.value='10';dirty=true;updateRecipeEstimate()});
document.querySelector('#add-item')?.addEventListener('click',()=>{document.querySelector('#recipe-items').insertAdjacentHTML('beforeend',ingredientRow());updateRecipeEstimate()});
document.querySelector('#recipe-items')?.addEventListener('click',event=>{if(event.target.closest('.remove-item')){event.target.closest('.ingredient-row').remove();updateRecipeEstimate()}});
document.querySelector('#recipe')?.addEventListener('input',updateRecipeEstimate);document.querySelector('#recipe')?.addEventListener('change',updateRecipeEstimate);updateRecipeEstimate();
document.querySelectorAll('[data-recipe]').forEach(button=>button.onclick=()=>{const recipe=state.recipes.find(x=>x.id===button.dataset.recipe),f=document.querySelector('#recipe');['id','name','yield','price'].forEach(key=>f.elements[key].value=recipe[key]);f.elements.overheadPercent.value=inputQuantity(recipe.overheadPercent??0,'unidad');document.querySelector('#recipe-items').innerHTML=recipe.items.map(item=>ingredientRow(item)).join('');document.querySelector('#recipe-title').textContent='Editar receta';f.querySelector('.legacy-unit-note')?.remove();if(recipe.items.some(item=>!item.unit))f.insertAdjacentHTML('afterbegin','<p class="notice legacy-unit-note">Esta receta usaba la unidad del stock. Revisá si cada cantidad corresponde a gramos o kilos antes de guardar.</p>');updateRecipeEstimate();f.scrollIntoView({behavior:'smooth'})});
document.querySelector('#recipe')?.addEventListener('submit',event=>{
 event.preventDefault();const data=new FormData(event.target),items=[...document.querySelectorAll('.ingredient-row')].map(row=>({id:row.querySelector('[name=item]').value,qty:decimal(row.querySelector('[name=amount]').value),unit:row.querySelector('[name=itemUnit]').value}));
 if(!items.length||items.some(item=>!item.id||!(item.qty>0)||!compatible(item.unit,state.stock.find(s=>s.id===item.id)?.unit))){alert('Agregá ingredientes con cantidades y unidades compatibles.');return}
 const recipe={id:data.get('id')||crypto.randomUUID(),name:data.get('name').trim(),yield:decimal(data.get('yield')),price:decimal(data.get('price')),overheadPercent:decimal(data.get('overheadPercent')),items};
 try{recipeCosts(recipe,state.stock)}catch(error){alert(error.message);return}
 const index=state.recipes.findIndex(x=>x.id===recipe.id);index<0?state.recipes.push(recipe):state.recipes[index]=recipe;message='Receta guardada.';save();
});
document.querySelector('#day')?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.target),r=state.recipes.find(x=>x.id===d.get('recipe')),made=decimal(d.get('made')),sold=decimal(d.get('sold'));if(sold>made){alert('Las vendidas no pueden superar las preparadas.');return}const needs=new Map();r.items.forEach(i=>needs.set(i.id,(needs.get(i.id)||0)+recipeQuantity(i,state.stock.find(s=>s.id===i.id))*made/r.yield));for(const[id,qty]of needs){const i=state.stock.find(x=>x.id===id);if(!i||i.qty+1e-9<qty){alert(`No alcanza el stock de ${i?.name||'un ingrediente'}. Registrá la compra o corregí el stock.`);return}}if(!/^\d{4}-\d{2}-\d{2}$/.test(d.get('date'))||d.get('date')>today()){alert('Elegí una fecha válida, hasta hoy.');return}const c=recipeCosts(r,state.stock);for(const[id,qty]of needs)state.stock.find(x=>x.id===id).qty-=qty;state.days.push({date:d.get('date'),recipe:r.id,name:r.name,made,sold,cost:c.ingredientPerPortion,overheadPercent:c.percent,overheadCost:c.extraPerPortion,price:r.price,consumed:[...needs].map(([id,qty])=>({id,qty,unit:state.stock.find(s=>s.id===id).unit}))});message='Jornada registrada y stock actualizado.';save()});}
if(cloud){
 const cached=localStorage.getItem('filo-v1');if(cached&&!localStorage.getItem('filo-before-cloud'))localStorage.setItem('filo-before-cloud',cached);
 state={demo:false,stock:[],recipes:[],days:[],expenses:[]};
 cloud.auth.getSession().then(async({data,error})=>{session=data.session;if(error)syncError=error.message;if(session)await refreshCloud();else{busy=false;render()}}).catch(error=>{syncError=error.message;busy=false;render()});
 cloud.auth.onAuthStateChange((event,next)=>{
  session=next;
  if(event==='SIGNED_OUT'){version=null;syncError='';state={demo:false,stock:[],recipes:[],days:[],expenses:[]};render();return}
  // Deferir las consultas evita bloquear el cliente dentro del callback de autenticación.
  if(next&&['SIGNED_IN','TOKEN_REFRESHED'].includes(event)&&(version===null||syncError))setTimeout(()=>{if(!busy&&!dirty)refreshCloud()},0);
 });
}
render();
