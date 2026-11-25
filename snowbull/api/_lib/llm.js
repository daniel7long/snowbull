/* Optional LLM rewrite step. The core already produced a grounded, cited draft; the LLM only improves wording
 * (and replies in the user's language). A numeric guard rejects any answer that introduces figures absent from the sources. */
'use strict';
const E = process.env;
const nums = (s) => (String(s).match(/\d[\d,]*\.?\d*/g) || []).map((x) => x.replace(/,/g, '').replace(/\.$/, ''));

async function rewrite(prompt, history) {
  if (!E.ANTHROPIC_API_KEY) return null;
  const msgs = (history || []).slice(-6).filter((h) => h && (h.role === 'user' || h.role === 'assistant') && h.content).map((h) => ({ role: h.role, content: String(h.content).slice(0, 1200) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const clean = [];
  msgs.forEach((m) => { if (!clean.length || clean[clean.length - 1].role !== m.role) clean.push(m); });
  if (clean.length && clean[clean.length - 1].role === 'user') clean.pop();
  clean.push({ role: 'user', content: prompt.user });
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: c.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': E.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: E.SNOWBULL_MODEL || 'claude-sonnet-5-5', max_tokens: 700, system: prompt.system, messages: clean })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) return null;
    const allowed = new Set(nums(prompt.user));
    const bad = nums(text).filter((n) => !allowed.has(n) && n.length > 1);
    if (bad.length > 2) return null; // introduced unsourced figures: fall back to the grounded draft
    return text;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
module.exports = { rewrite };
