import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeIndianRupee,
  Calculator,
  CalendarDays,
  Combine,
  Database,
  Download,
  Fuel,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
  Wheat,
  X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import "./styles.css";

const storeKey = "rk_harvester_fresh_v2";
const defaultHarvesterImage = "https://www.malkitagrotech.com/images/products/malkit-597-champian.jpg";

const seedData = {
  users: [
    { id: 1, name: "Owner", username: "owner", password: "change_me_owner", role: "owner" },
    { id: 2, name: "Ramesh", username: "ramesh", password: "change_me_operator", role: "operator" }
  ],
  customers: [
    { id: 101, name: "Mahesh Farms", mobile: "9876543210", village: "Mandya" },
    { id: 102, name: "Sri Lakshmi Fields", mobile: "9123456780", village: "Maddur" },
    { id: 103, name: "Kumar Agro", mobile: "9988776655", village: "Srirangapatna" }
  ],
  machines: [
    { id: 201, name: "Harvester 1", operator: "Ramesh", image_url: defaultHarvesterImage },
    { id: 202, name: "Harvester 2", operator: "Manju", image_url: defaultHarvesterImage },
    { id: 203, name: "Harvester 3", operator: "Unassigned", image_url: defaultHarvesterImage }
  ],
  work: [
    { id: 301, date: "2026-10-08", customer: "Mahesh Farms", mobile: "9876543210", village: "Mandya", machine: "Harvester 1", acres: 8, rate: 3000, total: 24000, paid: 18000, by: "Owner" },
    { id: 302, date: "2026-10-09", customer: "Sri Lakshmi Fields", mobile: "9123456780", village: "Maddur", machine: "Harvester 2", acres: 5.5, rate: 3000, total: 16500, paid: 16500, by: "Ramesh" }
  ],
  expenses: [
    { id: 401, date: "2026-10-09", machine: "Harvester 1", category: "Diesel", note: "Refill", amount: 5200, by: "Owner" },
    { id: 402, date: "2026-10-10", machine: "Harvester 2", category: "Other", note: "Blade adjustment", amount: 1800, by: "Owner" }
  ]
};

const screens = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { id: "work", label: "Work Entries", icon: Wheat },
  { id: "expenses", label: "Expenses", icon: Fuel },
  { id: "machines", label: "Machines", icon: Combine, ownerOnly: true },
  { id: "staff", label: "Operators", icon: UserPlus, ownerOnly: true },
  { id: "backup", label: "Backup", icon: Database, ownerOnly: true }
];

function loadLocal() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(storeKey)) || seedData);
  } catch {
    return normalizeData(seedData);
  }
}

