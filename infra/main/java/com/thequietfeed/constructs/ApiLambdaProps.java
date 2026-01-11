/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed.constructs;

import org.immutables.value.Value;

@Value.Immutable
public interface ApiLambdaProps extends AbstractApiLambdaProps {

    static ImmutableApiLambdaProps.Builder builder() {
        return ImmutableApiLambdaProps.builder();
    }
}
