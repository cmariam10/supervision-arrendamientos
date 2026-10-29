// Autenticación individual. Invitaciones creadas únicamente por la administradora.
(function(){
 const c=window.APP_CONFIG||{};
 const $=id=>document.getElementById(id);
 let client=null;
 const status=msg=>{$('login-status').textContent=msg;};
 const ready=()=>Boolean(c.SUPABASE_URL&&c.SUPABASE_ANON_KEY&&window.supabase?.createClient);
 async function verify(session){
   if(!session){gate(null);return;}
   try{const response=await fetch(c.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/'+c.INMUEBLE_FUNCTION,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':c.SUPABASE_ANON_KEY},body:JSON.stringify({accion:'verificar'}),cache:'no-store'});if(!response.ok)throw new Error('Correo sin autorización');gate(session);}
   catch(err){gate(null);status('Tu correo no figura en la lista de supervisores autorizados.');}
 }
 function gate(session){
  $('access-gate').hidden=!!session;
  $('protected-app').hidden=!session;
  $('session-email').textContent=session?.user?.email||'';
  if(session){document.dispatchEvent(new CustomEvent('visor-session-ready'));setTimeout(()=>{window.visorResizeMap?.();},100);}
 }
 window.visorAuth={
  async token(){if(!client)return '';const {data}=await client.auth.getSession();return data.session?.access_token||'';},
  async getRecord(codigo){
    if(!client)throw new Error('Autenticación sin configurar');
    const token=await this.token();if(!token)throw new Error('Sesión requerida');
    const response=await fetch(c.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/'+c.INMUEBLE_FUNCTION,{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':c.SUPABASE_ANON_KEY},
      body:JSON.stringify({codigo}),cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Error '+response.status);
    return data;
  }
 };
 if(!ready()){status('Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js.');return;}
 client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange((_e,session)=>{setTimeout(()=>verify(session),0);});
 client.auth.getSession().then(({data})=>verify(data.session));
 $('login-form').addEventListener('submit',async e=>{
  e.preventDefault();status('Verificando acceso…');
  const email=$('login-email').value.trim().toLowerCase();
  const password=$('login-password').value;
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error){status('No se pudo iniciar sesión. Verifica tus credenciales.');return;}
  // Validate allowlist using private function before granting access to map UI.
  // Access to private records is independently checked by Edge Function.
  await verify(data.session); 
 });
 $('forgot-password').addEventListener('click',async()=>{
  const email=$('login-email').value.trim();if(!email){status('Ingresa tu correo para recuperar la contraseña.');return;}
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  status(error?'No se pudo solicitar la recuperación.':'Si la cuenta existe, recibirás instrucciones en tu correo.');
 });
 $('logout').addEventListener('click',()=>client.auth.signOut());
})();
