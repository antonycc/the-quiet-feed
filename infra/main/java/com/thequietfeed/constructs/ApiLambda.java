/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed.constructs;

import software.constructs.Construct;

public class ApiLambda extends Lambda {
    public final AbstractApiLambdaProps apiProps;

    public ApiLambda(final Construct scope, AbstractApiLambdaProps apiProps) {
        super(scope, apiProps);
        this.apiProps = apiProps;
    }
}
