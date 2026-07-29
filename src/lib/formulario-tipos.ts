/**
 * Tipos compartilhados para o sistema de formulários customizados.
 *
 * O admin define uma lista de FormCampo[] que é guardada em
 * Formulario.campos (Json). A página pública renderiza dinamicamente
 * baseado nessa estrutura.
 */

export type FormCampoTipo =
  | 'text' // texto livre curto
  | 'textarea' // texto longo
  | 'nome' // nome completo (atalho)
  | 'cpf' // CPF/CNPJ com máscara e validação
  | 'email'
  | 'telefone' // com máscara
  | 'numero'
  | 'data'
  | 'select' // dropdown com opções
  | 'radio' // botões de opção
  | 'checkbox' // múltipla seleção
  | 'sim_nao' // só dois valores
  | 'arquivo' // upload de arquivo (qualquer)
  | 'foto' // upload com hint pra usar câmera no celular
  | 'documento' // pra docs específicos (RG, CPF, comprovante) — duas faces
  | 'lote' // dropdown de lotes do loteamento vinculado
  | 'titulo' // não é campo, é uma seção
  | 'paragrafo'; // texto explicativo no meio do form

export interface FormCampo {
  /** Identificador estável (slug). Usado como key nas respostas. */
  id: string;

  tipo: FormCampoTipo;
  label: string;
  descricao?: string;
  placeholder?: string;
  obrigatorio?: boolean;

  // Para select / radio / checkbox
  opcoes?: { valor: string; label: string }[];

  // Validação opcional
  minLength?: number;
  maxLength?: number;

  // Upload — só para arquivo/foto/documento
  aceita?: string; // ex: "image/*,application/pdf"
  tamanhoMaxMb?: number; // default 10
}

export interface FormCamposPayload {
  campos: FormCampo[];
}

/**
 * Lista padrão: já com nome, cpf, email, telefone, lote + RG/CPF foto.
 * Usada quando o admin clica em "Criar formulário padrão de qualificação".
 */
export const CAMPOS_PADRAO_QUALIFICACAO: FormCampo[] = [
  {
    id: 'nome',
    tipo: 'nome',
    label: 'Nome completo',
    obrigatorio: true,
    placeholder: 'Ex: João da Silva',
  },
  {
    id: 'cpfCnpj',
    tipo: 'cpf',
    label: 'CPF ou CNPJ',
    obrigatorio: true,
    placeholder: '000.000.000-00',
  },
  {
    id: 'email',
    tipo: 'email',
    label: 'E-mail',
    obrigatorio: true,
    placeholder: 'seu@email.com',
  },
  {
    id: 'telefone',
    tipo: 'telefone',
    label: 'Telefone / WhatsApp',
    obrigatorio: true,
    placeholder: '(75) 99999-9999',
  },
  {
    id: 'lote',
    tipo: 'lote',
    label: 'Lote de interesse',
    obrigatorio: false,
    descricao: 'Selecione o lote que você gostaria de adquirir',
  },
  {
    id: 'doc_identidade_frente',
    tipo: 'foto',
    label: 'Documento de identidade — FRENTE',
    descricao: 'RG ou CNH (frente). Pode tirar foto direto pelo celular.',
    obrigatorio: true,
    aceita: 'image/*,application/pdf',
    tamanhoMaxMb: 10,
  },
  {
    id: 'doc_identidade_verso',
    tipo: 'foto',
    label: 'Documento de identidade — VERSO',
    descricao: 'RG ou CNH (verso).',
    obrigatorio: true,
    aceita: 'image/*,application/pdf',
    tamanhoMaxMb: 10,
  },
  {
    id: 'comprovante_residencia',
    tipo: 'arquivo',
    label: 'Comprovante de residência',
    descricao: 'Conta de luz, água ou telefone dos últimos 90 dias.',
    obrigatorio: false,
    aceita: 'image/*,application/pdf',
    tamanhoMaxMb: 10,
  },
  {
    id: 'observacoes',
    tipo: 'textarea',
    label: 'Observações (opcional)',
    descricao: 'Algo que queira nos contar?',
    obrigatorio: false,
  },
];

/** Tipos que aceitam upload de arquivo. */
export const CAMPO_TIPOS_ARQUIVO: FormCampoTipo[] = ['arquivo', 'foto', 'documento'];

/** Sluginiza para o campo `slug` (URL) do formulário. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Aceita objeto persistido no banco e devolve FormCampo[] (com fallback). */
export function parseCampos(json: unknown): FormCampo[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as FormCampo[];
  if (typeof json === 'object' && 'campos' in (json as object)) {
    const c = (json as { campos: unknown }).campos;
    if (Array.isArray(c)) return c as FormCampo[];
  }
  return [];
}
