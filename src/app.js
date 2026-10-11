const storeKey = "rk_harvester_fresh_v1";
const supabaseConfig = window.RK_SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(
  window.supabase &&
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  !supabaseConfig.url.includes("PASTE_") &&
  !supabaseConfig.anonKey.includes("PASTE_")
);
const supabaseDb = hasSupabaseConfig
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

const seedData = {
  users: [
    { id: 1, name: "Owner", username: "owner", password: "1234", role: "owner" },
    { id: 2, name: "Ramesh", username: "ramesh", password: "1234", role: "operator" }
  ],
  customers: [
    { id: 101, name: "Mahesh Farms", mobile: "9876543210", village: "Mandya" },
    { id: 102, name: "Sri Lakshmi Fields", mobile: "9123456780", village: "Maddur" },
    { id: 103, name: "Kumar Agro", mobile: "9988776655", village: "Srirangapatna" }
  ],
  machines: [
    { id: 201, name: "Harvester 1", operator: "Ramesh" },
    { id: 202, name: "Harvester 2", operator: "Manju" },
    { id: 203, name: "Harvester 3", operator: "Unassigned" }
  ],
  work: [
    { id: 301, date: "2026-10-08", customer: "Mahesh Farms", village: "Mandya", machine: "Harvester 1", acres: 8, rate: 3000, total: 24000, paid: 18000, by: "Owner" },
    { id: 302, date: "2026-10-09", customer: "Sri Lakshmi Fields", village: "Maddur", machine: "Harvester 2", acres: 5.5, rate: 3000, total: 16500, paid: 16500, by: "Ramesh" }
  ],
  expenses: [
    { id: 401, date: "2026-10-09", machine: "Harvester 1", category: "Diesel", note: "Refill", amount: 5200, by: "Owner" },
    { id: 402, date: "2026-10-10", machine: "Harvester 2", category: "Other", note: "Blade adjustment", amount: 1800, by: "Owner" }
  ]
};

let db = normalizeData(load());
let currentUser = null;
let currentScreen = "dashboard";

const nodes = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  menuOverlay: document.getElementById("menuOverlay"),
  menuItems: document.querySelectorAll(".menu-item"),
  screen: document.getElementById("screen"),
  screenTitle: document.getElementById("screenTitle"),
  screenSubtitle: document.getElementById("screenSubtitle"),
  sideSummary: document.getElementById("sideSummary"),
  userBadge: document.getElementById("userBadge"),
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modalContent"),
  closeModal: document.getElementById("closeModal"),
  toast: document.getElementById("toast")
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || structuredClone(seedData);
  } catch {
    return structuredClone(seedData);
  }
}

function normalizeData(data) {
  const allowedExpenseCategories = ["Food", "Diesel", "Other"];
  data.customers ||= [];
  data.machines ||= [];
  data.work ||= [];
  data.expenses ||= [];
  data.users ||= structuredClone(seedData.users);

  data.machines = data.machines.map(machine => ({
    id: machine.id || Date.now(),
    name: machine.name || "Harvester",
    operator: machine.operator || "Unassigned"
  }));

  data.work = data.work.map(row => {
    const acres = Number(row.acres || 0);
    const total = Number(row.total || 0);
    const rate = Number(row.rate || (acres ? total / acres : 0));
    return { ...row, acres, rate, total: total || acres * rate, paid: Number(row.paid || 0) };
  });

  data.expenses = data.expenses.map(row => ({
    ...row,
    machine: row.machine || data.machines[0]?.name || "General",
    category: allowedExpenseCategories.includes(row.category) ? row.category : "Other",
    amount: Number(row.amount || 0)
  }));

  return data;
}

function save() {
  localStorage.setItem(storeKey, JSON.stringify(db));
}

function toWorkRow(row) {
  return {
    work_date: row.date,
    customer: row.customer,
    mobile: row.mobile || "",
    village: row.village,
    machine: row.machine,
    acres: row.acres,
    rate: row.rate,
    total: row.total,
    paid: row.paid,
    entered_by: row.by
  };
}

function fromWorkRow(row) {
  return {
    id: row.id,
    date: row.work_date,
    customer: row.customer,
    mobile: row.mobile || "",
    village: row.village,
    machine: row.machine,
    acres: Number(row.acres || 0),
    rate: Number(row.rate || 0),
    total: Number(row.total || 0),
    paid: Number(row.paid || 0),
    by: row.entered_by || ""
  };
}

