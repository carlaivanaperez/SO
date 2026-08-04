"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { importProducts, ApiError } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";
import type { ImportProductRow, ImportResult, ProductUnitDTO } from "@ferrestock/shared";

// ── Utilidades de parseo de CSV (en el navegador) ──────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Alias de encabezados aceptados → campo interno.
const HEADER_ALIASES: Record<string, string[]> = {
  sku: ["sku", "codigo", "cod", "codigo interno"],
  name: ["nombre", "producto", "descripcion", "detalle"],
  brand: ["marca"],
  barcode: ["codigo de barras", "codigo_barras", "barcode", "ean", "cod barras"],
  unit: ["unidad", "medida"],
  costPrice: ["costo", "precio de costo", "precio costo", "costo unitario"],
  salePrice: ["precio", "precio de venta", "precio venta", "venta", "pvp"],
  taxRate: ["iva", "iva %", "alicuota"],
  category: ["categoria", "rubro"],
  stock: ["stock", "cantidad", "existencia"],
};

function mapUnit(raw: string): ProductUnitDTO {
  const v = normalize(raw);
  if (["kg", "kilo", "kilogramo", "kilos"].includes(v)) return "KG";
  if (["metro", "m", "meter", "metros"].includes(v)) return "METER";
  if (["litro", "l", "liter", "litros"].includes(v)) return "LITER";
  if (["caja", "box", "cajas"].includes(v)) return "BOX";
  return "UNIT";
}

function toNumber(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  let s = v.trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!s) return undefined;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type Parsed = { valid: ImportProductRow[]; errors: string[] };

function parseFile(text: string): Parsed {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = parseCsv(text, delim);
  const errors: string[] = [];
  if (rows.length < 2) return { valid: [], errors: ["El archivo no tiene filas de datos."] };

  const header = rows[0]!.map(normalize);
  const idx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = header.findIndex((h) => aliases.includes(h));
    if (found >= 0) idx[field] = found;
  }
  if (idx.sku === undefined || idx.name === undefined || idx.salePrice === undefined) {
    return {
      valid: [],
      errors: ["Faltan columnas obligatorias. El archivo debe tener al menos: código, nombre y precio."],
    };
  }

  const valid: ImportProductRow[] = [];
  const get = (r: string[], f: string) => (idx[f] !== undefined ? (r[idx[f]!] ?? "").trim() : "");
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const sku = get(r, "sku");
    const name = get(r, "name");
    const sale = toNumber(get(r, "salePrice"));
    if (!sku || !name) {
      errors.push(`Fila ${i + 1}: falta el código o el nombre. Se omite.`);
      continue;
    }
    if (sale === undefined) {
      errors.push(`Fila ${i + 1} (${sku}): el precio no es un número válido. Se omite.`);
      continue;
    }
    valid.push({
      sku,
      name,
      brand: get(r, "brand") || undefined,
      barcode: get(r, "barcode") || undefined,
      unit: idx.unit !== undefined ? mapUnit(get(r, "unit")) : "UNIT",
      costPrice: toNumber(get(r, "costPrice")) ?? 0,
      salePrice: sale,
      taxRate: toNumber(get(r, "taxRate")) ?? 21,
      category: get(r, "category") || undefined,
      stock: toNumber(get(r, "stock")),
    });
  }
  return { valid, errors };
}

const EXAMPLE_CSV =
  "codigo;nombre;marca;precio;costo;iva;stock;unidad;rubro;codigo_barras\n" +
  "MAR-001;Martillo carpintero 25mm;Stanley;8500;5200;21;24;unidad;Herramientas;\n" +
  "CAB-25;Cable unipolar 2.5mm;Prysmian;780;520;21;300;metro;Electricidad;\n" +
  "TOR-114;Tornillo autoperforante 1/4;Genérico;3200;2100;21;8;caja;Fijaciones;";

export default function ImportProductsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    if (!canManage(u)) {
      router.replace("/panel");
      return;
    }
    setUser(u);
  }, [router]);

  function downloadExample() {
    const blob = new Blob(["﻿" + EXAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ejemplo-productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setError(null);
    setParsed(null);
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseFile(text));
  }

  async function doImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importProducts(parsed.valid);
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo importar");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 820 }}>
        <div className="page-head">
          <h1 style={{ margin: 0 }}>Importar productos</h1>
          <Link href="/panel" className="btn btn-outline">
            ← Volver al panel
          </Link>
        </div>

        <section className="card" style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Cómo tiene que ser el archivo</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Un archivo <strong>CSV</strong> (lo exportás desde Excel o Google Sheets con “Guardar como
            CSV”). La primera fila son los <strong>títulos de las columnas</strong>. Bajate el ejemplo,
            completalo con tus productos y subilo.
          </p>
          <ul style={{ lineHeight: 1.7 }}>
            <li><strong>Obligatorias:</strong> <code>codigo</code>, <code>nombre</code>, <code>precio</code> (con IVA incluido).</li>
            <li>
              <strong>Opcionales:</strong> <code>marca</code>, <code>costo</code>, <code>iva</code> (por
              defecto 21), <code>stock</code>, <code>unidad</code> (unidad/kg/metro/litro/caja),{" "}
              <code>rubro</code>, <code>codigo_barras</code>.
            </li>
            <li>Si un <strong>código</strong> ya existe, se <strong>actualiza</strong> ese producto (no se duplica).</li>
            <li>Si ponés <strong>stock</strong>, deja esa cantidad como stock actual.</li>
          </ul>
          <button className="btn btn-primary" onClick={downloadExample}>
            ⬇️ Descargar archivo de ejemplo
          </button>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Subir el archivo</h2>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
          {fileName && <p className="muted" style={{ fontSize: 13 }}>Archivo: {fileName}</p>}

          {parsed && (
            <div style={{ marginTop: 12 }}>
              <p>
                ✅ <strong>{parsed.valid.length}</strong> productos listos para importar.
                {parsed.errors.length > 0 && (
                  <>
                    {" "}⚠️ <strong>{parsed.errors.length}</strong> filas con problemas (se omiten).
                  </>
                )}
              </p>
              {parsed.errors.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer" }}>Ver filas con problemas</summary>
                  <ul className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    {parsed.errors.slice(0, 30).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              {parsed.valid.length > 0 && (
                <button className="btn btn-success" onClick={doImport} disabled={importing} style={{ marginTop: 8 }}>
                  {importing ? "Importando…" : `Importar ${parsed.valid.length} productos`}
                </button>
              )}
            </div>
          )}

          {error && <p className="alert alert-error" style={{ marginTop: 12 }}>⚠️ {error}</p>}

          {result && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              ✅ Importación terminada: <strong>{result.created}</strong> creados,{" "}
              <strong>{result.updated}</strong> actualizados.
              {result.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  ⚠️ {result.errors.length} con error:
                  <ul style={{ fontSize: 13 }}>
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        Fila {e.row} {e.sku ? `(${e.sku})` : ""}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <Link href="/panel">Ver el catálogo →</Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
