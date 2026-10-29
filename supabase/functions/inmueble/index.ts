// Deploy as Supabase Edge Function `inmueble` (JWT verification in code).
// Supabase secrets: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
// MAP_ID_SALT, GRAPH_DRIVE_ID, GRAPH_ITEM_ID, ALLOWED_ORIGIN, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Never put these in the public repository as values.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
const env=(key:string)=>{const v=Deno.env.get(key);if(!v)throw new Error(`Missing server secret ${key}`);return v;};
const cors=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const norm=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ');
const key=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const pick=(rec:Record<string,unknown>,name:string)=>{const k=key(name);const entry=Object.entries(rec).find(([n])=>key(n)===k);return entry?.[1]??'';};
const hex=async(input:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)))).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const idFor=async(rec:Record<string,unknown>)=> 'INM-'+(await hex(env('MAP_ID_SALT')+'|'+['CONTRATO_RADICADO','Activo fijo','LOCAL'].map(k=>norm(pick(rec,k))).join('|'))).slice(0,16);
const json=(v:unknown,status:number,origin:string)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(origin)}});
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 const allowed=env('ALLOWED_ORIGIN').replace(/\/$/,'');
 if(origin!==allowed)return json({error:'Origen no autorizado'},403,allowed);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(allowed)});
 if(req.method!=='POST')return json({error:'Método no permitido'},405,allowed);
 try{
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'Sesión requerida'},401,allowed);
  const sb=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await sb.auth.getUser(auth.slice(7));
  if(authError||!user?.email)return json({error:'Sesión inválida'},401,allowed);
  const {data:grant,error:grantError}=await sb.from('supervisores_autorizados').select('email,activo').eq('email',user.email.toLowerCase()).eq('activo',true).maybeSingle();
  if(grantError||!grant)return json({error:'Correo no autorizado'},403,allowed);
  const body=await req.json().catch(()=>null);
  if(body?.accion==='verificar')return json({autorizado:true,email:user.email},200,allowed);
  if(!body||typeof body.codigo!=='string'||!/^INM-[A-F0-9]{16}$/.test(body.codigo))return json({error:'Identificador inválido'},400,allowed);
  // App-only Graph token, obtained exclusively inside backend.
  const form=new URLSearchParams({client_id:env('AZURE_CLIENT_ID'),client_secret:env('AZURE_CLIENT_SECRET'),grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'});
  const tok=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env('AZURE_TENANT_ID'))}/oauth2/v2.0/token`,{method:'POST',body:form});
  if(!tok.ok)throw new Error('No se pudo autenticar en Microsoft Graph');
  const token=(await tok.json()).access_token;
  const file=await fetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env('GRAPH_DRIVE_ID'))}/items/${encodeURIComponent(env('GRAPH_ITEM_ID'))}/content`,{headers:{Authorization:`Bearer ${token}`},redirect:'follow'});
  if(!file.ok)throw new Error('No se pudo consultar el Excel autorizado');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const sheet=workbook.Sheets['Inventario'];if(!sheet)throw new Error('No existe la hoja Inventario');
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:'',raw:false});
  let matched:Record<string,unknown>|null=null;
  for(const rec of rows){if(await idFor(rec)===body.codigo){matched=rec;break;}}
  if(!matched)return json({error:'Registro no encontrado en Inventario'},404,allowed);
  const columns=['CONTRATO_RADICADO','ARRENDATARIO_OCUPANTE','CEDULA','Activo fijo','MATRICULA','Denominacion del activo fijo SAP','DIRECCION','SUPERVISOR','Fecha inico contrato_restitucion','Fecha finalizacion contrato','CBML','Canon Mensual'];
  const datos=Object.fromEntries(columns.map(k=>[k,pick(matched!,k)]));
  return json({codigo:body.codigo,datos},200,allowed);
 }catch(e){console.error('Private query failure',e);return json({error:'No fue posible consultar el origen privado'},502,allowed);}
});
