// Goddess's Dashboard — Admin SPA
const API = '/api';
let token = localStorage.getItem('goddess_token');
let currentUser = null;
let currentView = 'dashboard';

// ── API Client ──
async function api(path, opts = {}) {
  const headers = { ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Toast ──
function toast(msg, type = 'info') {
  let c = document.querySelector('.g-toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'g-toast-container'; document.body.append(c); }
  const t = document.createElement('div');
  t.className = `g-toast g-toast-${type}`;
  t.textContent = msg;
  c.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Router ──
function navigate(view) {
  currentView = view;
  render();
}

// ── Render ──
function render() {
  const app = document.getElementById('app');
  if (!token) { renderLogin(app); return; }
  renderLayout(app);
}

// ── Login ──
function renderLogin(app) {
  app.innerHTML = `
    <div class="g-login-page">
      <div class="g-login-card">
        <div class="g-login-brand">
          <h1>Goddess's Dashboard</h1>
          <p>Eva Games CMS</p>
        </div>
        <div class="g-login-error" id="login-error"></div>
        <form id="login-form">
          <div class="g-field">
            <label class="g-label">Email</label>
            <input class="g-input" type="email" id="login-email" required autocomplete="email" />
          </div>
          <div class="g-field">
            <label class="g-label">Password</label>
            <input class="g-input" type="password" id="login-password" required autocomplete="current-password" />
          </div>
          <button class="g-btn g-btn-primary g-btn-lg" style="width:100%" type="submit">Sign In</button>
        </form>
        <div id="setup-area" style="margin-top:1rem;display:none">
          <p style="color:var(--g-ink-muted);font-size:0.85rem;margin-bottom:0.75rem">No accounts yet. Create the first admin:</p>
          <form id="setup-form">
            <div class="g-field"><label class="g-label">Display Name</label><input class="g-input" id="setup-name" required /></div>
            <div class="g-field"><label class="g-label">Email</label><input class="g-input" type="email" id="setup-email" required /></div>
            <div class="g-field"><label class="g-label">Password (8+ chars)</label><input class="g-input" type="password" id="setup-pass" required minlength="8" /></div>
            <button class="g-btn g-btn-success g-btn-lg" style="width:100%" type="submit">Create Account</button>
          </form>
        </div>
      </div>
    </div>`;

  // Check if setup is needed
  api('/auth/setup-required').then(d => {
    if (d.setupRequired) document.getElementById('setup-area').style.display = 'block';
  }).catch(() => {});

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await api('/auth/login', { method: 'POST', body: {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      }});
      token = data.token; currentUser = data.user;
      localStorage.setItem('goddess_token', token);
      toast('Welcome back, Goddess.', 'success');
      render();
    } catch (err) {
      const el = document.getElementById('login-error');
      el.textContent = err.message; el.style.display = 'block';
    }
  };

  const setupForm = document.getElementById('setup-form');
  if (setupForm) setupForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await api('/auth/register', { method: 'POST', body: {
        display_name: document.getElementById('setup-name').value,
        email: document.getElementById('setup-email').value,
        password: document.getElementById('setup-pass').value,
      }});
      token = data.token; currentUser = data.user;
      localStorage.setItem('goddess_token', token);
      toast('Account created. Welcome, Goddess.', 'success');
      render();
    } catch (err) {
      const el = document.getElementById('login-error');
      el.textContent = err.message; el.style.display = 'block';
    }
  };
}

