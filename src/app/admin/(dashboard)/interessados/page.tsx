/**
 * A tela de Interessados mudou para /backoffice/interessados.
 *
 * Este redirect fica para não quebrar link salvo, atalho do navegador ou
 * qualquer referência antiga — a rota respondia até agora e sumir sem aviso
 * daria 404 em quem tivesse guardado o endereço.
 *
 * Sempre foi uma tela exclusiva do super admin (requireSuperAdmin), então
 * nenhuma empresa-cliente perde nada com a mudança de lugar.
 */

import { redirect } from 'next/navigation';

export default function InteressadosMudouDeLugar() {
  redirect('/backoffice/interessados');
}
