-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "LoteStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "ReservaStatus" AS ENUM ('ATIVA', 'EXPIRADA', 'CONVERTIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('A_VISTA', 'PARCELADO_BOLETO', 'PARCELADO_PIX', 'PARCELADO_CARTAO', 'PARCELADO_MISTO');

-- CreateEnum
CREATE TYPE "VendaStatus" AS ENUM ('ATIVA', 'INADIMPLENTE', 'QUITADA', 'CANCELADA', 'DISTRATADA');

-- CreateEnum
CREATE TYPE "ParcelaTipo" AS ENUM ('ENTRADA', 'MENSAL', 'ANUAL', 'EXTRA');

-- CreateEnum
CREATE TYPE "ParcelaStatus" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO', 'ESTORNADO');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "rg" TEXT,
    "telefone" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "asaasCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loteamentos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT,
    "imagemCapa" TEXT,
    "imagensGaleria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imagemMapa" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "reservaMinutos" INTEGER NOT NULL DEFAULT 15,
    "permiteFinanciamento" BOOLEAN NOT NULL DEFAULT true,
    "maxParcelas" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loteamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" TEXT NOT NULL,
    "loteamentoId" TEXT NOT NULL,
    "quadra" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "testada" DECIMAL(10,2),
    "fundo" DECIMAL(10,2),
    "preco" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "mapaX" DOUBLE PRECISION,
    "mapaY" DOUBLE PRECISION,
    "mapaLargura" DOUBLE PRECISION,
    "mapaAltura" DOUBLE PRECISION,
    "status" "LoteStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "status" "ReservaStatus" NOT NULL DEFAULT 'ATIVA',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "loteId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "valorEntrada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numeroParcelas" INTEGER NOT NULL DEFAULT 1,
    "valorParcela" DECIMAL(12,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "status" "VendaStatus" NOT NULL DEFAULT 'ATIVA',
    "dataContrato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataQuitacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "ParcelaTipo" NOT NULL DEFAULT 'MENSAL',
    "valor" DECIMAL(12,2) NOT NULL,
    "valorPago" DECIMAL(12,2),
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "status" "ParcelaStatus" NOT NULL DEFAULT 'PENDENTE',
    "asaasPaymentId" TEXT,
    "asaasInvoiceUrl" TEXT,
    "asaasBoletoUrl" TEXT,
    "asaasPixCode" TEXT,
    "asaasPixQrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_webhook_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asaas_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userType" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfCnpj_key" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_asaasCustomerId_key" ON "clientes"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "loteamentos_slug_key" ON "loteamentos"("slug");

-- CreateIndex
CREATE INDEX "lotes_loteamentoId_status_idx" ON "lotes"("loteamentoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_loteamentoId_codigo_key" ON "lotes"("loteamentoId", "codigo");

-- CreateIndex
CREATE INDEX "reservas_loteId_status_idx" ON "reservas"("loteId", "status");

-- CreateIndex
CREATE INDEX "reservas_expiraEm_status_idx" ON "reservas"("expiraEm", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_numero_key" ON "vendas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_asaasPaymentId_key" ON "parcelas"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "parcelas_status_vencimento_idx" ON "parcelas"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_vendaId_numero_key" ON "parcelas"("vendaId", "numero");

-- CreateIndex
CREATE INDEX "asaas_webhook_logs_paymentId_idx" ON "asaas_webhook_logs"("paymentId");

-- CreateIndex
CREATE INDEX "asaas_webhook_logs_processed_createdAt_idx" ON "asaas_webhook_logs"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_loteamentoId_fkey" FOREIGN KEY ("loteamentoId") REFERENCES "loteamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
