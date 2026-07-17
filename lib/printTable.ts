/**
 * Print an arbitrary table to the browser's print dialog (→ "Save as PDF").
 *
 * Renders into an isolated hidden <iframe> with its own light-theme print
 * stylesheet, so neither the app's dark theme nor the production HARDEN_SCRIPT
 * (which installs its listeners on the PARENT document only) interfere. It is
 * triggered programmatically, so the fact that Ctrl+P is blocked by the
 * deterrent script is irrelevant.
 *
 * Prints the rows passed in (the caller passes the full filtered+sorted set, not
 * just the visible page). NOTE: this is standard on browsers + Chromium/WebView2;
 * whether the FileMaker Web Viewer host surfaces a usable print / "Save as PDF"
 * dialog must be verified on the real device with the FileMaker developer.
 */
export function printTable(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}) {
  if (typeof document === "undefined") return;
  const esc = (s: string | null | undefined) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const thead = `<tr>${opts.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody =
    opts.rows.length === 0
      ? `<tr><td colspan="${opts.headers.length}">No rows.</td></tr>`
      : opts.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const stamp = new Date().toLocaleString();
  const meta = [opts.subtitle, `${opts.rows.length} rows`, stamp].filter(Boolean).map(esc).join(" · ");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Inter,Arial,Helvetica,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 2px}
  .sub{font-size:12px;color:#555;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;vertical-align:top;word-break:break-word}
  th{border-bottom:2px solid #333;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#000}
  tr{page-break-inside:avoid}
  thead{display:table-header-group}
  @page{margin:14mm}
</style></head>
<body>
  <h1>${esc(opts.title)}</h1>
  <p class="sub">${meta}</p>
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  doc.open();
  doc.write(html);
  doc.close();

  win.onafterprint = cleanup;
  // Give the isolated document a tick to lay out before printing.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* host blocked print — remove the iframe rather than leave it dangling */
    }
    // Fallback cleanup in case onafterprint never fires (some hosts).
    window.setTimeout(cleanup, 60000);
  }, 60);
}
