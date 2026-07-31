import "./style.css";
import { createIcons, icons } from "lucide";
import { initJadeCanvas } from "./jade-canvas";

type Bookmark = {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  visibility: "public" | "private";
  accent: string;
  is_favorite: number;
  is_pinned: number;
  click_count: number;
  created_at: string;
  updated_at: string;
};
type Category = { category: string; count: number };
type MetaResponse = { count: number; categories: Category[]; authenticated: boolean };
type BookmarksResponse = { items: Bookmark[]; authenticated: boolean };
type ApiError = { error?: string };

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const state = {
  items: [] as Bookmark[],
  categories: [] as Category[],
  authenticated: false,
  category: "",
  query: "",
  requestId: 0,
};

const elements = {
  list: $("#bookmark-list"), skeleton: $("#skeleton"), empty: $("#empty-state"), emptyTitle: $("#empty-title"), emptyCopy: $("#empty-copy"),
  total: $("#total-count"), visible: $("#visible-count"), filter: $("#category-filter"), search: $("#search-input") as HTMLInputElement, status: $("#status-region"),
  loginButton: $("#login-button") as HTMLButtonElement, logoutButton: $("#logout-button") as HTMLButtonElement, sessionLabel: $("#session-label"), addButton: $("#add-button") as HTMLButtonElement,
  loginDialog: $("#login-dialog") as HTMLDialogElement, editorDialog: $("#editor-dialog") as HTMLDialogElement, deleteDialog: $("#delete-dialog") as HTMLDialogElement,
  loginForm: $("#login-form") as HTMLFormElement, editorForm: $("#editor-form") as HTMLFormElement, deleteForm: $("#delete-form") as HTMLFormElement,
  loginError: $("#login-error"), editorError: $("#editor-error"), deleteError: $("#delete-error"), toast: $("#toast-region"),
};

function refreshIcons(_root: HTMLElement | Document = document): void {
  createIcons({ icons, attrs: { "stroke-width": "1.7", "aria-hidden": "true" }, nameAttr: "data-lucide" });
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login")) setAuthenticated(false);
    throw new Error(body.error || "请求未能完成，请稍后重试");
  }
  return body;
}

function setAuthenticated(authenticated: boolean): void {
  state.authenticated = authenticated;
  elements.loginButton.hidden = authenticated;
  elements.logoutButton.hidden = !authenticated;
  elements.sessionLabel.hidden = !authenticated;
  elements.addButton.hidden = !authenticated;
  document.body.classList.toggle("is-admin", authenticated);
}

function setBusy(form: HTMLFormElement, busy: boolean, text: string): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const span = button.querySelector("span");
  if (span) span.textContent = busy ? text : button.dataset.defaultText || span.textContent || "提交";
}

function showError(element: HTMLElement, message = ""): void {
  element.textContent = message;
  element.hidden = !message;
}