function toExpenseRow(row) {
  return {
    expense_date: row.date,
    machine: row.machine,
    category: row.category,
    note: row.note || "",
    amount: row.amount,
    entered_by: row.by
  };
}

function fromExpenseRow(row) {
  return {
    id: row.id,
    date: row.expense_date,
    machine: row.machine,
    category: row.category,
    note: row.note || "",
    amount: Number(row.amount || 0),
    by: row.entered_by || ""
  };
}

function toCustomerRow(row) {
  return {
    name: row.name,
    mobile: row.mobile || "",
    village: row.village || ""
  };
}

async function loadFromSupabase() {
  if (!supabaseDb) return false;

  const [users, customers, machines, work, expenses] = await Promise.all([
    supabaseDb.from("app_users").select("*").order("id"),
    supabaseDb.from("customers").select("*").order("name"),
    supabaseDb.from("machines").select("*").order("id"),
    supabaseDb.from("work_entries").select("*").order("work_date", { ascending: false }).order("id", { ascending: false }),
    supabaseDb.from("expenses").select("*").order("expense_date", { ascending: false }).order("id", { ascending: false })
  ]);

  const firstError = [users, customers, machines, work, expenses].find(result => result.error)?.error;
  if (firstError) throw firstError;

  db = normalizeData({
    users: users.data.map(user => ({
      id: user.id,
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role
    })),
    customers: customers.data.map(customer => ({
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile || "",
      village: customer.village || ""
    })),
    machines: machines.data.map(machine => ({
      id: machine.id,
      name: machine.name,
      operator: machine.operator || "Unassigned"
    })),
    work: work.data.map(fromWorkRow),
    expenses: expenses.data.map(fromExpenseRow)
  });
  save();
  return true;
}

async function reloadData() {
  if (!supabaseDb) return;
  try {
    await loadFromSupabase();
  } catch (error) {
    toast(`Supabase error: ${error.message}`);
  }
}

