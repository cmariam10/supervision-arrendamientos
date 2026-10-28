// Sin almacenamiento ni importación local: solo datos desde endpoint autorizado.
const fields=['codigo','direccion','matricula','cbml','activo_fijo','tipo','latitud','longitud'];
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
 const filtered=assets.filter(x=>[x.codigo].some(y=>clean(y).toLocaleLowerCase('es').includes(q)));
 $('list').replaceChildren();markerLayer.clearLayers();
 // Todos los registros localizados se dibujan, usando renderizado Canvas.
 for(const x of filtered){
  const c=coords(x);
  if(c){
   const marker=L.circleMarker(c,{renderer:canvasRenderer,radius:4,weight:1,color:'#105c53',fillOpacity:.65});
   marker.addTo(markerLayer);
   marker.bindPopup(`<strong>${escapeHTML(x.codigo)}</strong>`);
   marker.on('click',()=>select(x.codigo,false));
  }
 }
 // La lista textual se acota para evitar miles de nodos DOM; el mapa NO se acota.
 for(const x of filtered.slice(0,90)){
  const b=document.createElement('button');b.className='item'+(x.codigo===active?' active':'');
  const name=document.createElement('strong');name.textContent=x.codigo;
  const sub=document.createElement('span');sub.textContent=coords(x)?'Seleccionar inmueble':'Ubicación pendiente';
  b.append(name,sub);b.onclick=()=>select(x.codigo,true);$('list').append(b);
 }
 if(filtered.length>90){const m=document.createElement('p');m.className='hint';m.textContent='Escribe el identificador para encontrar el inmueble en la lista.';$('list').append(m)}
 if(!filtered.length)$('list').textContent='Sin resultados.';
 const selected=assets.find(x=>x.codigo===active);if(selected)showDetail(selected);
}
function select(code,fly){active=code;const x=assets.find(v=>v.codigo===code);if(!x)return;showDetail(x);const c=coords(x);if(c&&fly)map.flyTo(c,16);}
function showDetail(x){
 const arr=[['Identificador del inmueble',x.codigo],['Ubicación',coords(x)?'En el mapa':'Pendiente de georreferenciación']];
 $('detail').innerHTML=`<h2>Ficha del inmueble</h2><div class="facts">${arr.map(([k,v])=>`<div class="fact"><span>${escapeHTML(k)}</span><b>${escapeHTML(v)}</b></div>`).join('')}</div><button class="primary" id="start-report" type="button">Diligenciar informe y descargar Word</button><div class="notice">Los datos contractuales deben diligenciarse y verificarse. El respaldo centralizado de encuestas y Word sigue pendiente.</div>`;
 $('start-report').onclick=()=>openReport(x);
}

function normalize(o){
 const lower=Object.fromEntries(Object.entries(o).map(([k,v])=>[clean(k).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_'),v]));
 const aliases={codigo:['ID_INMUEBLE','ID_BIENES','CODIGO','CODIGO_BIEN','ID_BIEN'],direccion:['CONTRACTUAL_DIRECCION','DENOMINACION_CONT_DIRECCION_RESALTAR_EN_NARANJADO_SI_SE_DEBE_ACTUALIZAR','DIRECCION','DIRECCION_INMUEBLE'],matricula:['MATRICULA','MATRICULA_INMOBILIARIA'],cbml:['CBML','BD_CBML_CATASTRO'],activo_fijo:['ACTIVO_FIJO','CODIGO_ACTIVO_FIJO'],tipo:['VISOR_CATEGORIA','TIPO','TIPO_INMUEBLE'],latitud:['LATITUD','LATITUDE','LAT'],longitud:['LONGITUD','LONGITUDE','LON','LNG'],contrato:['CONTRACTUAL_CONTRATO_RADICADO','BD_AF_CONSOLIDADO_CONTRATO_RADICADO','NUMERO_DE_CONTRATO'],arrendatario:['CONTRACTUAL_ARRENDATARIO_OCUPANTE','ARRENDATARIO_OCUPANTE'],inicio:['CONTRACTUAL_FECHA_INICO_CONTRATO_RESTITUCION','BD_AF_CONSOLIDADO_CONTRATO_FEC_INICIO','INICIO'],fin:['CONTRACTUAL_FECHA_FINALIZACION_CONTRATO','BD_AF_CONSOLIDADO_CONTRATO_FEC_FINAL'],supervisor:['CONTRACTUAL_SUPERVISOR','SUPERVISOR'],origen_coordenada:['ORIGEN_COORDENADA']};
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
function openReport(asset){reportAsset=asset;const f=$('report-form');f.reset();for(const k of ['codigo','direccion','matricula','activo_fijo','cbml','arrendatario','contrato','inicio','fin']) if(f.elements[k])f.elements[k].value=asset[k]||'';f.elements.fecha_informe.value=new Date().toISOString().slice(0,10);if(['CLARA LUCÍA GIL BUSTAMANTE','MARÍA NELLY MORENO MORENO','JÁDER DARÍO VILLEGAS CARDONA'].includes(asset.supervisor))f.elements.supervisor.value=asset.supervisor;reportDialog.showModal();}
const labels={tecnico_objeto:'2.1 Cumplimiento del objeto y alcance',tecnico_obligaciones:'2.2 Cumplimiento de obligaciones',tecnico_otros:'2.3 Otros aspectos técnicos',subcontratacion:'3.1 Subcontratación',modificaciones:'3.2 Modificaciones del contrato',admin_otros:'3.4 Otros aspectos administrativos',avance_financiero:'4.1–4.3 Avance y estado financiero',incumplimientos:'4.4 Acciones por incumplimientos',hallazgos:'5.2 Resultados de inspección física',juridico:'6. Informe jurídico'};
$('report-form').onsubmit=async(e)=>{e.preventDefault();const form=e.target;const d=Object.fromEntries(new FormData(form).entries());const physical=['estructura','cerramiento','acabados','banos','cocina','servicios'];if(physical.some(k=>['Regular','Malo'].includes(d[k]))&&!clean(d.hallazgos)){notify('Describe los hallazgos de los elementos en estado Regular o Malo.');return}const photos=[...form.elements.fotos.files];if(physical.some(k=>['Regular','Malo'].includes(d[k]))&&!photos.length){notify('Adjunta al menos una fotografía de los hallazgos Regular o Malo.');return}if(!window.JSZip){notify('No se cargó la biblioteca para completar la plantilla Word.');return}
try{
 const template=await fetch('plantillas/FO-ADMI-123_V7_plantilla.docx',{cache:'no-store'});
 if(!template.ok)throw new Error('No se encontró la plantilla FO-ADMI-123');
 const zip=await JSZip.loadAsync(await template.arrayBuffer());
 let xml=await zip.file('word/document.xml').async('string');
 const formData={...d,periodo:`${d.desde||'No diligenciado'} al ${d.hasta||'No diligenciado'}`};
 const xmlEscape=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 xml=xml.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>xmlEscape(clean(formData[key])||'PENDIENTE DE DILIGENCIAR'));
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
// Los datos de data/inmuebles.json son PÚBLICOS: SOLO identificador y coordenadas.
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
