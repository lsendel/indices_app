const API = '' // same origin — no CORS issues

const head = `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;background:#0a0a0a;color:#fafafa}
a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}
.container{max-width:1080px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #1a1a1a}
nav .logo{font-size:20px;font-weight:700;letter-spacing:-0.5px}
nav .links{display:flex;gap:16px;align-items:center}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;border:none;transition:all .15s}
.btn-primary{background:#3b82f6;color:#fff}.btn-primary:hover{background:#2563eb}
.btn-outline{background:transparent;color:#fafafa;border:1px solid #333}.btn-outline:hover{border-color:#555}
.btn-google{background:#fff;color:#1f1f1f;width:100%}
.btn-google:hover{background:#e8e8e8}
.btn-google svg{width:18px;height:18px}
.card{background:#141414;border:1px solid #262626;border-radius:12px;padding:40px}
input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid #333;background:#0a0a0a;color:#fafafa;font-size:14px;outline:none}
input:focus{border-color:#3b82f6}
label{display:block;font-size:13px;color:#a1a1aa;margin-bottom:6px}
.field{margin-bottom:16px}
.divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#555;font-size:13px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:#333}
.error{color:#ef4444;font-size:13px;margin-top:8px;display:none}
.avatar{width:36px;height:36px;border-radius:50%;background:#262626;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px}
</style>`

const googleSvg = `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`

export function landingPage() {
	return `<!DOCTYPE html><html lang="en"><head><title>Indices — Marketing Intelligence Platform</title>${head}</head>
<body>
<nav><div class="logo">Indices</div><div class="links"><a href="/login">Log in</a><a href="/login?tab=signup" class="btn btn-primary" style="text-decoration:none">Get Started</a></div></nav>
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 65px);text-align:center;padding:40px 24px">
<h1 style="font-size:clamp(36px,5vw,56px);font-weight:700;line-height:1.1;margin-bottom:20px;letter-spacing:-1px">Marketing Intelligence<br><span style="color:#3b82f6">Powered by AI</span></h1>
<p style="font-size:18px;color:#a1a1aa;max-width:560px;margin-bottom:36px;line-height:1.6">Automate content creation, manage multi-channel campaigns, and close the loop between engagement and revenue.</p>
<div style="display:flex;gap:12px"><a href="/login?tab=signup" class="btn btn-primary" style="padding:14px 32px;font-size:16px;text-decoration:none">Start Free</a><a href="/login" class="btn btn-outline" style="padding:14px 32px;font-size:16px;text-decoration:none">Log In</a></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px;margin-top:80px;max-width:800px;width:100%">
<div class="card" style="padding:24px;text-align:left"><div style="font-size:24px;margin-bottom:8px">&#9881;</div><h3 style="font-size:16px;margin-bottom:6px">Closed-Loop Analytics</h3><p style="font-size:13px;color:#888">Track engagement signals back to revenue outcomes automatically.</p></div>
<div class="card" style="padding:24px;text-align:left"><div style="font-size:24px;margin-bottom:8px">&#9998;</div><h3 style="font-size:16px;margin-bottom:6px">AI Content Generation</h3><p style="font-size:13px;color:#888">Multi-provider LLM routing for channel-optimized content at scale.</p></div>
<div class="card" style="padding:24px;text-align:left"><div style="font-size:24px;margin-bottom:8px">&#128202;</div><h3 style="font-size:16px;margin-bottom:6px">Multi-Channel Campaigns</h3><p style="font-size:13px;color:#888">Publish and measure across Instagram, LinkedIn, WhatsApp, and more.</p></div>
</div>
</div>
</body></html>`
}

