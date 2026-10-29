// Sin almacenamiento ni importación local: solo datos desde endpoint autorizado.
const fields=['codigo','denominacion','direccion','matricula','cbml','activo_fijo','tipo','latitud','longitud'];
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const escapeHTML=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let assets=[]; // Base recibida únicamente desde el servicio central autorizado.
let active=null;const map=L.map('map',{preferCanvas:true}).setView([6.2442,-75.5812],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);let markerLayer=L.featureGroup().addTo(map);
function notify(msg){$('toast').textContent=msg;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4200)}
function coords(x){if(x.latitud===''||x.longitud==='')return null;const lat=Number(x.latitud),lng=Number(x.longitud);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null}
function persist(){return true} // No almacenar datos institucionales en almacenamiento persistente del navegador.
const canvasRenderer=L.canvas({padding:0.3});
function draw(){
 const q=clean($('search').value).toLocaleLowerCase('es');
 const filtered=assets.filter(x=>[x.denominacion,x.codigo].some(y=>clean(y).toLocaleLowerCase('es').includes(q)));
 $('list').replaceChildren();markerLayer.clearLayers();
 // Todos los registros localizados se dibujan, usando renderizado Canvas.
 for(const x of filtered){
  const c=coords(x);
  if(c){
   const marker=L.circleMarker(c,{renderer:canvasRenderer,radius:4,weight:1,color:'#105c53',fillOpacity:.65});
   marker.addTo(markerLayer);
   marker.bindPopup(`<strong>${escapeHTML(x.denominacion||x.codigo)}</strong>`);
   marker.on('click',()=>select(x.codigo,false));
  }
 }
 // La lista textual se acota para evitar miles de nodos DOM; el mapa NO se acota.
 for(const x of filtered.slice(0,90)){
  const b=document.createElement('button');b.className='item'+(x.codigo===active?' active':'');
  const name=document.createElement('strong');name.textContent=x.denominacion||x.codigo;
  const sub=document.createElement('span');sub.textContent=coords(x)?'Seleccionar inmueble':'Ubicación pendiente';
  b.append(name,sub);b.onclick=()=>select(x.codigo,true);$('list').append(b);
 }
 if(filtered.length>90){const m=document.createElement('p');m.className='hint';m.textContent='Escribe el identificador para encontrar el inmueble en la lista.';$('list').append(m)}
 if(!filtered.length)$('list').textContent='Sin resultados.';
 const selected=assets.find(x=>x.codigo===active);if(selected)showDetail(selected);
}
function select(code,fly){active=code;const x=assets.find(v=>v.codigo===code);if(!x)return;showDetail(x);const c=coords(x);if(c&&fly)map.flyTo(c,16);}
function showDetail(x){
 const arr=[['Denominación del activo fijo SAP',x.denominacion||'Sin denominación'],['Referencia del inmueble',x.codigo],['Ubicación',coords(x)?'En el mapa':'Pendiente de georreferenciación']];
 $('detail').innerHTML=`<h2>Ficha del inmueble</h2><div class="facts">${arr.map(([k,v])=>`<div class="fact"><span>${escapeHTML(k)}</span><b>${escapeHTML(v)}</b></div>`).join('')}</div><button class="primary" id="start-report" type="button">Diligenciar informe y descargar Word</button><div class="notice">Los datos contractuales deben diligenciarse y verificarse. Toda la información precargada debe ser verificada.</div>`;
 $('start-report').onclick=()=>openReport(x);
}

