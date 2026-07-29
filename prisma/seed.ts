import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@meuloteamento.com.br';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const nome = process.env.SEED_ADMIN_NAME || 'Administrador';

  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) {
    console.log(`[seed] Admin "${email}" já existe.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.adminUser.create({
    data: { email, passwordHash, nome, role: 'SUPER_ADMIN', ativo: true },
  });
  console.log(`[seed] Admin criado: ${user.email} / senha: ${password}`);
}

async function seedGrupoGermanos() {
  const slug = 'grupo-germanos';
  const existing = await prisma.loteadora.findUnique({ where: { slug } });
  if (existing) {
    console.log(`[seed] Loteadora "${existing.nome}" já existe.`);
    return existing;
  }

  const loteadora = await prisma.loteadora.create({
    data: {
      slug,
      nome: 'Grupo Germanos',
      nomeFantasia: 'Grupo Germanos',
      cidade: 'Tucano',
      estado: 'BA',
      corPrimaria: '#0d9488', // teal-600
      corSecundaria: '#134e4a', // teal-900
      ativo: true,
      asaasSandbox: true,
    },
  });
  console.log(`[seed] Loteadora "${loteadora.nome}" criada (slug: ${loteadora.slug}).`);
  return loteadora;
}

async function seedParqueTucano(loteadoraId: string) {
  const slug = 'parque-tucano';
  const existing = await prisma.loteamento.findUnique({ where: { slug } });
  if (existing) {
    console.log(`[seed] Loteamento "${existing.nome}" já existe.`);
    return existing;
  }

  const loteamento = await prisma.loteamento.create({
    data: {
      slug,
      nome: 'Parque Tucano',
      loteadoraId,
      descricao:
        'Loteamento residencial em Tucano, no coração do sertão baiano. Lotes amplos, infraestrutura completa e financiamento direto.',
      endereco: 'A definir',
      cidade: 'Tucano',
      estado: 'BA',
      diferenciais: [
        'Infraestrutura completa',
        'Asfalto',
        'Iluminação pública',
        'Áreas verdes',
        'Próximo ao centro',
      ],
      ativo: true,
      publicado: true,
      reservaMinutos: 15,
      permiteFinanciamento: true,
      maxParcelas: 120,
    },
  });
  console.log(`[seed] Loteamento "${loteamento.nome}" criado (URL pública: /${loteamento.slug}).`);
  return loteamento;
}

async function main() {
  await seedAdmin();
  const loteadora = await seedGrupoGermanos();
  if (loteadora) {
    await seedParqueTucano(loteadora.id);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