export function loginPage() {
	return `<!DOCTYPE html><html lang="en"><head><title>Log In — Indices</title>${head}</head>
<body>
<nav><a href="/" class="logo" style="text-decoration:none;color:#fafafa">Indices</a></nav>
<div style="display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 57px);padding:24px">
<div class="card" style="width:100%;max-width:400px">
<h2 id="formTitle" style="font-size:24px;font-weight:600;margin-bottom:4px">Welcome back</h2>
<p id="formSubtitle" style="color:#a1a1aa;font-size:14px;margin-bottom:24px">Sign in to your account</p>

<button class="btn btn-google" onclick="googleSignIn()">${googleSvg} Continue with Google</button>
<div class="divider">or</div>

<form id="authForm" onsubmit="handleSubmit(event)">
<div class="field" id="nameField" style="display:none"><label>Name</label><input name="name" type="text" placeholder="Your name"></div>
<div class="field"><label>Email</label><input name="email" type="email" placeholder="you@example.com" required></div>
<div class="field"><label>Password</label><input name="password" type="password" placeholder="••••••••" required minlength="8"></div>
<div class="error" id="errorMsg"></div>
<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px" id="submitBtn">Sign In</button>
</form>

<p style="text-align:center;margin-top:20px;font-size:13px;color:#888">
<span id="toggleText">Don't have an account?</span> <a href="#" onclick="toggleMode(event)" id="toggleLink">Sign up</a>
</p>
</div>
</div>
<script>
const API='${API}';
let isSignup=new URLSearchParams(location.search).get('tab')==='signup';
function updateUI(){
const t=document.getElementById('formTitle'),s=document.getElementById('formSubtitle'),n=document.getElementById('nameField'),b=document.getElementById('submitBtn'),tt=document.getElementById('toggleText'),tl=document.getElementById('toggleLink');
if(isSignup){t.textContent='Create account';s.textContent='Get started with Indices';n.style.display='block';b.textContent='Sign Up';tt.textContent='Already have an account?';tl.textContent='Log in';}
else{t.textContent='Welcome back';s.textContent='Sign in to your account';n.style.display='none';b.textContent='Sign In';tt.textContent="Don't have an account?";tl.textContent='Sign up';}
}
updateUI();
function toggleMode(e){e.preventDefault();isSignup=!isSignup;updateUI();document.getElementById('errorMsg').style.display='none';}
function showError(msg){const el=document.getElementById('errorMsg');el.textContent=msg;el.style.display='block';}
async function googleSignIn(){
try{const r=await fetch(API+'/api/auth/sign-in/social',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({provider:'google',callbackURL:location.origin+'/dashboard'})});
const d=await r.json();if(d.url)location.href=d.url;else showError(d.message||'Failed to start Google sign-in');}
catch(e){showError('Network error');}
}
async function handleSubmit(e){
e.preventDefault();const f=new FormData(e.target);const email=f.get('email'),password=f.get('password'),name=f.get('name');
document.getElementById('errorMsg').style.display='none';
const endpoint=isSignup?'/api/auth/sign-up/email':'/api/auth/sign-in/email';
const body=isSignup?{email,password,name:name||email.split('@')[0]}:{email,password};
try{const r=await fetch(API+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
const d=await r.json();if(!r.ok){showError(d.message||'Authentication failed');return;}
location.href='/dashboard';}
catch(e){showError('Network error');}
}
</script>
</body></html>`
}

export function dashboardPage() {
	return `<!DOCTYPE html><html lang="en"><head><title>Dashboard — Indices</title>${head}</head>
<body>
<nav>
<a href="/dashboard" class="logo" style="text-decoration:none;color:#fafafa">Indices</a>
<div class="links"><div class="avatar" id="userAvatar"></div><a href="#" onclick="signOut()" style="font-size:13px;color:#888">Sign out</a></div>
</nav>
<div class="container" style="padding-top:40px">
<h1 id="greeting" style="font-size:28px;font-weight:600;margin-bottom:8px">Dashboard</h1>
<p style="color:#a1a1aa;margin-bottom:32px;font-size:14px" id="userEmail"></p>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:40px">
<div class="card" style="padding:24px"><p style="color:#888;font-size:13px;margin-bottom:4px">Campaigns</p><p style="font-size:32px;font-weight:700" id="statCampaigns">—</p></div>
<div class="card" style="padding:24px"><p style="color:#888;font-size:13px;margin-bottom:4px">Prospects</p><p style="font-size:32px;font-weight:700" id="statProspects">—</p></div>
<div class="card" style="padding:24px"><p style="color:#888;font-size:13px;margin-bottom:4px">Content Pieces</p><p style="font-size:32px;font-weight:700" id="statContent">—</p></div>
</div>

<div class="card" style="padding:24px">
<h3 style="margin-bottom:16px;font-size:16px">Quick Actions</h3>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<a href="https://api.indices.app/api/v1/campaigns" class="btn btn-outline" style="text-decoration:none;font-size:13px">View Campaigns</a>
<a href="https://api.indices.app/api/v1/prospects" class="btn btn-outline" style="text-decoration:none;font-size:13px">View Prospects</a>
<a href="https://api.indices.app/api/v1/content/channels" class="btn btn-outline" style="text-decoration:none;font-size:13px">Content Channels</a>
<a href="https://api.indices.app/health" class="btn btn-outline" style="text-decoration:none;font-size:13px">API Health</a>
</div>
</div>
</div>
<script>
const API='${API}';
async function loadSession(){
try{const r=await fetch(API+'/api/auth/get-session',{credentials:'include'});
if(!r.ok){location.href='/login';return;}
const d=await r.json();
if(!d.user){location.href='/login';return;}
document.getElementById('greeting').textContent='Welcome, '+d.user.name;
document.getElementById('userEmail').textContent=d.user.email;
document.getElementById('userAvatar').textContent=(d.user.name||'U')[0].toUpperCase();
}catch(e){location.href='/login';}
}
async function signOut(){
await fetch(API+'/api/auth/sign-out',{method:'POST',credentials:'include'});
location.href='/';
}
loadSession();
</script>
</body></html>`
}
