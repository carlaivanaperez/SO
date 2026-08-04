"use client";
import { useEffect, useMemo, useState } from "react";
import { whatsappUrl, type PublicCatalogItem, type StoreSettings } from "@ferrestock/shared";

const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;
const NO_CAT = "__none__";
const CART_KEY = "ferrestock.pedido";

export function CatalogView({ store, items }: { store: StoreSettings; items: PublicCatalogItem[] }) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null); // null = todos
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);
  // Datos del pedido (para el mensaje de WhatsApp).
  const [customerName, setCustomerName] = useState("");
  const [comment, setComment] = useState("");
  const [method, setMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState("");

  // Cargar/guardar el pedido en el navegador (persiste entre visitas).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* ignorar */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignorar */
    }
  }, [cart]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const catKey = (it: PublicCatalogItem) => it.category?.id ?? NO_CAT;

  // Rubros presentes en el catálogo (para el filtro), con su cantidad.
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const it of items) {
      const id = catKey(it);
      const name = it.category?.name ?? "Otros";
      const prev = map.get(id);
      if (prev) prev.count++;
      else map.set(id, { id, name, count: 1 });
    }
    return [...map.values()].sort((a, b) => {
      if (a.id === NO_CAT) return 1; // "Otros" al final
      if (b.id === NO_CAT) return -1;
      return a.name.localeCompare(b.name, "es");
    });
  }, [items]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((it) => {
        const okSearch =
          !q || it.name.toLowerCase().includes(q) || (it.brand ?? "").toLowerCase().includes(q);
        const okCat = !activeCat || catKey(it) === activeCat;
        return okSearch && okCat;
      }),
    [items, q, activeCat]
  );

  // Cuando no hay búsqueda ni rubro elegido, mostramos agrupado por rubro.
  const grouped = !q && !activeCat;
  const sections = useMemo(() => {
    if (!grouped) return [{ id: "all", name: "", items: filtered }];
    return categories
      .map((c) => ({ id: c.id, name: c.name, items: filtered.filter((it) => catKey(it) === c.id) }))
      .filter((s) => s.items.length > 0);
  }, [grouped, categories, filtered]);

  // ── Carrito de pedido ──────────────────────────────────────────────
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const setQty = (id: string, n: number) =>
    setCart((c) => {
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  const clear = () => setCart({});

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ item: itemById.get(id), qty }))
    .filter((l): l is { item: PublicCatalogItem; qty: number } => !!l.item);
  const count = cartLines.reduce((s, l) => s + l.qty, 0);
  const total = cartLines.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);

  const orderMessage = () => {
    const lines = cartLines.map(
      (l) => `- ${l.qty} x ${l.item.name}${l.item.brand ? ` (${l.item.brand})` : ""} — ${money(Number(l.item.price) * l.qty)}`
    );
    const header = customerName.trim() ? `Hola! Soy ${customerName.trim()}.` : "Hola!";
    const entrega =
      method === "DELIVERY"
        ? `Entrega: Envío${address.trim() ? ` a ${address.trim()}` : ""}`
        : "Entrega: Retiro en el local";
    let msg = `${header}\nQuiero hacer este pedido:\n${lines.join("\n")}\n\nTotal: ${money(total)}\n\n${entrega}`;
    if (comment.trim()) msg += `\nComentario: ${comment.trim()}`;
    return msg;
  };
  const orderWa = store.whatsappPhone && count > 0 ? whatsappUrl(store.whatsappPhone, orderMessage()) : null;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px 96px" }}>
      {/* Encabezado del negocio (con logo) */}
      <header
        style={{
          background: "var(--yellow)",
          color: "#141414",
          borderRadius: 16,
          padding: "24px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 12,
            flexShrink: 0,
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            lineHeight: 0,
          }}
        >
          <img
            src="/logo.png"
            alt={store.storeName}
            style={{ height: 110, width: 110, objectFit: "contain", display: "block" }}
            onError={(e) => {
              // Si no hay logo, ocultamos el recuadro blanco entero.
              const box = e.currentTarget.parentElement;
              if (box) box.style.display = "none";
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 30 }}>{store.storeName}</h1>
          <p style={{ margin: "6px 0 0", fontWeight: 600, fontSize: 16 }}>
            Armá tu pedido y envialo por WhatsApp. 🧰
          </p>
        </div>
      </header>

      {/* Buscador */}
      <input
        className="input"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔎 Buscar producto…"
        style={{ marginBottom: 12 }}
      />

      {/* Filtro por rubro */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 16 }}>
        <Chip active={!activeCat} onClick={() => setActiveCat(null)}>
          Todos
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
            {c.name} ({c.count})
          </Chip>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="muted" style={{ padding: 24, textAlign: "center" }}>
          No encontramos productos {q ? `para “${search}”` : "en este rubro"}.
        </p>
      )}

      {/* Productos (agrupados por rubro o lista filtrada) */}
      {sections.map((sec) => (
        <section key={sec.id} style={{ marginBottom: 20 }}>
          {sec.name && (
            <h2 style={{ fontSize: 18, margin: "8px 0 12px", borderBottom: "2px solid var(--yellow)", paddingBottom: 4 }}>
              {sec.name}
            </h2>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {sec.items.map((p) => (
              <ProductCard key={p.id} p={p} qty={cart[p.id] ?? 0} onAdd={() => add(p.id)} onQty={(n) => setQty(p.id, n)} />
            ))}
          </div>
        </section>
      ))}

      <p className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: "center" }}>
        Los precios incluyen IVA. La disponibilidad puede variar; confirmá por WhatsApp.
      </p>

      {/* Pie: datos del negocio (dirección y horarios) */}
      {(store.address || store.hours) && (
        <footer
          className="card"
          style={{ marginTop: 20, textAlign: "center", background: "var(--bg)" }}
        >
          <strong style={{ display: "block", marginBottom: 6 }}>{store.storeName}</strong>
          {store.address && (
            <div className="muted" style={{ fontSize: 14 }}>📍 {store.address}</div>
          )}
          {store.hours && (
            <div className="muted" style={{ fontSize: 14, whiteSpace: "pre-line", marginTop: 4 }}>
              🕒 {store.hours}
            </div>
          )}
        </footer>
      )}

      {/* Barra flotante del pedido */}
      {count > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--card)",
            borderTop: "2px solid var(--yellow)",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            zIndex: 50,
          }}
        >
          <span style={{ fontWeight: 700 }}>
            {count} {count === 1 ? "producto" : "productos"} · {money(total)}
          </span>
          <button className="btn btn-primary" onClick={() => setShowCart(true)}>
            Ver pedido
          </button>
        </div>
      )}

      {/* Panel del pedido */}
      {showCart && (
        <div
          onClick={() => setShowCart(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", borderRadius: "16px 16px 0 0" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Mi pedido</h2>
              <button
                onClick={() => setShowCart(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text)" }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {cartLines.length === 0 && <p className="muted">Tu pedido está vacío.</p>}

            {cartLines.map((l) => (
              <div
                key={l.item.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{l.item.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{money(l.item.price)} c/u</div>
                </div>
                <QtyControls qty={l.qty} onQty={(n) => setQty(l.item.id, n)} />
                <span style={{ width: 90, textAlign: "right", fontWeight: 700 }}>
                  {money(Number(l.item.price) * l.qty)}
                </span>
              </div>
            ))}

            {cartLines.length > 0 && (
              <>
                <p style={{ fontSize: 20, fontWeight: 800, textAlign: "right", marginTop: 12 }}>
                  Total: {money(total)}
                </p>

                {/* Datos del pedido */}
                <label className="field">
                  <span className="label">Tu nombre</span>
                  <input
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                </label>

                <div className="field">
                  <span className="label">¿Cómo lo querés recibir?</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Chip active={method === "PICKUP"} onClick={() => setMethod("PICKUP")}>
                      Retiro en el local
                    </Chip>
                    <Chip active={method === "DELIVERY"} onClick={() => setMethod("DELIVERY")}>
                      Envío
                    </Chip>
                  </div>
                </div>

                {method === "DELIVERY" && (
                  <label className="field">
                    <span className="label">Dirección de envío</span>
                    <input
                      className="input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, número, barrio…"
                    />
                  </label>
                )}

                <label className="field">
                  <span className="label">Comentario (opcional)</span>
                  <textarea
                    className="input"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Ej: lo necesito para el sábado"
                  />
                </label>

                {orderWa ? (
                  <a href={orderWa} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-block">
                    Enviar pedido por WhatsApp
                  </a>
                ) : (
                  <p className="muted" style={{ textAlign: "center" }}>
                    El negocio todavía no cargó su WhatsApp para recibir pedidos.
                  </p>
                )}
                <button className="btn btn-outline btn-block" style={{ marginTop: 8 }} onClick={clear}>
                  Vaciar pedido
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        padding: "7px 14px",
        borderRadius: 999,
        border: "2px solid var(--yellow)",
        background: active ? "var(--yellow)" : "transparent",
        color: active ? "#141414" : "var(--text)",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function QtyControls({ qty, onQty }: { qty: number; onQty: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onQty(qty - 1)}
        style={{ width: 32, minHeight: 32, padding: 0, fontSize: 18 }}
        aria-label="Restar"
      >
        −
      </button>
      <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{qty}</span>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onQty(qty + 1)}
        style={{ width: 32, minHeight: 32, padding: 0, fontSize: 18 }}
        aria-label="Sumar"
      >
        +
      </button>
    </div>
  );
}

function ProductCard({
  p,
  qty,
  onAdd,
  onQty,
}: {
  p: PublicCatalogItem;
  qty: number;
  onAdd: () => void;
  onQty: (n: number) => void;
}) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          {p.promoLabel && <span className="badge badge-warn">🏷️ {p.promoLabel}</span>}
          <span className={`badge ${p.available ? "badge-ok" : "badge-low"}`}>
            {p.available ? "Disponible" : "Sin stock"}
          </span>
        </div>
        <strong style={{ display: "block", fontSize: 16 }}>{p.name}</strong>
        {p.brand && <span className="muted" style={{ fontSize: 13 }}>{p.brand}</span>}
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{money(p.price)}</div>
      </div>

      {qty > 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <QtyControls qty={qty} onQty={onQty} />
          <span className="muted" style={{ fontSize: 13 }}>en el pedido</span>
        </div>
      ) : (
        <button className="btn btn-primary btn-block" onClick={onAdd}>
          Agregar al pedido
        </button>
      )}
    </div>
  );
}
