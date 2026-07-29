'use client';

import { useState } from 'react';
import BulkLeadActions from '@/components/BulkLeadActions';

interface LeadRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  status: string;
  temperatura: string;
  score: number;
  corretor: string;
  loteamento: string;
  criado: string;
  STATUS_LABEL: Record<string, string>;
  STATUS_COR: Record<string, string>;
}

interface Props {
  leads: LeadRow[];
  corretores: { id: string; nome: string }[];
}

export default function BulkLeadsPanel({ leads, corretores }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  }

  const allSelected = selected.size === leads.length && leads.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Temp</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Corretor</th>
              <th className="px-3 py-2">Loteamento</th>
              <th className="px-3 py-2">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr
                key={l.id}
                onClick={() => toggle(l.id)}
                className={`cursor-pointer ${
                  selected.has(l.id) ? 'bg-sky-50' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-slate-900">{l.nome}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {l.email}
                  <br />
                  {l.telefone}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      l.STATUS_COR[l.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {l.STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={
                      l.temperatura === 'QUENTE'
                        ? 'text-red-600 font-semibold'
                        : l.temperatura === 'FRIO'
                          ? 'text-sky-600'
                          : 'text-amber-600'
                    }
                  >
                    {l.temperatura}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-mono">{l.score}</td>
                <td className="px-3 py-2 text-xs">{l.corretor || '—'}</td>
                <td className="px-3 py-2 text-xs">{l.loteamento || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{l.criado}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500 text-sm">
                  Nenhum lead encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <BulkLeadActions
          leadIds={Array.from(selected)}
          corretores={corretores}
          onClear={() => setSelected(new Set())}
        />
      )}
    </>
  );
}