function normalize(o){
 const lower=Object.fromEntries(Object.entries(o).map(([k,v])=>[clean(k).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_'),v]));
 const aliases={denominacion:['DENOMINACION','DENOMINACION_DEL_ACTIVO_FIJO_SAP'],codigo:['ID_INMUEBLE','ID_BIENES','CODIGO','CODIGO_BIEN','ID_BIEN'],direccion:['CONTRACTUAL_DIRECCION','DENOMINACION_CONT_DIRECCION_RESALTAR_EN_NARANJADO_SI_SE_DEBE_ACTUALIZAR','DIRECCION','DIRECCION_INMUEBLE'],matricula:['MATRICULA','MATRICULA_INMOBILIARIA'],cbml:['CBML','BD_CBML_CATASTRO'],activo_fijo:['ACTIVO_FIJO','CODIGO_ACTIVO_FIJO'],tipo:['VISOR_CATEGORIA','TIPO','TIPO_INMUEBLE'],latitud:['LATITUD','LATITUDE','LAT'],longitud:['LONGITUD','LONGITUDE','LON','LNG'],contrato:['CONTRACTUAL_CONTRATO_RADICADO','BD_AF_CONSOLIDADO_CONTRATO_RADICADO','NUMERO_DE_CONTRATO'],arrendatario:['CONTRACTUAL_ARRENDATARIO_OCUPANTE','ARRENDATARIO_OCUPANTE'],inicio:['CONTRACTUAL_FECHA_INICO_CONTRATO_RESTITUCION','BD_AF_CONSOLIDADO_CONTRATO_FEC_INICIO','INICIO'],fin:['CONTRACTUAL_FECHA_FINALIZACION_CONTRATO','BD_AF_CONSOLIDADO_CONTRATO_FEC_FINAL'],supervisor:['CONTRACTUAL_SUPERVISOR','SUPERVISOR'],origen_coordenada:['ORIGEN_COORDENADA']};
 const result={};for(const [key,keys] of Object.entries(aliases))result[key]=clean(keys.map(k=>lower[k]).find(v=>v!==undefined&&v!==null&&clean(v)!=='')??'');
 if(['-','.','SIN COINCIDENCIA'].includes(result.codigo)) result.codigo='';
 // Los registros agregados delimitados por punto y coma no se interpretan como un único inmueble.
 if(result.codigo.includes(';'))result.codigo='';
 for(const key of ['latitud','longitud']) if(result[key].includes(';'))result[key]='';
 return result;
}
function merge(rows){let inserted=0,updated=0,skipped=0;const indexes=new Map(assets.map((a,i)=>[a.codigo,i]));for(const r of rows){const x=normalize(r);if(!x.codigo){skipped++;continue}const idx=indexes.get(x.codigo);if(idx===undefined){indexes.set(x.codigo,assets.length);assets.push(x);inserted++}else{assets[idx]={...assets[idx],...Object.fromEntries(Object.entries(x).filter(([,v])=>v!==''))};updated++}}draw();notify(`Importación: ${inserted} nuevos, ${updated} actualizados, ${skipped} omitidos.`)}
function loadInWorker(bytes){return new Promise((resolve,reject)=>{const worker=new Worker('js/excel-worker.js');worker.onmessage=e=>{worker.terminate();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.rows)};worker.onerror=e=>{worker.terminate();reject(new Error(e.message))};worker.postMessage(bytes,[bytes]);});}
async function parseBook(blob){return loadInWorker(await blob.arrayBuffer())}
$('search').oninput=draw;$('fit').onclick=()=>{if(markerLayer.getLayers().length)map.fitBounds(markerLayer.getBounds().pad(.2));else map.setView([6.2442,-75.5812],12)};draw();

const reportDialog=$('report-modal'); let reportAsset=null;
$('close-report').onclick=()=>reportDialog.close();
// La ficha pública solo contiene nombre y coordenadas. Los campos personales y
// contractuales se consultan exclusivamente en una API privada autenticada.
function isoDate(value){
  if(!value)return '';
  const s=String(value).trim();
  const ymd=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(ymd)return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const dmy=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return dmy?`${dmy[3]}-${dmy[2]}-${dmy[1]}`:'';
}
function spanishNumber(n){
  n=Math.floor(Number(n));
  if(!Number.isFinite(n)||n<0||n>=1e12)return '';
  if(n===0)return 'cero';
  const u=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
  const t=['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const c=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  function group(x){
    if(x===100)return 'cien';
    if(x<10)return u[x];
    if(x<20)return ['diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'][x-10];
    if(x<30)return ['veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'][x-20];
    if(x<100)return t[Math.floor(x/10)]+(x%10?' y '+u[x%10]:'');
    return c[Math.floor(x/100)]+(x%100?' '+group(x%100):'');
  }
  function apocope(z){return z.replace(/veintiuno$/,'veintiún').replace(/ y uno$/,' y un').replace(/ uno$/,' un').replace(/^uno$/,'un');}
  const parts=[];
  const milmill=Math.floor(n/1e9);if(milmill)parts.push((milmill===1?'mil':apocope(group(milmill))+' mil')+' millones');
  n%=1e9;const millions=Math.floor(n/1e6);if(millions)parts.push((millions===1?'un millón':apocope(group(millions))+' millones'));
  n%=1e6;const th=Math.floor(n/1000);if(th)parts.push(th===1?'mil':apocope(group(th))+' mil');
  n%=1000;if(n)parts.push(group(n));
  return parts.join(' ');
}
function canonInWords(value){
 const n=Number(value);if(!Number.isFinite(n)||n<0||!String(value).trim())return '';
 const pesos=Math.floor(n),centavos=Math.round((n-pesos)*100);
 return (spanishNumber(pesos)+(pesos===1?' peso':' pesos')+(centavos?' con '+String(centavos).padStart(2,'0')+'/100':'')+' moneda corriente').toUpperCase();
}
function setReportFields(f,rec){
  const pairs={contrato:'CONTRATO_RADICADO',desde:'Fecha inico contrato_restitucion',hasta:'Fecha finalizacion contrato',direccion:'DIRECCION',matricula:'MATRICULA',activo_fijo:'Activo fijo',cbml:'CBML',arrendatario:'ARRENDATARIO_OCUPANTE',nit:'CEDULA',inicio:'Fecha inico contrato_restitucion',fin:'Fecha finalizacion contrato',canon:'Canon Mensual',denominacion:'Denominacion del activo fijo SAP',supervisor:'SUPERVISOR'};
  for(const [field,col] of Object.entries(pairs)){
    const el=f.elements[field];if(!el||rec[col]===undefined||rec[col]===null)continue;
    const value=['desde','hasta','inicio','fin'].includes(field)?isoDate(rec[col]):String(rec[col]).trim();
    if(value)el.value=value;
  }
  if(f.elements.canon_letras)f.elements.canon_letras.value=canonInWords(f.elements.canon.value);
}
async function openReport(asset){
 reportAsset=asset;const f=$('report-form');f.reset();
 f.elements.codigo.value=asset.codigo;
 if(f.elements.denominacion)f.elements.denominacion.value=asset.denominacion||'';
 f.elements.fecha_informe.value=new Date().toISOString().slice(0,10);
 reportDialog.showModal();
 const status=$('private-base-status');
 status.textContent='Consultando datos contractuales autorizados…';
 const url=(window.PRIVATE_REPORT_API||'').trim();
 if(!url){status.textContent='Los datos contractuales aún no se han cargado: falta configurar la consulta privada. Puedes diligenciarlos manualmente y debes verificar toda información precargada.';return;}
 try{
   // El servidor debe autenticar y autorizar la consulta. No debe habilitar acceso anónimo.
   const endpoint=url.replace(/\/$/,'')+'/inmuebles/'+encodeURIComponent(asset.codigo);
   const response=await fetch(endpoint,{credentials:'include',cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const record=await response.json();
   if(record.codigo!==asset.codigo)throw new Error('El inmueble no coincide con la ficha seleccionada');
   setReportFields(f,record.datos||{});
   status.textContent='Datos base cargados desde Inventario. Revisa la información antes de generar el Word.';
 }catch(err){status.textContent='No se pudo consultar la base privada ('+err.message+'). Los campos siguen editables.';}
}
$('report-form').elements.canon.addEventListener('input',e=>{const el=$('report-form').elements.canon_letras;if(el)el.value=canonInWords(e.target.value)});

const labels={tecnico_objeto:'2.1 Cumplimiento del objeto y alcance',tecnico_obligaciones:'2.2 Cumplimiento de obligaciones',tecnico_otros:'2.3 Otros aspectos técnicos',subcontratacion:'3.1 Subcontratación',modificaciones:'3.2 Modificaciones del contrato',admin_otros:'3.4 Otros aspectos administrativos',avance_financiero:'4.1–4.3 Avance y estado financiero',incumplimientos:'4.4 Acciones por incumplimientos',hallazgos:'5.2 Resultados de inspección física',juridico:'6. Informe jurídico'};
$('report-form').onsubmit=async(e)=>{e.preventDefault();const form=e.target;const d=Object.fromEntries(new FormData(form).entries());const physical=['estructura','cerramiento','acabados','banos','cocina','servicios'];if(physical.some(k=>['Regular','Malo'].includes(d[k]))&&!clean(d.hallazgos)){notify('Describe los hallazgos de los elementos en estado Regular o Malo.');return}const photos=[...form.elements.fotos.files];if(physical.some(k=>['Regular','Malo'].includes(d[k]))&&!photos.length){notify('Adjunta al menos una fotografía de los hallazgos Regular o Malo.');return}if(!window.JSZip){notify('No se cargó la biblioteca para completar la plantilla Word.');return}
try{
 const template=await fetch('plantillas/FO-ADMI-123_V7_plantilla.docx',{cache:'no-store'});
 if(!template.ok)throw new Error('No se encontró la plantilla FO-ADMI-123');
 const zip=await JSZip.loadAsync(await template.arrayBuffer());
 let xml=await zip.file('word/document.xml').async('string');
 const formData={...d,canon_letras:canonInWords(d.canon),periodo:`${d.desde||'No diligenciado'} al ${d.hasta||'No diligenciado'}`};
 const xmlEscape=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 xml=xml.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>xmlEscape(clean(formData[key])||'Por diligenciar'));
 // The template retains original headers, tables, page layout and photo spaces.
 zip.file('word/document.xml',xml);
 const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 const safe=k=>clean(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,65);
 a.download=`FO-ADMI-123_Informe_${safe(d.numero_informe)}_${safe(d.codigo)}.docx`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),30000);
 notify('Formato institucional FO-ADMI-123 descargado. Completa los campos y fotografías pendientes en Word; no se ha respaldado en OneDrive.');
}catch(err){console.error(err);notify('No se pudo completar la plantilla Word: '+err.message)} };

// Lectura automática de la copia mínima creada por GitHub Actions cada mes.
// data/inmuebles.json es PÚBLICO: identificador opaco, denominación comercial y coordenadas.
async function loadApprovedData(){
 const status=$('ms-status');
 const endpoint='https://raw.githubusercontent.com/cmariam10/supervision-arrendamientos/main/data/inmuebles.json';
 status.textContent='Consultando ubicación de inmuebles…';
 try{
  const response=await fetch(endpoint+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const payload=await response.json();
  if(!Array.isArray(payload.inmuebles))throw new Error('Formato de datos inválido');
  assets=payload.inmuebles.map(normalize).filter(x=>x.codigo);
  active=null;
  draw();
  status.textContent='Ubicación cargada desde la base central. La sincronización está programada mensualmente.';
 }catch(error){console.error(error);status.textContent='Todavía no está disponible la primera sincronización del mapa. Ejecuta la acción mensual en GitHub.';}
}
loadApprovedData();
