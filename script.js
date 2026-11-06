(function () {
  "use strict";
  let expression = "";
  let lastAnswer = 0;
  let angleMode = "DEG";
  const elExpr = document.getElementById("expression");
  const elRes  = document.getElementById("result");
  const degBtn = document.getElementById("degBtn");
  const radBtn = document.getElementById("radBtn");

  function render() { elExpr.textContent = expression || ""; }
  function showResult(v) { elRes.textContent = v; }
  function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let num = "";
        while (i < str.length && /[0-9.]/.test(str[i])) { num += str[i]; i++; }
        if ((num.match(/\./g) || []).length > 1) throw new Error("bad");
        tokens.push({ type: "num", value: parseFloat(num) });
        continue;
      }
      if ("+-*/^%()".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
      const match = /^(sin|cos|tan|log|ln|sqrt|pi|e)/.exec(str.slice(i));
      if (match) { tokens.push({ type: "name", value: match[1] }); i += match[1].length; continue; }
      throw new Error("bad");
    }
    return tokens;
  }
  function parse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function expect(v) { if (!peek() || peek().value !== v) throw new Error("bad"); pos++; }
    function parseExpr() {
      let left = parseTerm();
      while (peek() && (peek().value === "+" || peek().value === "-")) {
        const op = next().value; const right = parseTerm();
        left = op === "+" ? left + right : left - right;
      }
      return left;
    }
    function parseTerm() {
      let left = parseUnary();
      while (peek() && (peek().value === "*" || peek().value === "/" || peek().value === "%")) {
        const op = next().value; const right = parseUnary();
        if (op === "*") left *= right;
        else if (op === "/") { if (right === 0) throw new Error("div0"); left /= right; }
        else { left = left * (right / 100); }
      }
      return left;
    }
    function parseUnary() {
      if (peek() && peek().value === "-") { next(); return -parseUnary(); }
      if (peek() && peek().value === "+") { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().value === "^") { next(); return Math.pow(base, parseUnary()); }
      return base;
    }
    function parsePrimary() {
      const t = peek(); if (!t) throw new Error("bad");
      if (t.type === "num") { next(); return t.value; }
      if (t.value === "(") { next(); const v = parseExpr(); expect(")"); return v; }
      if (t.type === "name") {
        next(); const name = t.value;
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;
        expect("("); const arg = parseExpr(); expect(")");
        switch (name) {
          case "sin": return Math.sin(angleMode === "DEG" ? arg * Math.PI / 180 : arg);
          case "cos": return Math.cos(angleMode === "DEG" ? arg * Math.PI / 180 : arg);
          case "tan": return Math.tan(angleMode === "DEG" ? arg * Math.PI / 180 : arg);
          case "log": if (arg <= 0) throw new Error("bad"); return Math.log10(arg);
          case "ln": if (arg <= 0) throw new Error("bad"); return Math.log(arg);
          case "sqrt": if (arg < 0) throw new Error("bad"); return Math.sqrt(arg);
        }
      }
      throw new Error("bad");
    }
    const result = parseExpr();
    if (pos !== tokens.length) throw new Error("bad");
    if (!isFinite(result)) throw new Error("bad");
    return result;
  }
  function safeEval(expr) {
    if (!expr || !expr.trim()) throw new Error("empty");
    return parse(tokenize(expr));
  }
  function formatNumber(n) {
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toPrecision(12)));
  }
  function append(str) { expression += str; render(); livePreview(); }
  function livePreview() {
    try { if (!expression) { showResult("0"); return; } showResult(formatNumber(safeEval(expression))); } catch (e) {}
  }
  function clearAll() { expression = ""; render(); showResult("0"); }
  function del() { expression = expression.slice(0, -1); render(); if (!expression) showResult("0"); else livePreview(); }
  function calculate() {
    if (!expression) return;
    try {
      const val = safeEval(expression); lastAnswer = val;
      showResult(formatNumber(val)); expression = formatNumber(val); render();
    } catch (e) { showResult("Invalid expression"); }
  }
  document.getElementById("grid").addEventListener("click", function (ev) {
    const btn = ev.target.closest("button"); if (!btn) return;
    if (btn.dataset.num !== undefined) return append(btn.dataset.num);
    if (btn.dataset.op  !== undefined) { const op = btn.dataset.op; if (op === "×") append("*"); else if (op === "÷") append("/"); else if (op === "−") append("-"); else append(op); return; }
    if (btn.hasAttribute("data-ac"))  return clearAll();
    if (btn.hasAttribute("data-del")) return del();
    if (btn.hasAttribute("data-eq"))  return calculate();
    const fn = btn.dataset.fn;
    switch (fn) {
      case "sin": append("sin("); break; case "cos": append("cos("); break; case "tan": append("tan("); break;
      case "log": append("log("); break; case "ln": append("ln("); break; case "sqrt": append("sqrt("); break;
      case "sq": try { if (!expression) return; const v = safeEval(expression); expression = formatNumber(v * v); render(); showResult(expression); } catch (e) { showResult("Invalid expression"); } break;
      case "pow": append("^"); break;
      case "inv": try { if (!expression) return; const v = safeEval(expression); if (v === 0) { showResult("Invalid expression"); return; } expression = formatNumber(1 / v); render(); showResult(expression); } catch (e) { showResult("Invalid expression"); } break;
      case "pi": append("pi"); break; case "e": append("e"); break;
      case "neg": if (!expression) break; if (expression.startsWith("-(") && expression.endsWith(")")) expression = expression.slice(2, -1); else expression = "-(" + expression + ")"; render(); livePreview(); break;
      case "ans": append(String(lastAnswer)); break;
    }
  });
  function setMode(m) { angleMode = m; degBtn.classList.toggle("active", m === "DEG"); radBtn.classList.toggle("active", m === "RAD"); livePreview(); }
  degBtn.addEventListener("click", () => setMode("DEG"));
  radBtn.addEventListener("click", () => setMode("RAD"));
  document.addEventListener("keydown", function (ev) {
    const k = ev.key;
    if (/^[0-9]$/.test(k)) { append(k); ev.preventDefault(); return; }
    if (k === ".") { append("."); ev.preventDefault(); return; }
    if (k === "+" || k === "-" || k === "*" || k === "/") { append(k); ev.preventDefault(); return; }
    if (k === "(" || k === ")") { append(k); ev.preventDefault(); return; }
    if (k === "^") { append("^"); ev.preventDefault(); return; }
    if (k === "Enter" || k === "=") { calculate(); ev.preventDefault(); return; }
    if (k === "Backspace") { del(); ev.preventDefault(); return; }
    if (k === "Escape") { clearAll(); ev.preventDefault(); return; }
  });
  clearAll();
})();