async function upsertCustomerFromWork(data) {
  const customerRow = toCustomerRow({
    name: data.customer,
    mobile: data.mobile,
    village: data.village
  });

  if (supabaseDb) {
    const { error } = await supabaseDb
      .from("customers")
      .upsert(customerRow, { onConflict: "name" });
    if (error) throw error;
    return;
  }

  const savedCustomer = db.customers.find(customer => customer.name.toLowerCase() === data.customer.toLowerCase());
  if (savedCustomer) {
    savedCustomer.mobile = data.mobile || savedCustomer.mobile;
    savedCustomer.village = data.village || savedCustomer.village;
  } else {
    db.customers.push({ id: Date.now() + 1, ...customerRow });
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function rupees(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function toast(message) {
  nodes.toast.textContent = message;
  nodes.toast.classList.remove("is-hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => nodes.toast.classList.add("is-hidden"), 1800);
}

function totals() {
  const billing = db.work.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const paid = db.work.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const expenses = db.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { billing, paid, balance: billing - paid, expenses, profit: paid - expenses };
}

function setHeader(title, subtitle) {
  nodes.screenTitle.textContent = title;
  nodes.screenSubtitle.textContent = subtitle;
  nodes.sideSummary.textContent = `${db.work.length} work entries • ${db.machines.length} harvesters`;
}

function allowedScreens() {
  if (currentUser?.role === "owner") {
    return ["dashboard", "work", "expenses", "machines", "staff", "backup"];
  }
  return ["work", "expenses"];
}

function defaultScreen() {
  return currentUser?.role === "owner" ? "dashboard" : "work";
}

function canAccess(screen) {
  return allowedScreens().includes(screen);
}

function isOwner() {
  return currentUser?.role === "owner";
}

function requireOwner() {
  if (isOwner()) return true;
  toast("Only the owner can use that action");
  return false;
}

function applyRoleAccess() {
  const allowed = allowedScreens();
  nodes.menuItems.forEach(item => {
    item.classList.toggle("is-hidden", !allowed.includes(item.dataset.screen));
  });
}

function deleteCell(type, id, label) {
  if (!isOwner()) return "";
  return `<button class="row-btn" data-delete-${type}="${id}" aria-label="${label}">×</button>`;
}

function openMenu() {
  nodes.sidebar.classList.add("is-open");
  nodes.menuOverlay.classList.remove("is-hidden");
}

function closeMenu() {
  nodes.sidebar.classList.remove("is-open");
  nodes.menuOverlay.classList.add("is-hidden");
}

async function login() {
  if (supabaseDb) {
    try {
      await loadFromSupabase();
    } catch (error) {
      toast(`Could not load Supabase data: ${error.message}`);
      return;
    }
  }

  const username = nodes.username.value.trim();
  const password = nodes.password.value;
  currentUser = db.users.find(user => user.username === username && user.password === password);

  if (!currentUser) {
    toast("Invalid username or password");
    return;
  }

  nodes.loginView.classList.add("is-hidden");
  nodes.appView.classList.remove("is-hidden");
  nodes.userBadge.textContent = `${currentUser.name} • ${currentUser.role}`;
  applyRoleAccess();
  showScreen(defaultScreen());
}

function logout() {
  currentUser = null;
  nodes.appView.classList.add("is-hidden");
  nodes.loginView.classList.remove("is-hidden");
  closeMenu();
}

function showScreen(screen) {
  if (!canAccess(screen)) {
    toast("You do not have access to that page");
    screen = defaultScreen();
  }

  currentScreen = screen;
  nodes.menuItems.forEach(item => item.classList.toggle("is-active", item.dataset.screen === screen));
  closeMenu();

  const renderers = {
    dashboard: renderDashboard,
    work: renderWork,
    expenses: renderExpenses,
    machines: renderMachines,
    staff: renderStaff,
    backup: renderBackup
  };

  (renderers[screen] || renderDashboard)();
}

function pageHead(title, subtitle, actions = "") {
  return `
    <div class="page-head">
      <div>
        <h2>${title}</h2>
        <p class="muted">${subtitle}</p>
      </div>
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderDashboard() {
  const data = totals();
  setHeader("Dashboard", "Daily overview");
  nodes.screen.innerHTML = `
    ${pageHead("Operations Dashboard", "A mobile-ready command center for daily harvesting work.", `<button class="primary-btn" data-action="new-work">+ New Work</button>`)}
    <section class="stats-grid">
      ${statCard("Total Billing", rupees(data.billing), `${db.work.length} work entries`, "green")}
      ${statCard("Collected", rupees(data.paid), "Payments received", "")}
      ${statCard("Balance", rupees(data.balance), "Amount pending", "gold")}
      ${statCard("Expenses", rupees(data.expenses), `Net: ${rupees(data.profit)}`, "red")}
    </section>
    <section class="card-grid section-space">
      <article class="card">
        <h3>Harvesters</h3>
        <p class="muted">${db.machines.length} harvesters with assigned operators.</p>
        <button class="secondary-btn section-space" data-jump="machines">Manage Machines</button>
      </article>
      <article class="card">
        <h3>Customer Entry</h3>
        <p class="muted">Customer name, mobile, and village are captured while adding work.</p>
        <button class="secondary-btn section-space" data-action="new-work">Add Work</button>
      </article>
      <article class="card">
        <h3>Latest Work</h3>
        <p class="muted">${db.work[0] ? `${esc(db.work[0].customer)} • ${rupees(db.work[0].total)}` : "No work added yet."}</p>
        <button class="secondary-btn section-space" data-jump="work">View Work</button>
      </article>
      <article class="card">
        <h3>Backup</h3>
        <p class="muted">Export your local browser data before changing phones or browsers.</p>
        <button class="secondary-btn section-space" data-jump="backup">Open Backup</button>
      </article>
    </section>
  `;
}

function statCard(label, value, note, color) {
  return `
    <article class="card">
      <p class="muted">${label}</p>
      <strong class="stat-value ${color}">${value}</strong>
      <small>${note}</small>
    </article>
  `;
}

function renderWork() {
  setHeader("Work Entries", "Acres, billing, and collection");
  nodes.screen.innerHTML = `
    ${pageHead("Work Entries", "Record every field visit with billing and payment status.", `<button class="primary-btn" data-action="new-work">+ Add Work</button>`)}
    <div class="filters">
      <input id="workSearch" placeholder="Search customer, village, or machine">
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Customer</th><th>Village</th><th>Harvester</th><th>Acres</th><th>Rate / Acre</th><th>Total</th><th>Paid</th><th>Balance</th><th>By</th><th></th></tr>
        </thead>
        <tbody id="workRows"></tbody>
      </table>
    </div>
  `;
  document.getElementById("workSearch").addEventListener("input", renderWorkRows);
  renderWorkRows();
}

function renderWorkRows() {
  const query = document.getElementById("workSearch")?.value.toLowerCase() || "";
  const rows = db.work.filter(row => [row.customer, row.village, row.machine].join(" ").toLowerCase().includes(query));
  const body = document.getElementById("workRows");
  body.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${esc(row.date)}</td>
      <td>${esc(row.customer)}</td>
      <td>${esc(row.village)}</td>
      <td>${esc(row.machine)}</td>
      <td>${esc(row.acres)}</td>
      <td>${rupees(row.rate || (Number(row.acres) ? Number(row.total || 0) / Number(row.acres) : 0))}</td>
      <td>${rupees(row.total)}</td>
      <td>${rupees(row.paid)}</td>
      <td class="${row.total - row.paid > 0 ? "gold" : "green"}">${rupees(row.total - row.paid)}</td>
      <td>${esc(row.by)}</td>
      <td>${deleteCell("work", row.id, "Delete work entry")}</td>
    </tr>
  `).join("") : `<tr><td class="empty" colspan="11">No work entries found.</td></tr>`;
}

function renderExpenses() {
  setHeader("Expenses", "Food, diesel, and other costs");
  nodes.screen.innerHTML = `
    ${pageHead("Expenses", "Track every cost beside collection and balance.", `<button class="primary-btn" data-action="new-expense">+ Add Expense</button>`)}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Harvester</th><th>Category</th><th>Note</th><th>Amount</th><th>By</th><th></th></tr></thead>
        <tbody>
          ${db.expenses.length ? db.expenses.map(expense => `
            <tr>
              <td>${esc(expense.date)}</td>
              <td>${esc(expense.machine || "General")}</td>
              <td><span class="badge">${esc(expense.category)}</span></td>
              <td>${esc(expense.note)}</td>
              <td class="red">${rupees(expense.amount)}</td>
              <td>${esc(expense.by)}</td>
              <td>${deleteCell("expense", expense.id, "Delete expense")}</td>
            </tr>
          `).join("") : `<tr><td class="empty" colspan="7">No expenses recorded.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderMachines() {
  setHeader("Machines", "Harvester operator assignment");
  nodes.screen.innerHTML = `
    ${pageHead("Machines", "Each harvester is assigned to one operator.", `<button class="primary-btn" data-action="new-machine">+ Add Harvester</button>`)}
    <section class="card-grid">
      ${db.machines.map(machine => `
        <article class="card">
          <h3>${esc(machine.name)}</h3>
          <p><span class="badge">Operator</span></p>
          <p class="muted section-space">${esc(machine.operator || "Unassigned")}</p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderStaff() {
  setHeader("Operators", "Owner-managed signups");
  nodes.screen.innerHTML = `
    ${pageHead("Operator Signup", "Only the owner can create operator login accounts.", `<button class="primary-btn" data-action="new-staff">+ Sign Up Operator</button>`)}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th></th></tr></thead>
        <tbody>
          ${db.users.map(user => `
            <tr>
              <td>${esc(user.name)}</td>
              <td>${esc(user.username)}</td>
              <td><span class="badge">${esc(user.role)}</span></td>
              <td>${user.role === "owner" ? "" : `<button class="row-btn" data-delete-staff="${user.id}" aria-label="Delete staff">×</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBackup() {
  setHeader("Backup", "Export, import, and reset");
  nodes.screen.innerHTML = `
    ${pageHead("Backup", supabaseDb ? "Data is synced with Supabase. Export a JSON copy whenever needed." : "Data is saved in this browser, so export before changing devices.")}
    <section class="card-grid">
      <article class="card">
        <h3>Export Data</h3>
        <p class="muted">Download work, customer history, expenses, machines, and staff as JSON.</p>
        <button class="primary-btn" data-action="export">Download Backup</button>
      </article>
      <article class="card">
        <h3>Import Data</h3>
        <p class="muted">Restore a JSON backup created from this app.</p>
        <label>
          Backup file
          <input type="file" id="backupFile" accept="application/json">
        </label>
      </article>
      <article class="card">
        <h3>Reset Fresh App</h3>
        <p class="muted">Clear local browser data and return to demo records.</p>
        <button class="danger-btn" data-action="reset">Reset Data</button>
      </article>
    </section>
  `;
}

function openModal(html) {
  nodes.modalContent.innerHTML = html;
  nodes.modal.classList.remove("is-hidden");
}

function closeModal() {
  nodes.modal.classList.add("is-hidden");
  nodes.modalContent.innerHTML = "";
}

function formShell(title, fields, action) {
  return `
    <form class="form-grid" data-form="${action}">
      <h2>${title}</h2>
      ${fields}
      <div class="form-actions">
        <button class="primary-btn">Save</button>
        <button class="secondary-btn" type="button" data-action="close-modal">Cancel</button>
      </div>
    </form>
  `;
}

function showWorkForm() {
  openModal(formShell("New Work Entry", `
    <label>Date<input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
    <label>Customer<input name="customer" list="customerList" required></label>
    <datalist id="customerList">${db.customers.map(customer => `<option value="${esc(customer.name)}">`).join("")}</datalist>
    <label>Customer Mobile<input name="mobile" inputmode="tel"></label>
    <label>Village<input name="village" required></label>
    <label>Harvester<select name="machine">${db.machines.map(machine => `<option value="${esc(machine.name)}">${esc(machine.name)} - ${esc(machine.operator || "Unassigned")}</option>`).join("")}</select></label>
    <label>Acres<input name="acres" class="js-work-calc" type="number" min="0" step="0.01" required></label>
    <label>Amount Per Acre<input name="rate" class="js-work-calc" type="number" min="0" step="0.01" required></label>
    <label>Total Amount<input name="total" type="number" min="0" step="0.01" readonly required></label>
    <label>Paid Amount<input name="paid" type="number" min="0" step="0.01" value="0"></label>
  `, "work"));
}

function showExpenseForm() {
  openModal(formShell("New Expense", `
    <label>Date<input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
    <label>Harvester<select name="machine">${db.machines.map(machine => `<option value="${esc(machine.name)}">${esc(machine.name)} - ${esc(machine.operator || "Unassigned")}</option>`).join("")}</select></label>
    <label>Category<select name="category"><option>Food</option><option>Diesel</option><option>Other</option></select></label>
    <label class="span-all">Note<input name="note"></label>
    <label>Amount<input name="amount" type="number" min="0" step="0.01" required></label>
  `, "expense"));
}

function showMachineForm() {
  openModal(formShell("New Machine", `
    <label>Harvester Name<input name="name" required></label>
    <label>Operator<input name="operator" value="Unassigned"></label>
  `, "machine"));
}

function showStaffForm() {
  openModal(formShell("Sign Up Operator", `
    <label>Name<input name="name" required></label>
    <label>Username<input name="username" autocomplete="off" required></label>
    <label>Password<input name="password" type="password" autocomplete="new-password" minlength="4" required></label>
    <label>Confirm Password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required></label>
    <input name="role" type="hidden" value="operator">
  `, "staff"));
}

async function submitForm(form) {
  const data = Object.fromEntries(new FormData(form));

  if (form.dataset.form === "work") {
    const acres = Number(data.acres);
    const rate = Number(data.rate);
    const total = acres * rate;
    const row = {
      id: Date.now(),
      ...data,
      acres,
      rate,
      total,
      paid: Number(data.paid),
      by: currentUser.name
    };

    if (supabaseDb) {
      const { error } = await supabaseDb.from("work_entries").insert(toWorkRow(row));
      if (error) throw error;
    } else {
      db.work.unshift(row);
    }
    await upsertCustomerFromWork(data);
    toast("Work entry saved");
    currentScreen = "work";
  }

  if (form.dataset.form === "expense") {
    const row = { id: Date.now(), ...data, amount: Number(data.amount), by: currentUser.name };
    if (supabaseDb) {
      const { error } = await supabaseDb.from("expenses").insert(toExpenseRow(row));
      if (error) throw error;
    } else {
      db.expenses.unshift(row);
    }
    toast("Expense saved");
    currentScreen = "expenses";
  }

  if (form.dataset.form === "machine") {
    const row = { id: Date.now(), ...data };
    if (supabaseDb) {
      const { error } = await supabaseDb.from("machines").insert({ name: row.name, operator: row.operator });
      if (error) throw error;
    } else {
      db.machines.push(row);
    }
    toast("Machine saved");
    currentScreen = "machines";
  }

  if (form.dataset.form === "staff") {
    const username = data.username.trim();
    const name = data.name.trim();
    if (data.password !== data.confirmPassword) {
      toast("Passwords do not match");
      return;
    }
    if (db.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      toast("Username already exists");
      return;
    }

    const row = {
      id: Date.now(),
      name,
      username,
      password: data.password,
      role: "operator"
    };
    if (supabaseDb) {
      const { error } = await supabaseDb.from("app_users").insert({
        name: row.name,
        username: row.username,
        password: row.password,
        role: "operator"
      });
      if (error) throw error;
    } else {
      db.users.push(row);
    }
    toast("Operator signup complete");
    currentScreen = "staff";
  }

  await reloadData();
  save();
  closeModal();
  showScreen(currentScreen);
}

async function deleteRow(table, id) {
  if (supabaseDb) {
    const { error } = await supabaseDb.from(table).delete().eq("id", id);
    if (error) throw error;
    await reloadData();
  }
  save();
}

function exportData() {
  const file = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "rk-harvester-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (supabaseDb) {
        toast("Import is local-only. Use Supabase SQL for database imports.");
        return;
      }
      db = JSON.parse(reader.result);
      save();
      showScreen("dashboard");
      toast("Backup imported");
    } catch {
      toast("Invalid backup file");
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (supabaseDb) {
    toast("Reset is disabled when Supabase is connected");
    return;
  }
  if (!confirm("Reset this fresh app to demo data?")) return;
  db = structuredClone(seedData);
  save();
  showScreen("dashboard");
  toast("Demo data restored");
}

nodes.loginBtn.addEventListener("click", login);
nodes.password.addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});
nodes.logoutBtn.addEventListener("click", logout);
nodes.menuBtn.addEventListener("click", openMenu);
nodes.menuOverlay.addEventListener("click", closeMenu);
nodes.closeModal.addEventListener("click", closeModal);
nodes.modal.addEventListener("click", event => {
  if (event.target === nodes.modal) closeModal();
});

nodes.menuItems.forEach(item => {
  item.addEventListener("click", () => showScreen(item.dataset.screen));
});

document.addEventListener("click", async event => {
  const target = event.target.closest("button");
  if (!target) return;

  try {
    if (target.dataset.action === "new-work") showWorkForm();
    if (target.dataset.action === "new-expense") showExpenseForm();
    if (target.dataset.action === "new-machine" && requireOwner()) showMachineForm();
    if (target.dataset.action === "new-staff" && requireOwner()) showStaffForm();
    if (target.dataset.action === "close-modal") closeModal();
    if (target.dataset.action === "export" && requireOwner()) exportData();
    if (target.dataset.action === "reset" && requireOwner()) resetData();
    if (target.dataset.jump) showScreen(target.dataset.jump);

    if (target.dataset.deleteWork) {
      if (!requireOwner()) return;
      const id = Number(target.dataset.deleteWork);
      db.work = db.work.filter(row => row.id !== id);
      await deleteRow("work_entries", id);
      showScreen("work");
    }

    if (target.dataset.deleteExpense) {
      if (!requireOwner()) return;
      const id = Number(target.dataset.deleteExpense);
      db.expenses = db.expenses.filter(row => row.id !== id);
      await deleteRow("expenses", id);
      showScreen("expenses");
    }

    if (target.dataset.deleteStaff) {
      if (!requireOwner()) return;
      const id = Number(target.dataset.deleteStaff);
      db.users = db.users.filter(row => row.id !== id);
      await deleteRow("app_users", id);
      showScreen("staff");
    }
  } catch (error) {
    toast(`Supabase error: ${error.message}`);
    await reloadData();
    showScreen(currentScreen);
  }

});

document.addEventListener("submit", async event => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  if (["machine", "staff"].includes(form.dataset.form) && !requireOwner()) return;
  try {
    await submitForm(form);
  } catch (error) {
    toast(`Save failed: ${error.message}`);
    await reloadData();
    showScreen(currentScreen);
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "backupFile" && event.target.files[0]) {
    if (!requireOwner()) return;
    importData(event.target.files[0]);
  }
});

document.addEventListener("input", event => {
  if (!event.target.classList.contains("js-work-calc")) return;
  const form = event.target.closest("[data-form='work']");
  if (!form) return;
  const acres = Number(form.elements.acres.value || 0);
  const rate = Number(form.elements.rate.value || 0);
  form.elements.total.value = acres && rate ? (acres * rate).toFixed(2) : "";
});