// ── Main Layout ──
function renderLayout(app) {
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'games', icon: '🎮', label: 'Games' },
    { id: 'site-config', icon: '⚙️', label: 'Site Config' },
    { id: 'design', icon: '🎨', label: 'Design Tokens' },
    { id: 'footer', icon: '🔗', label: 'Footer Links' },
    { id: 'bodyart', icon: '🖼️', label: 'Body Art' },
    { id: 'history', icon: '📜', label: 'History' },
    { id: 'publish', icon: '🚀', label: 'Publish' },
  ];

  const initials = currentUser?.display_name?.split(' ').map(w => w[0]).join('').toUpperCase() || '?';

  app.innerHTML = `
    <div class="g-layout">
      <aside class="g-sidebar">
        <div class="g-sidebar-brand">
          <h1>Goddess's Dashboard</h1>
          <div class="g-brand-sub">Eva Games CMS</div>
        </div>
        <nav><ul class="g-nav">
          ${navItems.map(n => `<li><a class="g-nav-item ${currentView === n.id || (n.id==='games' && currentView.startsWith('game-edit:')) ? 'active' : ''}" data-view="${n.id}">
            <span class="g-nav-icon">${n.icon}</span>${n.label}</a></li>`).join('')}
          <li class="g-nav-divider"></li>
          <li><a class="g-nav-item" id="logout-btn"><span class="g-nav-icon">🚪</span>Sign Out</a></li>
        </ul></nav>
        <div class="g-sidebar-user">
          <div class="g-avatar">${initials}</div>
          <div class="g-user-info">
            <div class="g-user-name">${currentUser?.display_name || 'Admin'}</div>
            <div class="g-user-role">${currentUser?.role || 'admin'}</div>
          </div>
        </div>
      </aside>
      <main class="g-main" id="view-container"><div class="g-spinner"></div></main>
    </div>`;

  // Nav clicks
  app.querySelectorAll('.g-nav-item[data-view]').forEach(el => {
    el.onclick = () => navigate(el.dataset.view);
  });
  document.getElementById('logout-btn').onclick = () => {
    token = null; currentUser = null; localStorage.removeItem('goddess_token'); render();
  };

  // Load view
  loadView();
}

async function loadView() {
  const container = document.getElementById('view-container');
  try {
    if (currentView.startsWith('game-edit:')) {
      await viewGameEditor(container, currentView.split(':')[1]);
    } else switch (currentView) {
      case 'dashboard': await viewDashboard(container); break;
      case 'games': await viewGames(container); break;
      case 'site-config': await viewSiteConfig(container); break;
      case 'design': await viewDesignTokens(container); break;
      case 'footer': await viewFooterLinks(container); break;
      case 'bodyart': await viewBodyArt(container); break;
      case 'history': await viewHistory(container); break;
      case 'publish': await viewPublish(container); break;
      default: container.innerHTML = '<p>View not found.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--g-danger)">Error: ${err.message}</p>`;
  }
}

// ── Views ──

async function viewDashboard(el) {
  const [gamesData, pubData] = await Promise.all([api('/games'), api('/publish/status')]);
  const hasChanges = pubData.hasUnpublishedChanges;
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Dashboard</h2><p class="g-page-subtitle">Welcome back, Goddess.</p></div></div>
    ${hasChanges ? `<div class="g-publish-banner"><span class="g-publish-banner-text">⚡ You have unpublished changes</span>
      <button class="g-btn g-btn-primary g-btn-sm" id="quick-publish">Publish Now</button></div>` : ''}
    <div class="g-stats">
      <div class="g-stat"><div class="g-stat-value">${gamesData.games.length}</div><div class="g-stat-label">Games</div></div>
      <div class="g-stat"><div class="g-stat-value">${gamesData.games.filter(g=>g.status==='available').length}</div><div class="g-stat-label">Live</div></div>
      <div class="g-stat"><div class="g-stat-value">${hasChanges ? '⚡' : '✓'}</div><div class="g-stat-label">${hasChanges ? 'Unpublished' : 'Up to date'}</div></div>
    </div>
    <div class="g-card"><div class="g-card-header"><h3 class="g-card-title">Games</h3></div>
      <table class="g-table"><thead><tr><th>#</th><th>Title</th><th>Template</th><th>Status</th></tr></thead>
      <tbody>${gamesData.games.map(g => `<tr><td>${g.tile_number}</td><td>${g.title}</td><td>${g.template_id}</td>
        <td><span class="g-badge ${g.status==='available'?'g-badge-success':'g-badge-muted'}">${g.status}</span></td></tr>`).join('')}</tbody></table></div>`;
  
  const qp = document.getElementById('quick-publish');
  if (qp) qp.onclick = async () => { try { await api('/publish', {method:'POST'}); toast('Published!','success'); loadView(); } catch(e) { toast(e.message,'error'); } };
}

async function viewGames(el) {
  const data = await api('/games');
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Games</h2><p class="g-page-subtitle">Manage your game catalog</p></div>
      <button class="g-btn g-btn-primary" id="add-game-btn">+ Add Game</button></div>
    <div class="g-card"><table class="g-table"><thead><tr><th>#</th><th>Title</th><th>Slug</th><th>Template</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data.games.map(g => `<tr>
      <td>${g.tile_number}</td><td>${g.title}</td><td><code>${g.slug}</code></td><td>${g.template_id}</td>
      <td><span class="g-badge ${g.status==='available'?'g-badge-success':'g-badge-muted'}">${g.status}</span></td>
      <td><button class="g-btn g-btn-sm" data-edit="${g.slug}">Edit</button>
        <button class="g-btn g-btn-sm g-btn-danger" data-del="${g.slug}">Delete</button></td>
    </tr>`).join('')}</tbody></table></div>`;

  el.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => { currentView = 'game-edit:' + btn.dataset.edit; loadView(); };
  });
  el.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this game?')) return;
      try { await api(`/games/${btn.dataset.del}`, {method:'DELETE'}); toast('Deleted','success'); loadView(); } catch(e) { toast(e.message,'error'); }
    };
  });
}

