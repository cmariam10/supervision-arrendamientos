"""Lee Inventario desde un enlace compartido de OneDrive mediante Microsoft Graph.
Geocodifica direcciones de Medellín con OpenCage (clave de cuenta propia),
reutiliza coordenadas previamente publicadas, y publica SOLO códigos opacos y puntos.
NO publica el Excel, direcciones, contratos, cédulas, nombres ni información financiera.
"""
import base64
import hashlib
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from openpyxl import load_workbook

OUT = Path('data/inmuebles.json')
BOUNDS = (6.05, 6.42, -75.78, -75.38)  # zona aproximada Medellín; revisar puntos atípicos

def request(url, *, headers=None, form=None, binary=False):
    payload=urllib.parse.urlencode(form).encode() if form else None
    req=urllib.request.Request(url,data=payload,headers=headers or {},method='POST' if form else 'GET')
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            return response.read() if binary else json.load(response)
    except urllib.error.HTTPError as exc:
        body=exc.read().decode('utf-8',errors='replace')
        try:
            detail=json.loads(body)
            err=detail.get('error',{})
            message=err.get('message',str(err)) if isinstance(err,dict) else detail.get('error_description',str(err))
        except ValueError:message='Solicitud rechazada'
        raise RuntimeError(f'HTTP {exc.code}: {message[:180]}') from None

def token():
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']
    url+=('&' if '?' in url else '?')+'audience='+urllib.parse.quote('api://AzureADTokenExchange',safe='')
    assertion=request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})['value']
    tenant=os.environ['AZURE_TENANT_ID'].strip()
    result=request(f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',form={
      'client_id':os.environ['AZURE_CLIENT_ID'].strip(),
      'scope':'https://graph.microsoft.com/.default',
      'grant_type':'client_credentials',
      'client_assertion_type':'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      'client_assertion':assertion})
    return result['access_token']

def read_excel(access_token):
    # Consultar exclusivamente el archivo autorizado mediante Files.SelectedOperations.Selected.
    # Resolver /shares/... requiere acceso adicional y devolvía 403 con permisos selectivos.
    drive = 'b!rN3lIXRiLEqBrnrpDsCpSL9C27sCaXNGgiWM2lm6aiGmKI-8whwHT4Po8BEHpXPF'
    item = '01GCSG2KSPJBAPGNGOC5FIB3UGRH32MVHH'
    headers = {'Authorization': 'Bearer ' + access_token}
    base = f'https://graph.microsoft.com/v1.0/drives/{urllib.parse.quote(drive, safe="")}/items/{urllib.parse.quote(item, safe="")}'
    # Verificar acceso y evitar cargar por error otro libro.
    info = request(base + '?$select=id,name', headers=headers)
    if info.get('name') != 'Consolidado.xlsx':
        raise RuntimeError('El ID de OneDrive no corresponde a Consolidado.xlsx')
    return request(base + '/content', headers=headers, binary=True)

def norm(v):
    return re.sub(r'\s+',' ',str(v or '').strip())

def address(v):
    s=norm(v)
    # quitar números de local entre paréntesis, sin perder la nomenclatura de la vía.
    s=re.sub(r'\s*\(\s*(?:local\s*)?\d+[A-Za-z]?\s*\)','',s,flags=re.I)
    s=re.sub(r'\b(?:local|loc|oficina|apto|apartamento)\s*\d+[A-Za-z]?\b','',s,flags=re.I)
    return re.sub(r'\s+',' ',s).strip(' ,;-')

def code(row,columns):
    # Pseudónimo opaco para no publicar números de contrato.
    parts=[norm(row[columns[k]]) for k in ('CONTRATO_RADICADO','Activo fijo','LOCAL')]
    source='|'.join(parts)
    if not source.strip('|'):return None
    salt=os.environ['MAP_ID_SALT'].strip()
    return 'INM-'+hashlib.sha256((salt+'|'+source).encode()).hexdigest()[:16].upper()

def geocode(addr,key):
    query=addr+', Medellín, Antioquia, Colombia'
    params=urllib.parse.urlencode({'q':query,'key':key,'countrycode':'co','limit':3,'no_annotations':1,'language':'es'})
    resp=request('https://api.opencagedata.com/geocode/v1/json?'+params)
    for result in resp.get('results',[]):
        components=result.get('components') or {}
        geo=result.get('geometry') or {}
        lat,lon=geo.get('lat'),geo.get('lng')
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):continue
        if BOUNDS[0]<=lat<=BOUNDS[1] and BOUNDS[2]<=lon<=BOUNDS[3]:
            category=components.get('_type','')
            if category in ('city','state','county','country','administrative','suburb'):
                continue  # No inventar un punto específico usando el centro de una zona.
            return round(lat,7),round(lon,7)
    return None