function toast(message: string, tone: "success" | "error" = "success"): void {
  const item = document.createElement("div");
  item.className = `toast ${tone}`;
  const icon = document.createElement("i"); icon.dataset.lucide = tone === "success" ? "check-circle-2" : "circle-alert";
  const text = document.createElement("span"); text.textContent = message;
  item.append(icon, text); elements.toast.append(item); refreshIcons(item);
  window.setTimeout(() => { item.classList.add("leaving"); window.setTimeout(() => item.remove(), 220); }, 3200);
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function initials(title: string): string {
  return Array.from(title.trim()).slice(0, 2).join("").toUpperCase() || "玉";
}

function makeIcon(name: string): HTMLElement {
  const icon = document.createElement("i"); icon.dataset.lucide = name; return icon;
}

function makeCard(item: Bookmark, index: number): HTMLElement {
  const article = document.createElement("article");
  article.className = `bookmark-card accent-${["gold", "amber", "blue", "violet", "plum"].includes(item.accent) ? item.accent : "gold"}`;
  article.style.setProperty("--order", String(Math.min(index, 10)));
  article.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const rect = article.getBoundingClientRect();
    article.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    article.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });

  const top = document.createElement("div"); top.className = "card-top";
  const monogram = document.createElement("span"); monogram.className = "site-monogram"; monogram.textContent = initials(item.title);
  const badges = document.createElement("div"); badges.className = "card-badges";
  if (item.is_pinned) { const badge = document.createElement("span"); badge.className = "pin-badge"; badge.append(makeIcon("pin"), "置顶"); badges.append(badge); }
  if (item.visibility === "private") { const badge = document.createElement("span"); badge.className = "private-badge"; badge.append(makeIcon("eye-off"), "私藏"); badges.append(badge); }
  top.append(monogram, badges);

  const body = document.createElement("div"); body.className = "card-body";
  const category = document.createElement("p"); category.className = "card-category"; category.textContent = item.category || "未分类";
  const titleLink = document.createElement("a"); titleLink.className = "card-title-link"; titleLink.href = item.url; titleLink.target = "_blank"; titleLink.rel = "noopener noreferrer";
  const title = document.createElement("h3"); title.textContent = item.title;
  titleLink.append(title);
  titleLink.addEventListener("click", () => { void fetch(`/api/bookmarks/${encodeURIComponent(item.id)}/click`, { method: "POST", keepalive: true }); });
  const description = document.createElement("p"); description.className = "card-description"; description.textContent = item.description || "一处等待再次探访的网络坐标。";
  body.append(category, titleLink, description);

  if (item.tags?.length) {
    const tags = document.createElement("div"); tags.className = "tags";
    item.tags.slice(0, 4).forEach((value) => { const tag = document.createElement("span"); tag.textContent = `# ${value}`; tags.append(tag); });
    body.append(tags);
  }

  const footer = document.createElement("div"); footer.className = "card-footer";
  const link = document.createElement("a"); link.className = "visit-link"; link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
  const domain = document.createElement("span"); domain.textContent = domainOf(item.url); link.append(domain, makeIcon("arrow-up-right"));
  link.addEventListener("click", () => { void fetch(`/api/bookmarks/${encodeURIComponent(item.id)}/click`, { method: "POST", keepalive: true }); });
  footer.append(link);

  if (state.authenticated) {
    const actions = document.createElement("div"); actions.className = "card-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.title = "编辑收藏"; edit.setAttribute("aria-label", `编辑 ${item.title}`); edit.append(makeIcon("pencil")); edit.addEventListener("click", () => openEditor(item));
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-action"; remove.title = "移除收藏"; remove.setAttribute("aria-label", `移除 ${item.title}`); remove.append(makeIcon("trash-2")); remove.addEventListener("click", () => openDelete(item));
    actions.append(edit, remove); footer.append(actions);
  }
  article.append(top, body, footer); return article;
}

function renderItems(): void {
  elements.list.replaceChildren(...state.items.map(makeCard));
  elements.skeleton.hidden = true;
  const isEmpty = state.items.length === 0;
  elements.empty.hidden = !isEmpty;
  if (isEmpty) {
    const filtered = Boolean(state.query || state.category);
    elements.emptyTitle.textContent = filtered ? "没有寻到相符的微光" : state.authenticated ? "此处尚待第一枚玉简" : "此处尚待生长";
    elements.emptyCopy.textContent = filtered ? "换一个关键词或分类，或许会抵达别处。" : state.authenticated ? "添加一处值得反复探访的网络坐标，让收藏从这里开始。" : "收藏者仍在沿途拾取，稍后再来看看。";
    $("#empty-action").textContent = filtered ? "清除筛选" : state.authenticated ? "添加收藏" : "重新载入";
  }
  elements.status.textContent = `已显示 ${state.items.length} 枚收藏`;
  elements.visible.textContent = String(state.items.length).padStart(2, "0");
  refreshIcons(elements.list);
}

function renderCategories(): void {
  const categories = [{ category: "", count: Number(elements.total.textContent) || state.items.length }, ...state.categories];
  elements.filter.replaceChildren(...categories.map((entry) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "filter-chip";
    button.classList.toggle("active", state.category === entry.category); button.setAttribute("aria-pressed", String(state.category === entry.category));
    const label = document.createElement("span"); label.textContent = entry.category || "全部";
    const count = document.createElement("small"); count.textContent = String(entry.count);
    button.append(label, count); button.addEventListener("click", () => { state.category = entry.category; renderCategories(); void loadBookmarks(); }); return button;
  }));
  const datalist = $("#category-options"); datalist.replaceChildren(...state.categories.map(({ category }) => { const option = document.createElement("option"); option.value = category; return option; }));
}

async function loadMeta(): Promise<void> {
  const meta = await api<MetaResponse>("/api/meta");
  state.categories = meta.categories; elements.total.textContent = String(meta.count); setAuthenticated(meta.authenticated); renderCategories();
}

async function loadBookmarks(): Promise<void> {
  const requestId = ++state.requestId;
  const params = new URLSearchParams(); if (state.query) params.set("q", state.query); if (state.category) params.set("category", state.category);
  try {
    const result = await api<BookmarksResponse>(`/api/bookmarks${params.size ? `?${params}` : ""}`);
    if (requestId !== state.requestId) return;
    state.items = result.items; setAuthenticated(result.authenticated); renderItems();
  } catch (error) {
    if (requestId !== state.requestId) return;
    elements.skeleton.hidden = true; state.items = []; renderItems(); toast(error instanceof Error ? error.message : "载入失败", "error");
  }
}