async function viewDesignTokens(el) {
  const data = await api('/design-tokens');
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Design Tokens</h2><p class="g-page-subtitle">Color palette and semantic values</p></div></div>
    <div class="g-card"><table class="g-table"><thead><tr><th>Preview</th><th>Name</th><th>Value</th><th>Category</th><th></th></tr></thead>
    <tbody>${data.tokens.map(t => `<tr>
      <td><span class="g-swatch" style="background:${t.token_value.startsWith('var(') ? '#888' : t.token_value}"></span></td>
      <td><strong>${t.label}</strong><br><code style="font-size:0.72rem;color:var(--g-ink-muted)">--${t.token_name}</code></td>
      <td><input class="g-input" style="max-width:300px" value="${t.token_value}" data-token-id="${t.id}" /></td>
      <td><span class="g-badge g-badge-muted">${t.category}</span></td>
      <td><button class="g-btn g-btn-sm g-btn-primary" data-save-token="${t.id}">Save</button></td>
    </tr>`).join('')}</tbody></table></div>`;

  el.querySelectorAll('[data-save-token]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.saveToken;
      const input = el.querySelector(`[data-token-id="${id}"]`);
      try { await api(`/design-tokens/${id}`, {method:'PUT', body:{token_value:input.value}}); toast('Token updated','success'); } catch(e) { toast(e.message,'error'); }
    };
  });
}

async function viewFooterLinks(el) {
  const data = await api('/footer-links');
  const groups = { store: data.links.filter(l=>l.group_name==='store'), social: data.links.filter(l=>l.group_name==='social') };
  
  const renderGroup = (name, links) => `
    <div class="g-card"><div class="g-card-header"><h3 class="g-card-title">${name === 'store' ? '🛍️ Creator Stores' : '📱 Social Profiles'}</h3>
      <button class="g-btn g-btn-sm" data-add-link="${name}">+ Add</button></div>
    <table class="g-table"><thead><tr><th>Label</th><th>URL</th><th>Icon</th><th></th></tr></thead>
    <tbody>${links.map(l => `<tr>
      <td>${l.label}</td><td style="max-width:250px;overflow:hidden;text-overflow:ellipsis"><a href="${l.url}" target="_blank" style="color:var(--g-accent)">${l.url}</a></td>
      <td><code>${l.icon_filename}</code></td>
      <td><button class="g-btn g-btn-sm g-btn-danger" data-del-link="${l.id}">Delete</button></td>
    </tr>`).join('')}</tbody></table></div>`;

  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Footer Links</h2><p class="g-page-subtitle">Manage store and social links</p></div></div>
    ${renderGroup('store', groups.store)}${renderGroup('social', groups.social)}`;

  el.querySelectorAll('[data-del-link]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remove this link?')) return;
      try { await api(`/footer-links/${btn.dataset.delLink}`, {method:'DELETE'}); toast('Removed','success'); loadView(); } catch(e) { toast(e.message,'error'); }
    };
  });
}

