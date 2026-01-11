/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed.stacks;

import com.thequietfeed.QuietFeedSharedNames;

public interface QuietFeedStackProps {
    String envName();

    String deploymentName();

    String resourceNamePrefix();

    String cloudTrailEnabled();

    QuietFeedSharedNames sharedNames();
}