async function refreshAll(): Promise<void> { await Promise.all([loadMeta(), loadBookmarks()]); }

function openDialog(dialog: HTMLDialogElement): void {
  dialog.showModal(); document.body.classList.add("modal-open");
}
function closeDialog(dialog: HTMLDialogElement): void { dialog.close(); document.body.classList.remove("modal-open"); }

function openEditor(item?: Bookmark): void {
  elements.editorForm.reset(); showError(elements.editorError);
  $("#editor-title").textContent = item ? "编辑收藏" : "添加收藏";
  ($("#bookmark-id") as HTMLInputElement).value = item?.id || "";
  ($("#title-input") as HTMLInputElement).value = item?.title || "";
  ($("#url-input") as HTMLInputElement).value = item?.url || "";
  ($("#description-input") as HTMLTextAreaElement).value = item?.description || "";
  ($("#category-input") as HTMLInputElement).value = item?.category || "";
  ($("#tags-input") as HTMLInputElement).value = item?.tags?.join(", ") || "";
  const visibility = elements.editorForm.querySelector<HTMLInputElement>(`input[name="visibility"][value="${item?.visibility || "public"}"]`); if (visibility) visibility.checked = true;
  openDialog(elements.editorDialog); window.setTimeout(() => ($("#title-input") as HTMLInputElement).focus(), 50);
}

function openDelete(item: Bookmark): void {
  ($("#delete-id") as HTMLInputElement).value = item.id; $("#delete-name").textContent = item.title; showError(elements.deleteError); openDialog(elements.deleteDialog);
}

function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): (...args: Parameters<T>) => void {
  let timer = 0; return (...args) => { window.clearTimeout(timer); timer = window.setTimeout(() => fn(...args), wait); };
}

elements.search.addEventListener("input", debounce(() => { state.query = elements.search.value.trim(); void loadBookmarks(); }, 260));
elements.loginButton.addEventListener("click", () => { elements.loginForm.reset(); showError(elements.loginError); openDialog(elements.loginDialog); window.setTimeout(() => ($("#password-input") as HTMLInputElement).focus(), 50); });
elements.addButton.addEventListener("click", () => openEditor());

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); showError(elements.loginError); setBusy(elements.loginForm, true, "验证中…");
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password: ($("#password-input") as HTMLInputElement).value }) });
    closeDialog(elements.loginDialog); toast("已进入管理模式"); await refreshAll();
  } catch (error) { showError(elements.loginError, error instanceof Error ? error.message : "登录失败"); }
  finally { setBusy(elements.loginForm, false, ""); }
});

elements.logoutButton.addEventListener("click", async () => {
  elements.logoutButton.disabled = true;
  try { await api("/api/auth/logout", { method: "POST" }); state.category = ""; state.query = ""; elements.search.value = ""; setAuthenticated(false); toast("已安全退出"); await refreshAll(); }
  catch (error) { toast(error instanceof Error ? error.message : "退出失败", "error"); }
  finally { elements.logoutButton.disabled = false; }
});

elements.editorForm.addEventListener("submit", async (event) => {
  event.preventDefault(); showError(elements.editorError); setBusy(elements.editorForm, true, "保存中…");
  const id = ($("#bookmark-id") as HTMLInputElement).value;
  const visibility = elements.editorForm.querySelector<HTMLInputElement>('input[name="visibility"]:checked')?.value || "public";
  const payload = {
    title: ($("#title-input") as HTMLInputElement).value, url: ($("#url-input") as HTMLInputElement).value,
    description: ($("#description-input") as HTMLTextAreaElement).value, category: ($("#category-input") as HTMLInputElement).value,
    tags: ($("#tags-input") as HTMLInputElement).value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean), visibility,
  };
  try {
    await api(id ? `/api/bookmarks/${encodeURIComponent(id)}` : "/api/bookmarks", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    closeDialog(elements.editorDialog); toast(id ? "玉简已更新" : "新玉简已收入册中"); await refreshAll();
  } catch (error) { showError(elements.editorError, error instanceof Error ? error.message : "保存失败"); }
  finally { setBusy(elements.editorForm, false, ""); }
});

elements.deleteForm.addEventListener("submit", async (event) => {
  event.preventDefault(); showError(elements.deleteError); setBusy(elements.deleteForm, true, "移除中…");
  const id = ($("#delete-id") as HTMLInputElement).value;
  try { await api(`/api/bookmarks/${encodeURIComponent(id)}`, { method: "DELETE" }); closeDialog(elements.deleteDialog); toast("玉简已移除"); await refreshAll(); }
  catch (error) { showError(elements.deleteError, error instanceof Error ? error.message : "移除失败"); }
  finally { setBusy(elements.deleteForm, false, ""); }
});

