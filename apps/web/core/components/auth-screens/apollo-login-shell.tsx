/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// Tela de login no padrão dos apps Apollo ("terminal emerald") — os mesmos
// arquivos de arte/fonte do ApolloDesk e do ApolloCloud, copiados, não gerados.
import ApolloPlanLockup from "@/app/assets/auth/apollo-login/apolloplan-lockup.png?url";
import "./apollo-login.css";

/*
 * Casca compartilhada por todas as telas pré-login (entrar, criar conta,
 * esqueci/redefinir/definir senha): painel de arte à esquerda com o lockup e a
 * assinatura, conteúdo na metade direita.
 *
 * Todo o CSS é escopado em `.apollo-login`. Como a classe mora NESTE elemento
 * (que desmonta ao sair do login), o tema não vaza para o app — diferente do
 * Desk, que precisa marcar o <body> por ser CSS sobre um DOM alheio.
 */
export function ApolloLoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="apollo-login">
      <aside className="alogin-painel" aria-hidden="true">
        <img className="alogin-painel-lockup" src={ApolloPlanLockup} alt="" />
        <p className="alogin-painel-frase">ApolloPlan — gestão inteligente dos projetos da sua empresa.</p>
      </aside>
      <main className="alogin-coluna">
        <img className="alogin-lockup-estreito" src={ApolloPlanLockup} alt="ApolloPlan" />
        <div className="alogin-conteudo">{children}</div>
      </main>
    </div>
  );
}

export function ApolloLoginTitulo({ children }: { children: React.ReactNode }) {
  return <h1 className="alogin-titulo">{children}</h1>;
}

export function ApolloLoginRodape() {
  return (
    <>
      {/* Texto puro, sem links — igual ao Desk e ao Mail: as páginas de Termos e
          Privacidade ainda não existem no site, e link quebrado no login é pior. */}
      <p className="alogin-legal">Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.</p>
      <p className="alogin-assinatura">ApolloPlan</p>
    </>
  );
}