def run():
    required=('AZURE_CLIENT_ID','AZURE_TENANT_ID','MAP_ID_SALT','OPENCAGE_API_KEY')
    missing=[k for k in required if not os.getenv(k,'').strip()]
    if missing:raise RuntimeError('Faltan variables/secretos: '+', '.join(missing))
    raw=read_excel(token())
    w=load_workbook(BytesIO(raw),read_only=True,data_only=True)
    if 'Inventario' not in w.sheetnames:raise RuntimeError('Falta la hoja Inventario')
    records=iter(w['Inventario'].values)
    headers=[norm(x) for x in next(records)]
    columns={h:i for i,h in enumerate(headers)}
    for name in ['DIRECCION','CONTRATO_RADICADO','Activo fijo','LOCAL','Denominacion del activo fijo SAP']:
        if name not in columns:raise RuntimeError('Falta la columna '+name)
    previous={}
    if OUT.exists():
        try:previous={row['codigo']:row for row in json.loads(OUT.read_text()).get('inmuebles',[])}
        except (ValueError,KeyError,TypeError):pass
    rows=[]; memo={}; total=0; unresolved=0; reused=0; calls=0
    key=os.environ['OPENCAGE_API_KEY'].strip()
    # Solo consultar direcciones nuevas; limitación adicional para respetar cuota del plan.
    MAX_QUERIES= int(os.getenv('MAX_GEOCODE_PER_RUN','150'))
    for row in records:
        if not any(x is not None and norm(x) for x in row):continue
        total+=1
        ident=code(row,columns)
        if not ident:continue
        # La denominación comercial del inmueble se publica únicamente para identificarlo.
        # NO se publica el registro contractual completo.
        denominacion=norm(row[columns['Denominacion del activo fijo SAP']])
        if not denominacion:
            activo=norm(row[columns['Activo fijo']])
            local=norm(row[columns['LOCAL']])
            denominacion=('Activo fijo '+activo if activo else 'Inmueble')+((' · Local '+local) if local else '')
        # Evitar valores extraños demasiado largos en la interfaz pública.
        denominacion=denominacion[:140]
        addr=address(row[columns['DIRECCION']])
        if not addr:
            rows.append({'codigo':ident,'denominacion':denominacion,'latitud':None,'longitud':None})
            unresolved+=1;continue
        old=previous.get(ident,{})
        if isinstance(old.get('latitud'),(int,float)) and isinstance(old.get('longitud'),(int,float)):
            result=(old['latitud'],old['longitud']);reused+=1
        elif addr.casefold() in memo:result=memo[addr.casefold()]
        elif calls<MAX_QUERIES:
            result=geocode(addr,key)
            memo[addr.casefold()]=result;calls+=1
            time.sleep(1.1)  # Limitar solicitudes, y no repetir la misma dirección en esta ejecución.
        else:result=None
        if result:
            rows.append({'codigo':ident,'denominacion':denominacion,'latitud':result[0],'longitud':result[1]})
        else:
            rows.append({'codigo':ident,'denominacion':denominacion,'latitud':None,'longitud':None});unresolved+=1
    if not rows:raise RuntimeError('Hoja Inventario vacía; se conserva el JSON anterior')
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'inmuebles':rows},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Registros: {len(rows)}; geocodificaciones consultadas: {calls}; reutilizadas: {reused}; sin ubicación: {unresolved}')
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as f:
            f.write(f'### Nueva base: Inventario (Consolidado.xlsx)\n\nRegistros procesados: {len(rows)}. Nuevas consultas: {calls}. Sin coordenadas: {unresolved}.\n\nNo se publicaron direcciones ni datos contractuales. Revisar precisión antes del uso operativo.\n')
if __name__=='__main__':run()
