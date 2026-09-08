// Customer help chat, backed by Groq (an OpenAI-compatible chat completions API). Not
// configured means the widget simply doesn't render -- see render.js -- so this file never
// runs at all until GROQ_API_KEY is set.

import * as db from './db.js';

function systemPrompt(env) {
  const site = env.SITE_NAME || 'Rarehaus';
  return `You are the customer help assistant for ${site}, an authenticated import marketplace \
selling sneakers, streetwear, watches, bags and collectibles in India. Answer only from the facts \
below. If you don't know something, say so and suggest the buyer email ${env.SUPPORT_EMAIL || 'support'} \
or WhatsApp ${env.SUPPORT_WHATSAPP || 'support'}. Keep answers short -- two or three sentences unless the \
question genuinely needs a list. Never invent a price, an order status, or a policy detail not listed here.

FACTS ABOUT ${site.toUpperCase()}:
- Marketplace model: many verified sellers list the same piece; the price shown is "landed" --
  seller price + import duty + authentication fee + shipping, all included, nothing added at checkout.
- Every piece is authenticated twice: once by the seller before listing, once independently in-house
  before it ships. Only after passing does it get sealed and a numbered certificate issued.
- Certificate numbers look like RH-26-SNK-00248-M and can be checked at /verify. The check character
  makes a typo or invented number fail instantly.
- Order tracking has four buyer-facing stages: Order placed, Shipped, Out for delivery, Delivered.
  Nothing shows as "Shipped" until the piece has passed the in-house authentication check.
- Refunds: if a piece fails authentication or is later shown not to be authentic, the buyer gets a
  full refund including duty and shipping -- nothing was legitimately imported for them. If the buyer
  simply changes their mind, duty and shipping are not refunded, only the piece and authentication fee.
- Typical import window is 14-28 days depending on the seller's location.
- Order references look like RH-4F2A19. To track an order, the buyer can use /track or /order/<ref>.
- Buyer accounts are optional; checkout works as a guest. Signing in links order history to an account.
- The site does not publish which country or seller a piece ships from -- this is intentionally private.`;
}

const ORDER_REF_RE = /\bRH-[0-9A-F]{6}\b/i;

export async function handleChat(request, env) {
  if (!env.GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'Chat is not set up yet.' }), {
      status: 501,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request.' }), { status: 400 });
  }

  const message = String(body?.message || '').trim().slice(0, 800);
  if (!message) return new Response(JSON.stringify({ error: 'Empty message.' }), { status: 400 });

  // Recent turns only, and only role/content -- never trust anything else the client sends.
  const history = Array.isArray(body?.history)
    ? body.history
        .slice(-8)
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }))
    : [];

  const messages = [{ role: 'system', content: systemPrompt(env) }, ...history];

  // If the message names a real order, look it up ourselves and hand the model the fact
  // rather than letting it guess -- same trust model as /track: knowing the reference is
  // treated as authorization to see that order's status, nothing more is exposed.
  const refMatch = message.match(ORDER_REF_RE);
  if (refMatch) {
    const order = await db.getOrderByRef(env.DB, refMatch[0]);
    messages.push({
      role: 'system',
      content: order
        ? `Order ${order.public_ref}: ${order.product_title}, status "${order.status}", expected ${order.eta_min || 'TBC'} to ${order.eta_max || 'TBC'}.`
        : `No order found with reference ${refMatch[0]}.`,
    });
  }

  messages.push({ role: 'user', content: message });

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GROQ_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error('Groq error:', res.status, await res.text().catch(() => ''));
      return new Response(JSON.stringify({ reply: "Sorry, I couldn't reach support chat just now. Try /contact instead." }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't catch that.";
    return new Response(JSON.stringify({ reply }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('Chat request failed:', err);
    return new Response(JSON.stringify({ reply: "Sorry, something went wrong. Try /contact instead." }), {
      headers: { 'content-type': 'application/json' },
    });
  }
}