document.querySelectorAll<HTMLElement>("[data-close]").forEach((button) => button.addEventListener("click", () => { const dialog = button.closest("dialog"); if (dialog instanceof HTMLDialogElement) closeDialog(dialog); }));
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
  dialog.addEventListener("cancel", () => document.body.classList.remove("modal-open"));
});
$("#empty-action").addEventListener("click", () => {
  if (!state.items.length && !state.query && !state.category && state.authenticated) return openEditor();
  state.query = ""; state.category = ""; elements.search.value = ""; renderCategories(); void refreshAll();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); elements.search.focus(); }
  if (!event.metaKey && !event.ctrlKey && event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { event.preventDefault(); elements.search.focus(); }
});

$("#year").textContent = String(new Date().getFullYear());
refreshIcons();
initJadeCanvas();
void refreshAll();

/* ═══════════════════════════════════════════════════
   进入玉简：状态过渡（非跳转非滚动，动态加载式）
   ═══════════════════════════════════════════════════ */
const enterButton = document.getElementById("enter-archive") as HTMLButtonElement;
const heroSection = document.getElementById("hero") as HTMLElement;
const archiveSection = document.getElementById("archive") as HTMLElement;
const siteHeader = document.querySelector<HTMLElement>(".site-header");

let entered = false;

function enterArchive(): void {
  if (entered) return;
  entered = true;

  // Reset state from a previous leaveArchive
  heroSection!.classList.remove("leaving");
  heroSection!.style.display = "block";
  archiveSection!.classList.remove("returning", "react-enter");
  archiveSection!.style.display = "none";

  document.body.classList.add("entering");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    heroSection!.style.display = "none";
    archiveSection!.style.display = "block";
    document.body.classList.remove("entering");
    return;
  }

  // Phase 1: hero dissolves out (CSS animation 0.85s)
  heroSection!.classList.add("leaving");
  siteHeader?.classList.add("transiting");

  // Phase 2: hide hero AFTER the departure animation actually finishes
  const heroMs = 900;
  heroSection!.addEventListener("animationend", function onHeroDone() {
    heroSection!.removeEventListener("animationend", onHeroDone);
    heroSection!.style.display = "none";
    archiveSection!.style.display = "block";
    archiveSection!.classList.add("react-enter");
    document.body.classList.remove("entering");
    document.body.style.overflow = "";
    document.documentElement.style.removeProperty("scroll-behavior");
  }, { once: true });

  // Fallback: if animationend never fires (inactive tab), force the transition.
  window.setTimeout(() => {
    if (heroSection!.style.display !== "none") {
      heroSection!.style.display = "none";
      archiveSection!.style.display = "block";
      archiveSection!.classList.add("react-enter");
      document.body.classList.remove("entering");
      document.body.style.overflow = "";
      document.documentElement.style.removeProperty("scroll-behavior");
    }
  }, heroMs + 300);

  // Phase 3: cleanup after archive entrance (delay 0.55s + duration 0.7s ≈ 1.25s after phase 2)
  const totalCleanup = heroMs + 300 + 1250 + 150;
  window.setTimeout(() => {
    archiveSection!.classList.remove("react-enter");
    siteHeader?.classList.remove("transiting");
  }, totalCleanup);
}

function leaveArchive(): void {
  if (!entered) return;
  entered = false;

  // Reset hero
  heroSection!.classList.remove("leaving");
  heroSection!.style.display = "block";

  // Hide archive completely
  archiveSection!.classList.remove("react-enter");
  archiveSection!.style.display = "none";

  document.body.classList.remove("entering");
  document.body.style.overflow = "";

  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

enterButton.addEventListener("click", () => { history.pushState({ archive: true }, "", "#archive"); enterArchive(); });

// "返回深处" footer link + browser back/forward
function handleReturn(): void {
  if (entered) leaveArchive();
}

const footerLink = document.querySelector<HTMLAnchorElement>("#back-to-depth");
if (footerLink) {
  footerLink.addEventListener("click", (event) => {
    event.preventDefault();
    if (entered) { history.back(); }
    else { window.scrollTo({ top: 0, behavior: "smooth" }); }
  });
}

window.addEventListener("popstate", (event) => {
  if (event.state?.archive && !entered) enterArchive();
  else if (!event.state?.archive && entered) handleReturn();
});

// If user lands directly on #archive (e.g. refresh), enter archive
if (location.hash === "#archive") enterArchive();
