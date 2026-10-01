/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ApolloLoginTitulo } from "@/components/auth-screens/apollo-login-shell";

// Cabeçalho das telas de senha no padrão Apollo (VT323 verde, como o login)
export function AuthFormHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="alogin-cabecalho">
      <ApolloLoginTitulo>{title}</ApolloLoginTitulo>
      <p className="alogin-subtitulo">{description}</p>
    </div>
  );
}
