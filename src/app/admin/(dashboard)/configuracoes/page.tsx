/**
 * As Configurações da plataforma mudaram para /backoffice/configuracoes.
 *
 * Mesmo motivo do redirect de interessados: a rota existia, alguém pode ter
 * o link guardado, e 404 seria uma surpresa desnecessária.
 *
 * Tela exclusiva do super admin desde sempre — nenhuma empresa-cliente é
 * afetada.
 */

import { redirect } from 'next/navigation';

export default function ConfiguracoesMudouDeLugar() {
  redirect('/backoffice/configuracoes');
}