async function viewBodyArt(el) {
  const data = await api('/body-art');
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Body Art</h2><p class="g-page-subtitle">Decorative images for each page</p></div></div>
    <div class="g-card"><table class="g-table"><thead><tr><th>Page</th><th>Position</th><th>Image</th></tr></thead>
    <tbody>${data.bodyArt.map(a => `<tr><td>${a.page_ref}</td><td>${a.position}</td><td><code>${a.image_filename}</code></td></tr>`).join('')}</tbody></table></div>`;
}

async function viewHistory(el) {
  const data = await api('/history');
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Edit History</h2><p class="g-page-subtitle">Audit log of all changes</p></div></div>
    <div class="g-card"><table class="g-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Action</th></tr></thead>
    <tbody>${data.history.map(h => `<tr>
      <td style="white-space:nowrap">${new Date(h.created_at+'Z').toLocaleString()}</td>
      <td>${h.user_name||'System'}</td><td>${h.entity_type} #${h.entity_id}</td>
      <td><span class="g-badge ${h.action==='publish'?'g-badge-success':'g-badge-muted'}">${h.action}</span></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function viewPublish(el) {
  const data = await api('/publish/status');
  const lastPub = data.status?.last_published_at ? new Date(data.status.last_published_at+'Z').toLocaleString() : 'Never';
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Publish</h2><p class="g-page-subtitle">Deploy your changes to the live site</p></div></div>
    <div class="g-card">
      <p style="margin-bottom:1rem">Last published: <strong>${lastPub}</strong></p>
      <p style="margin-bottom:1.5rem;color:${data.hasUnpublishedChanges?'var(--g-warning)':'var(--g-success)'}">
        ${data.hasUnpublishedChanges ? '⚡ You have unpublished changes' : '✓ Site is up to date'}</p>
      <button class="g-btn g-btn-primary g-btn-lg" id="publish-btn" ${data.hasUnpublishedChanges?'':'disabled'}>🚀 Publish Now</button>
      <div id="publish-log" style="margin-top:1rem"></div>
    </div>`;

  document.getElementById('publish-btn').onclick = async () => {
    const log = document.getElementById('publish-log');
    log.innerHTML = '<div class="g-spinner"></div><p style="text-align:center;color:var(--g-ink-muted)">Generating site...</p>';
    try {
      const result = await api('/publish', {method:'POST'});
      log.innerHTML = `<p style="color:var(--g-success)">✓ Published ${result.files.length} files</p>
        <ul style="margin-top:0.5rem;padding-left:1.25rem;color:var(--g-ink-muted);font-size:0.82rem">
        ${result.files.map(f=>`<li>${f}</li>`).join('')}</ul>`;
      toast('Site published!', 'success');
    } catch (e) { log.innerHTML = `<p style="color:var(--g-danger)">✗ ${e.message}</p>`; toast(e.message, 'error'); }
  };
}

async function viewSiteConfig(el) {
  const data = await api('/site-config');
  const c = data.config;
  const fields = [
    ['site_title','Site Title'],['meta_description','Meta Description'],['canonical_url','Canonical URL'],
    ['theme_color','Theme Color'],['og_title','OG Title'],['og_description','OG Description'],
    ['brand_text','Brand Text'],['brand_link','Brand Link'],
  ];
  el.innerHTML = `
    <div class="g-page-header"><div><h2 class="g-page-title">Site Config</h2><p class="g-page-subtitle">Global site settings and metadata</p></div></div>
    <div class="g-card">
      <form id="config-form">
        ${fields.map(([k,l]) => `<div class="g-field"><label class="g-label">${l}</label>
          <input class="g-input" name="${k}" value="${(c[k]||'').replace(/"/g,'&quot;')}" /></div>`).join('')}
        <button class="g-btn g-btn-primary" type="submit">Save</button>
      </form>
    </div>`;
  document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target); const cfg = {};
    for (const [k,v] of fd.entries()) cfg[k] = v;
    try { await api('/site-config',{method:'PUT',body:{config:cfg}}); toast('Config saved','success'); } catch(err) { toast(err.message,'error'); }
  };
}

async function viewGameEditor(el, slug) {
  const data = await api(`/games/${slug}`);
  if (!data.game) { el.innerHTML = '<p>Game not found.</p>'; return; }
  const g = data.game, settings = {}, tmpl = data.template;
  for (const s of data.settings) { try { settings[s.setting_key] = JSON.parse(s.setting_value); } catch { settings[s.setting_key] = s.setting_value; } }

  const simpleSettings = (tmpl?.settings||[]).filter(s => !s.advanced);
  const advSettings = (tmpl?.settings||[]).filter(s => s.advanced);

  const renderField = (def) => {
    const val = settings[def.key] !== undefined ? settings[def.key] : def.default;
    let input;
    if (def.type === 'textarea') input = `<textarea class="g-textarea" name="${def.key}">${val}</textarea>`;
    else if (def.type === 'boolean') input = `<label class="g-toggle"><input type="checkbox" name="${def.key}" ${val?'checked':''} /><span class="g-toggle-track"></span> ${val?'On':'Off'}</label>`;
    else if (def.type === 'number') input = `<input class="g-input" type="number" name="${def.key}" value="${val}" ${def.validation?.min!==undefined?'min="'+def.validation.min+'"':''} ${def.validation?.max!==undefined?'max="'+def.validation.max+'"':''} />`;
    else if (def.type === 'select') input = `<select class="g-select" name="${def.key}">${(def.options||[]).map(o=>`<option value="${o.value}" ${o.value==val?'selected':''}>${o.label}</option>`).join('')}</select>`;
    else input = `<input class="g-input" name="${def.key}" value="${String(val).replace(/"/g,'&quot;')}" />`;
    return `<div class="g-field"><label class="g-label">${def.label}</label>${input}<p class="g-help">${def.description}</p></div>`;
  };

  el.innerHTML = `
    <div class="g-page-header"><div>
      <h2 class="g-page-title">${g.title}</h2>
      <p class="g-page-subtitle">Template: ${g.template_id} · Slug: ${g.slug}</p>
    </div><button class="g-btn" id="back-to-games">← Back</button></div>

    <div class="g-card"><div class="g-card-header"><h3 class="g-card-title">Game Info</h3></div>
      <form id="game-meta-form">
        <div class="g-field"><label class="g-label">Title</label><input class="g-input" name="title" value="${g.title.replace(/"/g,'&quot;')}" /></div>
        <div class="g-field"><label class="g-label">Tile Number</label><input class="g-input" name="tile_number" value="${g.tile_number}" /></div>
        <div class="g-field"><label class="g-label">Status</label>
          <select class="g-select" name="status"><option value="available" ${g.status==='available'?'selected':''}>Available</option><option value="coming_soon" ${g.status==='coming_soon'?'selected':''}>Coming Soon</option><option value="reserved" ${g.status==='reserved'?'selected':''}>Reserved</option></select></div>
        <div class="g-field"><label class="g-label">Status Label</label><input class="g-input" name="status_label" value="${g.status_label.replace(/"/g,'&quot;')}" /></div>
        <button class="g-btn g-btn-primary" type="submit">Save Info</button>
      </form>
    </div>

    ${simpleSettings.length ? `<div class="g-card"><div class="g-card-header"><h3 class="g-card-title">Settings</h3></div>
      <form id="game-settings-form">${simpleSettings.map(renderField).join('')}
        ${advSettings.length ? `<button type="button" class="g-advanced-toggle" id="adv-toggle"><span class="arrow">▶</span> Advanced Settings</button>
          <div class="g-advanced-panel" id="adv-panel">${advSettings.map(renderField).join('')}</div>` : ''}
        <button class="g-btn g-btn-primary" type="submit" style="margin-top:1rem">Save Settings</button>
      </form></div>` : ''}

    <div class="g-card"><div class="g-card-header"><h3 class="g-card-title">Assets</h3></div>
      <p style="color:var(--g-ink-muted);font-size:0.82rem">${data.assets.length} asset(s) uploaded. Image upload and cropping coming soon.</p>
      ${data.assets.length ? `<table class="g-table" style="margin-top:0.75rem"><thead><tr><th>Slot</th><th>Filename</th><th>Type</th></tr></thead>
        <tbody>${data.assets.map(a=>`<tr><td>${a.slot_key}</td><td>${a.original_name}</td><td>${a.mime_type}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;

  document.getElementById('back-to-games').onclick = () => navigate('games');

  // Advanced toggle
  const advToggle = document.getElementById('adv-toggle');
  if (advToggle) advToggle.onclick = () => {
    advToggle.classList.toggle('open');
    document.getElementById('adv-panel').classList.toggle('open');
  };

  // Save game meta
  document.getElementById('game-meta-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target); const body = {};
    for (const [k,v] of fd.entries()) body[k] = v;
    try { await api(`/games/${slug}`,{method:'PUT',body}); toast('Game info saved','success'); } catch(err) { toast(err.message,'error'); }
  };

  // Save settings
  const sf = document.getElementById('game-settings-form');
  if (sf) sf.onsubmit = async (e) => {
    e.preventDefault();
    const allDefs = [...simpleSettings, ...advSettings];
    const body = {};
    for (const def of allDefs) {
      const input = sf.querySelector(`[name="${def.key}"]`);
      if (!input) continue;
      if (def.type === 'boolean') body[def.key] = input.checked;
      else if (def.type === 'number') body[def.key] = Number(input.value);
      else body[def.key] = input.value;
    }
    try { await api(`/games/${slug}/settings`,{method:'PUT',body:{settings:body}}); toast('Settings saved','success'); } catch(err) { toast(err.message,'error'); }
  };
}

// ── Init ──
(async () => {
  if (token) {
    try { const d = await api('/auth/me'); currentUser = d.user; } 
    catch { token = null; localStorage.removeItem('goddess_token'); }
  }
  render();
})();
