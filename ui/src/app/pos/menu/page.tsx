"use client";
// src/app/pos/menu/page.tsx — ADMIN menu management

import { useState } from "react";
import { useMenu, useCreateProductMutation, useDeleteProductMutation } from "@/lib/queries";
import { centsToDisplay, type Category } from "@/lib/ipc";

function AddProductForm({ categories, onSuccess }: {
  categories: Category[];
  onSuccess: () => void;
}) {
  const create = useCreateProductMutation();
  const [form, setForm] = useState({
    name: "", categoryId: "", description: "",
    priceCents: "", taxRatePct: "5",
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const price = Math.round(parseFloat(form.priceCents) * 100);
    if (isNaN(price) || price < 0) { setError("Invalid price"); return; }
    try {
      await create.mutateAsync({
        name:        form.name.trim(),
        categoryId:  form.categoryId || undefined,
        description: form.description || undefined,
        priceCents:  price,
        taxRatePct:  parseFloat(form.taxRatePct) || 0,
      });
      setForm({ name:"", categoryId:"", description:"", priceCents:"", taxRatePct:"5" });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    }
  }

  const field = "w-full bg-black border text-[#f0f0f0] mono text-sm px-3 py-2 outline-none";
  const fieldStyle = { borderColor: "var(--border-bright)", caretColor: "var(--accent)" };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b space-y-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mono text-[10px] text-[#888] tracking-widest mb-2">ADD PRODUCT</div>

      <div className="grid grid-cols-2 gap-2">
        <input className={field} style={fieldStyle} placeholder="Product name *"
               value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
        <select className={field} style={fieldStyle}
                value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))}>
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={field} style={fieldStyle} placeholder="Price (₹) *" type="number" min="0" step="0.01"
               value={form.priceCents} onChange={e => setForm(f => ({...f, priceCents: e.target.value}))} required />
        <input className={field} style={fieldStyle} placeholder="GST %" type="number" min="0" max="100"
               value={form.taxRatePct} onChange={e => setForm(f => ({...f, taxRatePct: e.target.value}))} />
      </div>
      <input className={`${field} w-full`} style={fieldStyle} placeholder="Description (optional)"
             value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />

      {error && <div className="mono text-[11px] text-[#ef4444]">✗ {error}</div>}

      <button type="submit" disabled={create.isPending}
              className="px-4 py-2 mono text-sm font-bold text-black disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
        {create.isPending ? "SAVING..." : "+ ADD PRODUCT"}
      </button>
    </form>
  );
}

export default function MenuPage() {
  const { data: menu, isLoading }   = useMenu();
  const deleteProduct               = useDeleteProductMutation();
  const [showForm, setShowForm]     = useState(false);
  const [activeCat, setActiveCat]   = useState<string | null>(null);

  const categories = menu?.categories ?? [];
  const products   = menu?.products   ?? [];
  const filtered   = activeCat ? products.filter(p => p.categoryId === activeCat) : products;

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <span className="mono text-sm font-bold" style={{ color: "var(--accent)" }}>MENU MANAGEMENT</span>
        <button onClick={() => setShowForm(s => !s)}
                className="mono text-[10px] px-3 py-1.5 transition-all"
                style={{ color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
          {showForm ? "✕ CLOSE" : "+ ADD ITEM"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <AddProductForm categories={categories} onSuccess={() => setShowForm(false)} />
      )}

      {/* Category filter */}
      <div className="flex border-b overflow-x-auto"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <button onClick={() => setActiveCat(null)}
                className="px-4 py-2.5 mono text-[10px] tracking-widest transition-all"
                style={{
                  color: !activeCat ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: !activeCat ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
          ALL ({products.length})
        </button>
        {categories.map(cat => {
          const count  = products.filter(p => p.categoryId === cat.id).length;
          const active = activeCat === cat.id;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                    className="px-4 py-2.5 mono text-[10px] tracking-widest whitespace-nowrap transition-all"
                    style={{
                      color: active ? "var(--accent)" : "var(--text-muted)",
                      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                    }}>
              {cat.name.toUpperCase()} ({count})
            </button>
          );
        })}
      </div>

      {/* Product table */}
      <div className="flex-1 scrollable">
        {isLoading && (
          <div className="p-6 mono text-[11px] text-[#444] animate-pulse">LOADING...</div>
        )}

        {/* Table header */}
        <div className="grid grid-cols-12 px-4 py-2 mono text-[9px] text-[#444] tracking-widest border-b"
             style={{ borderColor: "var(--border)" }}>
          <span className="col-span-4">NAME</span>
          <span className="col-span-3">CATEGORY</span>
          <span className="col-span-2 text-right">PRICE</span>
          <span className="col-span-1 text-right">GST</span>
          <span className="col-span-1 text-center">AVAIL</span>
          <span className="col-span-1" />
        </div>

        {filtered.map(product => {
          const cat = categories.find(c => c.id === product.categoryId);
          return (
            <div key={product.id}
                 className="grid grid-cols-12 items-center px-4 py-3 border-b group transition-colors"
                 style={{ borderColor: "var(--border)" }}
                 onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              <div className="col-span-4">
                <div className="text-sm text-[#f0f0f0]">{product.name}</div>
                {product.description && (
                  <div className="mono text-[10px] text-[#444] truncate">{product.description}</div>
                )}
              </div>
              <div className="col-span-3 mono text-[11px] text-[#888]">
                {cat?.name ?? "—"}
              </div>
              <div className="col-span-2 text-right mono text-sm" style={{ color: "var(--accent)" }}>
                {centsToDisplay(product.priceCents, "₹")}
              </div>
              <div className="col-span-1 text-right mono text-[11px] text-[#888]">
                {product.taxRatePct}%
              </div>
              <div className="col-span-1 text-center">
                <span style={{ color: product.isAvailable ? "var(--accent)" : "#ef4444" }}>
                  {product.isAvailable ? "●" : "○"}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => { if (confirm(`Delete "${product.name}"?`)) deleteProduct.mutate(product.id); }}
                  className="opacity-0 group-hover:opacity-100 mono text-[11px] transition-opacity px-2 py-1"
                  style={{ color: "#ef4444" }}>
                  DEL
                </button>
              </div>
            </div>
          );
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center mono text-[11px] text-[#444]">NO PRODUCTS</div>
        )}
      </div>
    </div>
  );
}
