"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getToken, getUser, canManage, type SessionUser } from "@/lib/auth";

type Audience = "all" | "manage" | "admin";

// Cada tema de la guía, con a quién le sirve (para no marear al vendedor con
// cosas que no usa).
type Topic = { emoji: string; title: string; audience: Audience; body: ReactNode };

export default function HelpPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  const manage = canManage(user);
  const admin = user?.role === "ADMIN";
  const canSee = (a: Audience) => a === "all" || (a === "manage" && manage) || (a === "admin" && admin);

  const topics: Topic[] = [
    {
      emoji: "👋",
      title: "¿Qué es esta app?",
      audience: "all",
      body: (
        <>
          <p>
            Es el sistema del negocio para <strong>vender</strong>, controlar el{" "}
            <strong>stock</strong>, llevar la <strong>cuenta de los clientes</strong> y responder
            consultas por <strong>WhatsApp</strong>. Funciona en la computadora del local y también
            en el celular (se usa igual, con el dedo).
          </p>
          <p className="muted">
            Consejo: si algo no te aparece, puede ser que tu usuario no tenga ese permiso. Es normal
            — cada persona ve lo que le toca hacer.
          </p>
        </>
      ),
    },
    {
      emoji: "🔑",
      title: "Entrar y cerrar sesión",
      audience: "all",
      body: (
        <ol>
          <li>Abrí la app y poné tu <strong>correo</strong> y <strong>contraseña</strong>.</li>
          <li>Si te olvidaste los datos, pediselos al encargado o al dueño.</li>
          <li>
            Para salir, tocá <strong>“Salir”</strong> arriba a la derecha. En una compu compartida,
            cerrá sesión al terminar tu turno.
          </li>
          <li>
            Arriba a la derecha también está el botón de <strong>modo oscuro/claro</strong>, por si
            te cansa la vista.
          </li>
        </ol>
      ),
    },
    {
      emoji: "🧾",
      title: "Hacer una venta",
      audience: "all",
      body: (
        <>
          <ol>
            <li>Entrá a la pestaña <strong>“Vender”</strong>.</li>
            <li>
              En <strong>“Agregar producto”</strong> buscá por nombre, código o código de barras y
              tocá <strong>“+ Agregar”</strong>. Repetí por cada producto.
            </li>
            <li>Ajustá las cantidades con los botones <strong>−</strong> y <strong>+</strong>.</li>
            <li>
              Elegí el <strong>medio de pago</strong> (efectivo, tarjeta, transferencia o cuenta
              corriente).
            </li>
            <li>
              Mirá el <strong>Total</strong> y tocá <strong>“Confirmar venta”</strong>. ¡Listo! El
              stock se descuenta solo.
            </li>
          </ol>
          <p className="muted">
            Si un producto tiene una etiqueta de promoción, el descuento se aplica automáticamente
            (siempre que el medio de pago esté habilitado para esa promo).
          </p>
          <p className="muted">
            El <strong>Total ya incluye IVA</strong>: es exactamente lo que paga el cliente, sin
            sorpresas ni sumas aparte.
          </p>
        </>
      ),
    },
    {
      emoji: "📒",
      title: "Vender “fiado” (cuenta corriente) y en cuotas",
      audience: "all",
      body: (
        <>
          <p>Cuando un cliente se lleva la mercadería y paga después:</p>
          <ol>
            <li>Elegí el medio de pago <strong>“Cuenta corriente”</strong>.</li>
            <li>
              Elegí el <strong>cliente</strong> (es obligatorio). Si es nuevo, tocá{" "}
              <strong>“+ Cargar cliente nuevo”</strong> ahí mismo, sin salir de la venta.
            </li>
            <li>
              Si querés dividir el pago, marcá <strong>“Financiar en cuotas”</strong>, elegí cuántas
              y —si corresponde— <strong>“Aplicar recargo por financiación”</strong>. Vas a ver el
              monto de cada cuota antes de confirmar.
            </li>
            <li>Confirmá la venta. La deuda queda registrada en la cuenta del cliente.</li>
          </ol>
          <p className="muted">
            Si no marcás cuotas, la cuenta queda “abierta”: el cliente paga cuando puede.
          </p>
        </>
      ),
    },
    {
      emoji: "💬",
      title: "Clientes y WhatsApp",
      audience: "all",
      body: (
        <>
          <p>
            En la pestaña <strong>“Clientes”</strong> ves a todos, con su saldo. Para hablarle a
            uno, tocá el <strong>ícono verde de WhatsApp</strong>: se abre el chat con un mensaje ya
            escrito.
          </p>
          <ul>
            <li>
              Si el cliente <strong>debe</strong>, el mensaje ya menciona el monto (recordatorio de
              deuda). Solo tocás <strong>enviar</strong>.
            </li>
            <li>
              El filtro <strong>“Solo con deuda”</strong> te deja ver rapidito a quiénes cobrarles.
            </li>
            <li>
              Entrando a un cliente ves su <strong>saldo</strong>, sus <strong>cuotas</strong> (cuáles
              están al día o vencidas) y el botón <strong>“Recordar deuda por WhatsApp”</strong>.
            </li>
            <li>
              En el <strong>catálogo</strong>, cada producto tiene un ícono verde de WhatsApp para{" "}
              <strong>compartirlo en un grupo o comunidad</strong>: se abre WhatsApp con el mensaje
              (nombre, precio y promo si tiene) y vos elegís a dónde mandarlo.
            </li>
          </ul>
        </>
      ),
    },
    {
      emoji: "💵",
      title: "Registrar un pago o una cuota",
      audience: "manage",
      body: (
        <ol>
          <li>Entrá al cliente desde la pestaña <strong>“Clientes”</strong>.</li>
          <li>
            En <strong>“Registrar pago”</strong> poné el monto y el medio, y guardá. El saldo baja
            solo y los pagos se aplican a las cuotas más viejas primero.
          </li>
          <li>
            Si hay que hacer una devolución o corregir, usá <strong>“Nota de crédito”</strong>.
          </li>
        </ol>
      ),
    },
    {
      emoji: "📦",
      title: "Stock: catálogo, semáforo y ajustes",
      audience: "manage",
      body: (
        <>
          <p>En el <strong>Panel</strong> ves el catálogo con un semáforo de stock:</p>
          <ul>
            <li>🟢 <strong>Verde</strong>: hay stock de sobra.</li>
            <li>🟡 <strong>Amarillo</strong>: está por debajo del mínimo, conviene reponer.</li>
            <li>🔴 <strong>Rojo</strong>: sin stock.</li>
          </ul>
          <ol>
            <li>Para corregir una cantidad, tocá <strong>“Stock”</strong> en la fila del producto.</li>
            <li>Cargá el ajuste (entrada o salida) y el motivo. Queda registrado quién y cuándo.</li>
          </ol>
          <p className="muted">Nunca hace falta “tocar” el número a mano: siempre cargás un movimiento y el sistema lleva la cuenta.</p>
        </>
      ),
    },
    {
      emoji: "🛒",
      title: "Planilla de compra (reponer stock)",
      audience: "manage",
      body: (
        <ol>
          <li>En el Panel, mirá la tarjeta <strong>“Poco stock”</strong>.</li>
          <li>Tocá <strong>“Planilla de compra”</strong>: arma la lista de lo que falta, con la cantidad sugerida a comprar.</li>
          <li>La usás para ir a comprarle al proveedor. La podés imprimir.</li>
        </ol>
      ),
    },
    {
      emoji: "💰",
      title: "Costo y ganancia (márgenes)",
      audience: "manage",
      body: (
        <>
          <p>
            Al cargar o editar un producto, poné el <strong>precio de costo</strong> (como viene en
            la factura del proveedor, con IVA) y el <strong>precio de venta</strong>. Ahí mismo ves
            en vivo la <strong>ganancia</strong> y el <strong>margen %</strong>.
          </p>
          <ul>
            <li>
              La ganancia se calcula <strong>sin IVA</strong> en los dos lados (el IVA no es tuyo, va
              a AFIP), así que es la que realmente te queda.
            </li>
            <li>
              Si no sabés qué precio poner, escribí el <strong>margen que querés</strong> (ej: 40%) y
              tocá <strong>“Sugerir precio”</strong>: te calcula el precio de venta.
            </li>
            <li>
              En el catálogo, el botón <strong>“Márgenes”</strong> abre la lista de todos los
              productos con su ganancia, con los de menor margen primero.
            </li>
          </ul>
        </>
      ),
    },
    {
      emoji: "🏷️",
      title: "Promociones",
      audience: "manage",
      body: (
        <>
          <ol>
            <li>Entrá a editar un producto y buscá la sección de <strong>promociones</strong>.</li>
            <li>Elegí <strong>2x1</strong> o un <strong>% de descuento</strong>, con fecha de inicio y fin.</li>
            <li>Marcá para qué <strong>medios de pago</strong> vale (ej: solo efectivo).</li>
          </ol>
          <p className="muted">En el catálogo y en la venta se ve una etiqueta cuando el producto está en promoción.</p>
        </>
      ),
    },
    {
      emoji: "📊",
      title: "Ver ventas y el dinero del día",
      audience: "manage",
      body: (
        <ul>
          <li>
            El <strong>Panel</strong> muestra las ventas del día, el <strong>dinero ingresado</strong>,
            la <strong>ganancia estimada de hoy</strong> (lo que te queda, sin IVA) y las últimas ventas.
          </li>
          <li>
            Si al lado de la ganancia ves un ⚠️, es porque hay productos vendidos <strong>sin costo
            cargado</strong>: cargá el costo (en el producto) para que la ganancia sea exacta.
          </li>
          <li>La pestaña <strong>“Ventas”</strong> es el historial completo, con filtros por fecha, medio de pago y producto.</li>
          <li>Entrando a una venta podés ver el detalle e <strong>imprimir</strong> el comprobante.</li>
          <li>
            Desde “Ventas”, el botón <strong>“Informe mensual”</strong> arma un resumen del mes
            (ventas, facturación, ganancia, medios de pago y productos más vendidos) que podés{" "}
            <strong>imprimir</strong> o guardar en PDF.
          </li>
        </ul>
      ),
    },
    {
      emoji: "👥",
      title: "Equipo y roles",
      audience: "admin",
      body: (
        <>
          <p>En <strong>“Equipo”</strong> creás usuarios y les asignás un rol:</p>
          <ul>
            <li><strong>Vendedor</strong>: vende y consulta precios/stock. No ve la facturación del negocio.</li>
            <li><strong>Encargado de stock</strong>: además maneja productos, precios, stock y reportes.</li>
            <li><strong>Administrador</strong>: acceso total, incluida esta configuración.</li>
          </ul>
          <p className="muted">Dale a cada persona el rol justo: es más simple para ellos y más seguro para vos.</p>
        </>
      ),
    },
    {
      emoji: "⚙️",
      title: "Configurar cuotas y mora",
      audience: "admin",
      body: (
        <>
          <p>En <strong>“Ajustes”</strong> definís las reglas de la cuenta corriente:</p>
          <ul>
            <li><strong>Recargo por cuotas</strong>: qué cantidades de cuotas se ofrecen y qué % se suma en cada una.</li>
            <li><strong>Interés por mora</strong>: el % por día que suma una cuota vencida (poné 0 para no cobrar).</li>
          </ul>
          <p className="muted">Con la inflación conviene revisarlos cada tanto. Los cambios valen para las ventas nuevas.</p>
        </>
      ),
    },
  ];

  const visible = topics.filter((t) => canSee(t.audience));

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 760 }}>
        <h1>¿Cómo se usa?</h1>
        <p className="muted">
          Guía rápida y en criollo. Tocá cada tema para abrirlo. Está pensada para hacer todo desde
          el celular o la compu, sin vueltas.
        </p>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {visible.map((t, i) => (
            <details
              key={t.title}
              className="card"
              open={i === 0}
              style={{ padding: 0 }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: "14px 16px",
                  fontWeight: 700,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                {t.title}
              </summary>
              <div style={{ padding: "0 16px 14px", lineHeight: 1.7 }}>{t.body}</div>
            </details>
          ))}
        </div>

        <div className="card" style={{ marginTop: 16, background: "var(--bg)" }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>¿Se trabó algo?</h2>
          <ul style={{ lineHeight: 1.7, marginBottom: 0 }}>
            <li>Si una pantalla no responde, cerrá y volvé a entrar (los datos están guardados).</li>
            <li>Si te pide iniciar sesión de nuevo, es por seguridad: volvé a entrar y listo.</li>
            <li>Ante cualquier duda, hablá con el encargado o el administrador del negocio.</li>
          </ul>
        </div>

        <p style={{ marginTop: 16 }}>
          <Link href="/">← Volver al panel</Link>
        </p>
      </main>
    </>
  );
}
