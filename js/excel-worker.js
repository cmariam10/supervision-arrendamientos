/* Procesa la hoja pesada en un Web Worker para no bloquear la interfaz. */
self.onmessage=async event=>{try{
 importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
 const workbook=XLSX.read(event.data,{type:'array',dense:true});const name=workbook.SheetNames.find(n=>/^BASE_HUB$/i.test(n))||workbook.SheetNames.find(n=>!/(indicador|resumen)/i.test(n))||workbook.SheetNames[0];
 const sheet=workbook.Sheets[name];const raw=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
 const headings=(raw[0]||[]).map(v=>String(v).trim());const keep=/^(ID_INMUEBLE|ID_BIENES|CODIGO|CODIGO_BIEN|ID_BIEN|CONTRACTUAL_DIRECCION|DENOMINACION_CONT_DIRECCION_RESALTAR_EN_NARANJADO_SI_SE_DEBE_ACTUALIZAR|DIRECCION|DIRECCION_INMUEBLE|MATRICULA|MATRICULA_INMOBILIARIA|CBML|BD_CBML_CATASTRO|ACTIVO_FIJO|CODIGO_ACTIVO_FIJO|VISOR_CATEGORIA|TIPO|TIPO_INMUEBLE|LATITUD|LATITUDE|LAT|LONGITUD|LONGITUDE|LON|LNG|CONTRACTUAL_CONTRATO_RADICADO|BD_AF_CONSOLIDADO_CONTRATO_RADICADO|NUMERO_DE_CONTRATO|CONTRACTUAL_ARRENDATARIO_OCUPANTE|ARRENDATARIO_OCUPANTE|CONTRACTUAL_FECHA_INICO_CONTRATO_RESTITUCION|BD_AF_CONSOLIDADO_CONTRATO_FEC_INICIO|INICIO|CONTRACTUAL_FECHA_FINALIZACION_CONTRATO|BD_AF_CONSOLIDADO_CONTRATO_FEC_FINAL|CONTRACTUAL_SUPERVISOR|SUPERVISOR|ORIGEN_COORDENADA)$/i;
 const indices=headings.map((h,i)=>[h,i]).filter(([h])=>keep.test(h));const rows=[];
 for(let j=1;j<raw.length;j++){const source=raw[j];if(!source)continue;const r={};for(const [k,i]of indices)if(source[i]!==undefined&&source[i]!==null&&String(source[i]).trim()!=='')r[k]=source[i];if(Object.keys(r).length)rows.push(r)}
 self.postMessage({rows});}catch(e){self.postMessage({error:e.message})}};
