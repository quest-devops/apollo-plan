/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { ForgotPasswordForm } from "@/components/account/auth-forms/forgot-password";
import { ApolloLoginShell } from "@/components/auth-screens/apollo-login-shell";
import { AuthHeader } from "@/components/auth-screens/header";
// helpers
import { EAuthModes, EPageTypes } from "@/helpers/authentication.helper";
// layouts
import DefaultLayout from "@/layouts/default-layout";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

function ForgotPasswordPage() {
  return (
    <DefaultLayout>
      <AuthenticationWrapper pageType={EPageTypes.NON_AUTHENTICATED}>
        <ApolloLoginShell>
          <AuthHeader type={EAuthModes.SIGN_IN} />
          <ForgotPasswordForm />
        </ApolloLoginShell>
      </AuthenticationWrapper>
    </DefaultLayout>
  );
}

export default observer(ForgotPasswordPage);
