import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora } from '@/lib/tenant';
import { formatDateTime } from '@/lib/format';
import { parseCampos, type FormCampo } from '@/lib/formulario-tipos';
import {
  marcarRespostaVista,
  mudarStatusResposta,
  deletarResposta,
} from '../../actions';
import { RespostaActions } from '@/components/RespostaActions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  NOVA: 'Nova',
  EM_ANALISE: 'Em análise',
  PROCESSADA: 'Processada',
  ARQUIVADA: 'Arquivada',
};

export default async function RespostaDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const resposta = await prisma.formularioResposta.findUnique({
    where: { id: params.id },
    include: {
      formulario: {
        select: {
          id: true,
          nome: true,
          slug: true,
          loteadoraId: true,
          campos: true,
        },
      },
      arquivos: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!resposta) notFound();
  if (
    resposta.formulario.loteadoraId &&
    !(await canAccessLoteadora(resposta.formulario.loteadoraId))
  ) {
    notFound();
  }

  // Marca como vista (silencioso, fire-and-forget no server)
  if (!resposta.vistaEm) {
    await marcarRespostaVista(resposta.id).catch(() => {});
  }

  const campos = parseCampos(resposta.formulario.campos);
  const dados = (resposta.dados ?? {}) as Record<string, unknown>;

  // Mapeia arquivos por campoId
  const arquivosPorCampo = new Map<string, typeof resposta.arquivos>();
  for (const a of resposta.arquivos) {
    if (!arquivosPorCampo.has(a.campoId)) arquivosPorCampo.set(a.campoId, []);
    arquivosPorCampo.get(a.campoId)!.push(a);
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/admin/formularios/${resposta.formulario.id}`}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← {resposta.formulario.nome}
        </Link>
        <div className="flex items-start justify-between mt-1 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Resposta de {resposta.nome ?? 'Sem nome'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recebida em {formatDateTime(resposta.createdAt)}
              {resposta.vistaEm && (
                <> · Vista em {formatDateTime(resposta.vistaEm)}</>
              )}
            </p>
          </div>
          <RespostaActions
            respostaId={resposta.id}
            statusAtual={resposta.status}
            mudarStatusAction={mudarStatusResposta}
            deletarAction={deletarResposta}
          />
        </div>
      </div>

      {/* AÇÕES RÁPIDAS — usar dados para criar venda ou cliente */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-primary-50 dark:from-emerald-500/10 dark:to-primary-500/10 border border-emerald-200 dark:border-emerald-500/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              ⚡ Avançar este lead
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-0.5">
              Use os dados preenchidos pelo cliente para abrir uma venda já com nome, CPF,
              e-mail, telefone e lote pré-selecionados.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {resposta.telefone && (
              <a
                href={`https://wa.me/55${resposta.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá ${resposta.nome ?? ''}! Recebemos seu formulário${
                    resposta.loteCodigo ? ` sobre o lote ${resposta.loteCodigo}` : ''
                  }. Posso te ajudar?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium bg-[#25D366] hover:bg-[#1cb858] text-white rounded-lg inline-flex items-center gap-1.5"
              >
                📱 WhatsApp
              </a>
            )}
            <Link
              href={`/admin/vendas/novo?fromForm=${resposta.id}`}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1.5"
            >
              💰 Criar venda com estes dados →
            </Link>
          </div>
        </div>
      </div>

      {/* Cabeçalho com info-chave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {resposta.cpfCnpj && (
          <InfoCard label="CPF / CNPJ" value={resposta.cpfCnpj} mono />
        )}
        {resposta.email && <InfoCard label="E-mail" value={resposta.email} />}
        {resposta.telefone && (
          <InfoCard label="Telefone" value={resposta.telefone} action={`https://wa.me/55${resposta.telefone.replace(/\D/g, '')}`} actionLabel="📱 WhatsApp" />
        )}
        {resposta.loteCodigo && (
          <InfoCard label="Lote de interesse" value={resposta.loteCodigo} mono />
        )}
      </div>

      {/* Dados completos campo a campo */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Respostas
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {campos.map((campo) => {
            if (campo.tipo === 'titulo' || campo.tipo === 'paragrafo') return null;
            return (
              <CampoResposta
                key={campo.id}
                campo={campo}
                valor={dados[campo.id]}
                arquivos={arquivosPorCampo.get(campo.id) ?? []}
              />
            );
          })}
        </div>
      </section>

      {/* Tracking */}
      {(resposta.ipAddress || resposta.userAgent) && (
        <details className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer hover:text-slate-700">
            Dados técnicos
          </summary>
          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg font-mono">
            {resposta.ipAddress && <p>IP: {resposta.ipAddress}</p>}
            {resposta.userAgent && <p className="break-all">UA: {resposta.userAgent}</p>}
          </div>
        </details>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
  action,
  actionLabel,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: string;
  actionLabel?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
        {label}
      </p>
      <p
        className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
      {action && (
        <a
          href={action}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-1 text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

interface ArquivoSerializavel {
  id: string;
  nomeOriginal: string;
  mimeType: string | null;
  tamanho: number | null;
}

function CampoResposta({
  campo,
  valor,
  arquivos,
}: {
  campo: FormCampo;
  valor: unknown;
  arquivos: ArquivoSerializavel[];
}) {
  const isArquivo = ['arquivo', 'foto', 'documento'].includes(campo.tipo);

  return (
    <div className="px-5 py-3">
      <p className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
        {campo.label}
      </p>

      {isArquivo ? (
        arquivos.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Não enviado</p>
        ) : (
          <div className="space-y-2">
            {arquivos.map((arq) => (
              <ArquivoCard key={arq.id} arquivo={arq} />
            ))}
          </div>
        )
      ) : campo.tipo === 'checkbox' ? (
        Array.isArray(valor) && valor.length > 0 ? (
          <ul className="text-sm text-slate-900 dark:text-slate-100 list-disc list-inside">
            {(valor as string[]).map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 italic">Não respondido</p>
        )
      ) : campo.tipo === 'sim_nao' ? (
        <p className="text-sm text-slate-900 dark:text-slate-100">
          {valor === 'sim' ? '✅ Sim' : valor === 'nao' ? '❌ Não' : <span className="text-slate-400 italic">Não respondido</span>}
        </p>
      ) : valor ? (
        <p className={`text-sm text-slate-900 dark:text-slate-100 ${campo.tipo === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
          {String(valor)}
        </p>
      ) : (
        <p className="text-sm text-slate-400 italic">Não respondido</p>
      )}
    </div>
  );
}

function ArquivoCard({ arquivo }: { arquivo: ArquivoSerializavel }) {
  const isImagem = (arquivo.mimeType ?? '').startsWith('image/');
  const href = `/api/admin/formularios/arquivo/${arquivo.id}`;
  const sizeKb = arquivo.tamanho ? Math.round(arquivo.tamanho / 1024) : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
      {isImagem ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={arquivo.nomeOriginal}
            className="w-16 h-16 object-cover rounded border border-slate-300"
          />
        </a>
      ) : (
        <div className="w-16 h-16 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-2xl">
          📄
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {arquivo.nomeOriginal}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {arquivo.mimeType ?? 'arquivo'} {sizeKb ? `· ${sizeKb} KB` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded"
        >
          Ver
        </a>
        <a
          href={`${href}?download=1`}
          className="px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded"
        >
          ⬇ Baixar
        </a>
      </div>
    </div>
  );
}