function normalizeData(data) {
  const categories = ["Food", "Diesel", "Other"];
  return {
    users: data.users || seedData.users,
    customers: data.customers || [],
    machines: (data.machines || []).map(machine => ({
      id: machine.id || Date.now(),
      name: machine.name || "Harvester",
      operator: machine.operator || "Unassigned",
      image_url: machine.image_url || defaultHarvesterImage
    })),
    work: (data.work || []).map(row => {
      const acres = Number(row.acres || 0);
      const total = Number(row.total || 0);
      const rate = Number(row.rate || (acres ? total / acres : 0));
      return { ...row, acres, rate, total: total || acres * rate, paid: Number(row.paid || 0) };
    }),
    expenses: (data.expenses || []).map(row => ({
      ...row,
      machine: row.machine || "General",
      category: categories.includes(row.category) ? row.category : "Other",
      amount: Number(row.amount || 0)
    }))
  };
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

function rupees(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [db, setDb] = useState(loadLocal);
  const [currentUser, setCurrentUser] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "owner", password: "" });
  const [loading, setLoading] = useState(false);

  const isOwner = currentUser?.role === "owner";
  const allowedScreens = screens.filter(item => !item.ownerOnly || isOwner);

  const totals = useMemo(() => {
    const billing = db.work.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const paid = db.work.reduce((sum, row) => sum + Number(row.paid || 0), 0);
    const expenses = db.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { billing, paid, balance: billing - paid, expenses, profit: paid - expenses };
  }, [db]);

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(db));
  }, [db]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2200);
  }

  async function loadFromSupabase() {
    if (!supabase) return db;
    const [users, customers, machines, work, expenses] = await Promise.all([
      supabase.from("app_users").select("*").order("id"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("machines").select("*").order("id"),
      supabase.from("work_entries").select("*").order("work_date", { ascending: false }).order("id", { ascending: false }),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }).order("id", { ascending: false })
    ]);
    const firstError = [users, customers, machines, work, expenses].find(result => result.error)?.error;
    if (firstError) throw firstError;
    const nextDb = normalizeData({
      users: users.data.map(user => ({ id: user.id, name: user.name, username: user.username, password: user.password, role: user.role })),
      customers: customers.data.map(customer => ({ id: customer.id, name: customer.name, mobile: customer.mobile || "", village: customer.village || "" })),
      machines: machines.data.map(machine => ({ id: machine.id, name: machine.name, operator: machine.operator || "Unassigned", image_url: machine.image_url || defaultHarvesterImage })),
      work: work.data.map(fromWorkRow),
      expenses: expenses.data.map(fromExpenseRow)
    });
    setDb(nextDb);
    return nextDb;
  }

  async function refreshData() {
    try {
      setLoading(true);
      await loadFromSupabase();
      notify("Data refreshed");
    } catch (error) {
      notify(`Supabase error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const latest = supabase ? await loadFromSupabase() : db;
      const username = loginForm.username.trim();
      const user = latest.users.find(item => item.username === username && item.password === loginForm.password);
      if (!user) return notify("Invalid username or password");
      setCurrentUser(user);
      setScreen(user.role === "owner" ? "dashboard" : "work");
    } catch (error) {
      notify(`Could not login: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setCurrentUser(null);
    setScreen("dashboard");
    setSidebarOpen(false);
  }

  function openScreen(nextScreen) {
    const allowed = allowedScreens.some(item => item.id === nextScreen);
    setScreen(allowed ? nextScreen : isOwner ? "dashboard" : "work");
    setSidebarOpen(false);
  }

  async function upsertCustomer(row) {
    const customer = { name: row.customer, mobile: row.mobile || "", village: row.village || "" };
    if (supabase) {
      const { error } = await supabase.from("customers").upsert(customer, { onConflict: "name" });
      if (error) throw error;
      return;
    }
    setDb(prev => {
      const exists = prev.customers.find(item => item.name.toLowerCase() === customer.name.toLowerCase());
      const customers = exists
        ? prev.customers.map(item => item.id === exists.id ? { ...item, ...customer } : item)
        : [{ id: Date.now() + 1, ...customer }, ...prev.customers];
      return { ...prev, customers };
    });
  }

  async function saveWork(values) {
    const acres = Number(values.acres);
    const rate = Number(values.rate);
    const row = { id: Date.now(), ...values, acres, rate, total: acres * rate, paid: Number(values.paid || 0), by: currentUser.name };
    try {
      setLoading(true);
      if (supabase) {
        const { error } = await supabase.from("work_entries").insert(toWorkRow(row));
        if (error) throw error;
      } else {
        setDb(prev => ({ ...prev, work: [row, ...prev.work] }));
      }
      await upsertCustomer(row);
      if (supabase) await loadFromSupabase();
      setModal(null);
      setScreen("work");
      notify("Work entry saved");
    } catch (error) {
      notify(`Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveExpense(values) {
    const row = { id: Date.now(), ...values, amount: Number(values.amount || 0), by: currentUser.name };
    try {
      setLoading(true);
      if (supabase) {
        const { error } = await supabase.from("expenses").insert(toExpenseRow(row));
        if (error) throw error;
      } else {
        setDb(prev => ({ ...prev, expenses: [row, ...prev.expenses] }));
      }
      if (supabase) await loadFromSupabase();
      setModal(null);
      setScreen("expenses");
      notify("Expense saved");
    } catch (error) {
      notify(`Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveMachine(values) {
    if (!isOwner) return notify("Only owner can add machines");
    const row = { id: Date.now(), name: values.name.trim(), operator: values.operator.trim() || "Unassigned", image_url: values.image_url.trim() || defaultHarvesterImage };
    try {
      setLoading(true);
      let savedWithoutImage = false;
      if (supabase) {
        const { error } = await supabase.from("machines").insert({ name: row.name, operator: row.operator, image_url: row.image_url });
        if (error?.message?.includes("image_url")) {
          const fallback = await supabase.from("machines").insert({ name: row.name, operator: row.operator });
          if (fallback.error) throw fallback.error;
          savedWithoutImage = true;
        } else if (error) {
          throw error;
        }
      } else {
        setDb(prev => ({ ...prev, machines: [...prev.machines, row] }));
      }
      if (supabase) await loadFromSupabase();
      setModal(null);
      notify(savedWithoutImage ? "Machine saved. Run the schema update to persist images." : "Machine saved");
    } catch (error) {
      notify(`Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveOperator(values) {
    if (!isOwner) return notify("Only owner can sign up operators");
    const username = values.username.trim();
    const name = values.name.trim();
    if (values.password !== values.confirmPassword) return notify("Passwords do not match");
    if (db.users.some(user => user.username.toLowerCase() === username.toLowerCase())) return notify("Username already exists");
    const row = { id: Date.now(), name, username, password: values.password, role: "operator" };
    try {
      setLoading(true);
      if (supabase) {
        const { error } = await supabase.from("app_users").insert({ name: row.name, username: row.username, password: row.password, role: "operator" });
        if (error) throw error;
      } else {
        setDb(prev => ({ ...prev, users: [...prev.users, row] }));
      }
      if (supabase) await loadFromSupabase();
      setModal(null);
      notify("Operator signup complete");
    } catch (error) {
      notify(`Signup failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRow(table, collection, id) {
    if (!isOwner) return notify("Only owner can delete records");
    try {
      setLoading(true);
      if (supabase) {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        await loadFromSupabase();
      } else {
        setDb(prev => ({ ...prev, [collection]: prev[collection].filter(row => row.id !== id) }));
      }
      notify("Record deleted");
    } catch (error) {
      notify(`Delete failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function exportData() {
    const file = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "rk-harvester-backup.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!currentUser) {
    return <LoginView form={loginForm} loading={loading} onChange={setLoginForm} onLogin={login} toast={toast} />;
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} screens={allowedScreens} active={screen} user={currentUser} db={db} onNavigate={openScreen} onClose={() => setSidebarOpen(false)} onLogout={logout} />
      <main className="workspace">
        <Topbar screen={screen} user={currentUser} connected={isSupabaseConfigured} loading={loading} onMenu={() => setSidebarOpen(true)} onRefresh={refreshData} />
        <div className="content">
          {screen === "dashboard" && <Dashboard db={db} totals={totals} onNewWork={() => setModal("work")} onNavigate={openScreen} />}
          {screen === "work" && <WorkEntries rows={db.work} isOwner={isOwner} onAdd={() => setModal("work")} onDelete={id => deleteRow("work_entries", "work", id)} />}
          {screen === "expenses" && <Expenses rows={db.expenses} isOwner={isOwner} onAdd={() => setModal("expense")} onDelete={id => deleteRow("expenses", "expenses", id)} />}
          {screen === "machines" && <Machines rows={db.machines} onAdd={() => setModal("machine")} />}
          {screen === "staff" && <Operators rows={db.users} onAdd={() => setModal("operator")} onDelete={id => deleteRow("app_users", "users", id)} />}
          {screen === "backup" && <Backup connected={isSupabaseConfigured} onExport={exportData} />}
        </div>
      </main>
      {modal === "work" && <WorkModal customers={db.customers} machines={db.machines} onClose={() => setModal(null)} onSave={saveWork} />}
      {modal === "expense" && <ExpenseModal machines={db.machines} onClose={() => setModal(null)} onSave={saveExpense} />}
      {modal === "machine" && <MachineModal onClose={() => setModal(null)} onSave={saveMachine} />}
      {modal === "operator" && <OperatorModal onClose={() => setModal(null)} onSave={saveOperator} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function LoginView({ form, loading, onChange, onLogin, toast }) {
  return (
    <div className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Sprout size={28} /></div>
          <div>
            <h1>RK Harvester</h1>
            <p>Enterprise operations for field work, collections, machines, and operators.</p>
          </div>
        </div>
        <form onSubmit={onLogin} className="login-form">
          <label>Username<input value={form.username} onChange={event => onChange({ ...form, username: event.target.value })} autoComplete="username" /></label>
          <label>Password<input type="password" value={form.password} onChange={event => onChange({ ...form, password: event.target.value })} autoComplete="current-password" /></label>
          <button className="primary-btn" disabled={loading}>{loading ? "Checking..." : "Login"}</button>
        </form>
        <div className="login-footer">
          <span><ShieldCheck size={16} /> Owner access required for management.</span>
          <span>Operator access is limited to work and expenses.</span>
        </div>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Sidebar({ open, screens, active, user, db, onNavigate, onClose, onLogout }) {
  return (
    <>
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Sprout size={24} /></div>
          <div><strong>RK Harvester</strong><small>Operations Control</small></div>
        </div>
        <nav className="nav-list">
          {screens.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-card"><small>Signed in</small><strong>{user.name}</strong><span>{user.role} · {db.work.length} jobs · {db.machines.length} machines</span></div>
          <button className="ghost-btn" onClick={onLogout}><LogOut size={17} /> Logout</button>
        </div>
      </aside>
      {open && <button className="menu-overlay" onClick={onClose} aria-label="Close menu" />}
    </>
  );
}

function Topbar({ screen, user, connected, loading, onMenu, onRefresh }) {
  const title = screens.find(item => item.id === screen)?.label || "Dashboard";
  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <div><strong>{title}</strong><small>{connected ? "Synced with Supabase" : "Local browser mode"}</small></div>
      <div className="topbar-actions">
        <button className="quiet-btn" onClick={onRefresh} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} /> <span>Refresh</span></button>
        <div className="user-pill"><Users size={16} /> {user.name} · {user.role}</div>
      </div>
    </header>
  );
}

function Dashboard({ db, totals, onNewWork, onNavigate }) {
  const latest = db.work[0];
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Live operations</span>
          <h2>Harvesting command center</h2>
          <p>Track field work, collections, expenses, machines, and operators with a polished control-room experience.</p>
          <div className="hero-actions">
            <button className="primary-btn compact" onClick={onNewWork}><Plus size={17} /> New Work</button>
            <button className="secondary-btn compact" onClick={() => onNavigate("expenses")}><Fuel size={17} /> Add Expense</button>
          </div>
        </div>
        <div className="hero-rail">
          <div><CalendarDays size={18} /><span>Today</span><strong>{today()}</strong></div>
          <div><TrendingUp size={18} /><span>Net Cash</span><strong>{rupees(totals.profit)}</strong></div>
          <div><Combine size={18} /><span>Fleet</span><strong>{db.machines.length} active</strong></div>
        </div>
      </section>
      <section className="stats-grid">
        <Metric icon={BadgeIndianRupee} label="Total Billing" value={rupees(totals.billing)} tone="green" note={`${db.work.length} work entries`} />
        <Metric icon={Activity} label="Collected" value={rupees(totals.paid)} tone="blue" note="Payments received" />
        <Metric icon={ShieldCheck} label="Balance" value={rupees(totals.balance)} tone="gold" note="Pending from customers" />
        <Metric icon={Fuel} label="Expenses" value={rupees(totals.expenses)} tone="red" note={`Net ${rupees(totals.profit)}`} />
      </section>
      <section className="dashboard-grid">
        <article className="panel wide-panel">
          <div className="panel-head">
            <div><h3>Latest Work</h3><p>{latest ? `${latest.customer} · ${latest.machine}` : "No work recorded yet"}</p></div>
            <button className="secondary-btn compact" onClick={() => onNavigate("work")}>View Work</button>
          </div>
          <div className="timeline">
            {db.work.slice(0, 5).map(row => <div className="timeline-row" key={row.id}><span>{row.date}</span><strong>{row.customer}</strong><em>{rupees(row.total)} · {row.acres} acres</em></div>)}
          </div>
        </article>
        <article className="panel accent-panel">
          <h3>Fleet Readiness</h3>
          <p>{db.machines.length} harvesters available with assigned operators.</p>
          <button className="secondary-btn compact" onClick={() => onNavigate("machines")}>Manage Fleet</button>
        </article>
      </section>
    </>
  );
}

function PageHead({ eyebrow, title, subtitle, action }) {
  return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>{action && <div className="page-actions">{action}</div>}</div>;
}

function Metric({ icon: Icon, label, value, note, tone }) {
  return <article className={`metric ${tone}`}><div className="metric-icon"><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function WorkEntries({ rows, isOwner, onAdd, onDelete }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter(row => [row.customer, row.village, row.machine, row.by].join(" ").toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHead eyebrow="Revenue" title="Work entries" subtitle="Record acres, rate, collection, and balance by harvester." action={<button className="primary-btn compact" onClick={onAdd}><Plus size={17} /> Add Work</button>} />
      <SearchBox value={query} onChange={setQuery} placeholder="Search customer, village, machine, or operator" />
      <DataTable columns={["Date", "Customer", "Village", "Harvester", "Acres", "Rate", "Total", "Paid", "Balance", "By", ""]} rows={filtered} empty="No work entries found." render={row => [row.date, row.customer, row.village, row.machine, row.acres, rupees(row.rate), rupees(row.total), rupees(row.paid), <span className={row.total - row.paid > 0 ? "text-gold" : "text-green"}>{rupees(row.total - row.paid)}</span>, row.by, isOwner && <button className="row-btn" onClick={() => onDelete(row.id)} aria-label="Delete work entry"><Trash2 size={16} /></button>]} />
    </>
  );
}

function Expenses({ rows, isOwner, onAdd, onDelete }) {
  return (
    <>
      <PageHead eyebrow="Costs" title="Expenses" subtitle="Track diesel, food, maintenance, and other operational costs." action={<button className="primary-btn compact" onClick={onAdd}><Plus size={17} /> Add Expense</button>} />
      <DataTable columns={["Date", "Harvester", "Category", "Note", "Amount", "By", ""]} rows={rows} empty="No expenses recorded." render={row => [row.date, row.machine, <span className="badge">{row.category}</span>, row.note, <span className="text-red">{rupees(row.amount)}</span>, row.by, isOwner && <button className="row-btn" onClick={() => onDelete(row.id)} aria-label="Delete expense"><Trash2 size={16} /></button>]} />
    </>
  );
}

function Machines({ rows, onAdd }) {
  return (
    <>
      <PageHead eyebrow="Fleet" title="Machines" subtitle="Maintain the active harvester fleet and operator assignments." action={<button className="primary-btn compact" onClick={onAdd}><Plus size={17} /> Add Machine</button>} />
      <section className="card-grid">{rows.map(machine => <article className="fleet-card" key={machine.id}><div className="fleet-media"><img src={machine.image_url || defaultHarvesterImage} alt={machine.name} /></div><div className="fleet-body"><div className="fleet-icon"><Combine size={24} /></div><h3>{machine.name}</h3><span>Operator</span><strong>{machine.operator}</strong></div></article>)}</section>
    </>
  );
}

function Operators({ rows, onAdd, onDelete }) {
  return (
    <>
      <PageHead eyebrow="Access" title="Operator signup" subtitle="Owner-managed operator accounts. New signups always receive operator access." action={<button className="primary-btn compact" onClick={onAdd}><UserPlus size={17} /> Sign Up Operator</button>} />
      <DataTable columns={["Name", "Username", "Role", ""]} rows={rows} empty="No users found." render={row => [row.name, row.username, <span className="badge">{row.role}</span>, row.role !== "owner" && <button className="row-btn" onClick={() => onDelete(row.id)} aria-label="Delete operator"><Trash2 size={16} /></button>]} />
    </>
  );
}

function Backup({ connected, onExport }) {
  return (
    <>
      <PageHead eyebrow="Data" title="Backup" subtitle={connected ? "Data is synced with Supabase. Export a JSON copy when needed." : "Local browser data can be exported as JSON."} />
      <section className="card-grid">
        <article className="action-card"><Download size={24} /><h3>Export Data</h3><p>Download customers, work entries, expenses, machines, and operators.</p><button className="primary-btn compact" onClick={onExport}>Download Backup</button></article>
        <article className="action-card"><ShieldCheck size={24} /><h3>Access Model</h3><p>Owners can manage data and sign up operators. Operators can record work and expenses.</p></article>
      </section>
    </>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return <div className="search-box"><Search size={18} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function DataTable({ columns, rows, render, empty }) {
  return (
    <div className="table-card">
      <table>
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id}>{render(row).map((cell, index) => <td key={index}>{cell}</td>)}</tr>) : <tr><td className="empty" colSpan={columns.length}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

function Modal({ title, subtitle, icon: Icon, tone = "field", children, onClose }) {
  return <div className="modal"><section className={`modal-sheet ${tone}-form`}><button className="icon-btn close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button><div className="modal-head">{Icon && <div className="modal-icon"><Icon size={22} /></div>}<div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div><div className="form-surface">{children}</div></section></div>;
}

function WorkModal({ customers, machines, onClose, onSave }) {
  const [values, setValues] = useState({ date: today(), customer: "", mobile: "", village: "", machine: machines[0]?.name || "", acres: "", rate: "", paid: "0" });
  const total = Number(values.acres || 0) * Number(values.rate || 0);
  return (
    <Modal title="New Work Entry" subtitle="Add field work, billing, paid amount, and customer details in one step." icon={Wheat} tone="work" onClose={onClose}>
      <div className="form-summary">
        <div><Calculator size={18} /><span>Total</span><strong>{rupees(total)}</strong></div>
        <div><BadgeIndianRupee size={18} /><span>Balance</span><strong>{rupees(total - Number(values.paid || 0))}</strong></div>
      </div>
      <FormGrid onSubmit={() => onSave(values)}>
        <Field label="Date" type="date" value={values.date} onChange={date => setValues({ ...values, date })} required />
        <Field label="Customer" value={values.customer} onChange={customer => setValues({ ...values, customer })} list="customerList" required />
        <datalist id="customerList">{customers.map(customer => <option key={customer.id} value={customer.name} />)}</datalist>
        <Field label="Customer Mobile" value={values.mobile} onChange={mobile => setValues({ ...values, mobile })} />
        <Field label="Village" value={values.village} onChange={village => setValues({ ...values, village })} required />
        <Select label="Harvester" value={values.machine} onChange={machine => setValues({ ...values, machine })} options={machines.map(machine => ({ value: machine.name, label: `${machine.name} - ${machine.operator}` }))} />
        <Field label="Acres" type="number" value={values.acres} onChange={acres => setValues({ ...values, acres })} required />
        <Field label="Rate Per Acre" type="number" value={values.rate} onChange={rate => setValues({ ...values, rate })} required />
        <Field label="Total Amount" type="number" value={total ? total.toFixed(2) : ""} readOnly />
        <Field label="Paid Amount" type="number" value={values.paid} onChange={paid => setValues({ ...values, paid })} />
      </FormGrid>
    </Modal>
  );
}

function ExpenseModal({ machines, onClose, onSave }) {
  const [values, setValues] = useState({ date: today(), machine: machines[0]?.name || "", category: "Diesel", note: "", amount: "" });
  return (
    <Modal title="New Expense" subtitle="Capture machine-wise running costs with category and notes." icon={Fuel} tone="expense" onClose={onClose}>
      <div className="form-summary">
        <div><Fuel size={18} /><span>Category</span><strong>{values.category}</strong></div>
        <div><BadgeIndianRupee size={18} /><span>Amount</span><strong>{rupees(values.amount)}</strong></div>
      </div>
      <FormGrid onSubmit={() => onSave(values)}>
        <Field label="Date" type="date" value={values.date} onChange={date => setValues({ ...values, date })} required />
        <Select label="Harvester" value={values.machine} onChange={machine => setValues({ ...values, machine })} options={machines.map(machine => ({ value: machine.name, label: `${machine.name} - ${machine.operator}` }))} />
        <Select label="Category" value={values.category} onChange={category => setValues({ ...values, category })} options={["Food", "Diesel", "Other"].map(item => ({ value: item, label: item }))} />
        <Field label="Amount" type="number" value={values.amount} onChange={amount => setValues({ ...values, amount })} required />
        <Field label="Note" value={values.note} onChange={note => setValues({ ...values, note })} span />
      </FormGrid>
    </Modal>
  );
}

function MachineModal({ onClose, onSave }) {
  const [values, setValues] = useState({ name: "", operator: "Unassigned", image_url: defaultHarvesterImage });
  return (
    <Modal title="Add Harvester" subtitle="Create a fleet card with operator assignment and machine image." icon={Combine} tone="machine" onClose={onClose}>
      <div className="machine-preview">
        <img src={values.image_url || defaultHarvesterImage} alt="Harvester preview" />
        <div><span>Preview</span><strong>{values.name || "Harvester name"}</strong><small>{values.operator || "Unassigned"}</small></div>
      </div>
      <FormGrid onSubmit={() => onSave(values)}>
        <Field label="Harvester Name" value={values.name} onChange={name => setValues({ ...values, name })} required />
        <Field label="Operator" value={values.operator} onChange={operator => setValues({ ...values, operator })} required />
      </FormGrid>
    </Modal>
  );
}

function OperatorModal({ onClose, onSave }) {
  const [values, setValues] = useState({ name: "", username: "", password: "", confirmPassword: "" });
  return (
    <Modal title="Sign Up Operator" subtitle="Operators can add work entries and expenses. Owner pages remain restricted." icon={UserPlus} tone="operator" onClose={onClose}>
      <div className="access-note"><LockKeyhole size={18} /><div><strong>Operator access</strong><span>Work entries and expenses only</span></div></div>
      <FormGrid onSubmit={() => onSave(values)}><Field label="Name" value={values.name} onChange={name => setValues({ ...values, name })} required /><Field label="Username" value={values.username} onChange={username => setValues({ ...values, username })} required /><Field label="Password" type="password" value={values.password} onChange={password => setValues({ ...values, password })} required /><Field label="Confirm Password" type="password" value={values.confirmPassword} onChange={confirmPassword => setValues({ ...values, confirmPassword })} required /></FormGrid>
    </Modal>
  );
}

function FormGrid({ children, onSubmit }) {
  return <form className="form-grid" onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<div className="form-actions"><button className="primary-btn compact">Save</button></div></form>;
}

function Field({ label, value, onChange, type = "text", span, ...props }) {
  return <label className={span ? "span-all" : ""}>{label}<input type={type} value={value} onChange={event => onChange?.(event.target.value)} {...props} /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)} required>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

createRoot(document.getElementById("root")).render(<App />);
