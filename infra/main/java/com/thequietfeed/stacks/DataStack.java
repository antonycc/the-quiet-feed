/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed.stacks;

import static com.thequietfeed.utils.Kind.infof;
import static com.thequietfeed.utils.KindCdk.cfnOutput;

import com.thequietfeed.QuietFeedSharedNames;
import org.immutables.value.Value;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.dynamodb.Attribute;
import software.amazon.awscdk.services.dynamodb.AttributeType;
import software.amazon.awscdk.services.dynamodb.BillingMode;
import software.amazon.awscdk.services.dynamodb.ITable;
import software.amazon.awscdk.services.dynamodb.PointInTimeRecoverySpecification;
import software.amazon.awscdk.services.dynamodb.Table;
import software.constructs.Construct;

public class DataStack extends Stack {

    public ITable bundlesTable;
    public ITable bundlePostAsyncRequestsTable;
    public ITable bundleDeleteAsyncRequestsTable;

    @Value.Immutable
    public interface DataStackProps extends StackProps, QuietFeedStackProps {

        @Override
        Environment getEnv();

        @Override
        @Value.Default
        default Boolean getCrossRegionReferences() {
            return null;
        }

        @Override
        String envName();

        @Override
        String deploymentName();

        @Override
        String resourceNamePrefix();

        @Override
        String cloudTrailEnabled();

        @Override
        QuietFeedSharedNames sharedNames();

        static ImmutableDataStackProps.Builder builder() {
            return ImmutableDataStackProps.builder();
        }
    }

    public DataStack(Construct scope, String id, DataStackProps props) {
        this(scope, id, null, props);
    }

    public DataStack(Construct scope, String id, StackProps stackProps, DataStackProps props) {
        super(scope, id, stackProps);

        // Determine removal policy based on environment
        // RETAIN for prod to prevent accidental data loss, DESTROY for non-prod
        boolean isProd = "prod".equals(props.envName());
        RemovalPolicy criticalTableRemovalPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

        // Create DynamoDB table for bundle storage (user preferences/configurations)
        // HIGH priority - contains user data - PITR enabled for backup
        this.bundlesTable = Table.Builder.create(this, props.resourceNamePrefix() + "-BundlesTable")
                .tableName(props.sharedNames().bundlesTableName)
                .partitionKey(Attribute.builder()
                        .name("hashedSub")
                        .type(AttributeType.STRING)
                        .build())
                .sortKey(Attribute.builder()
                        .name("bundleId")
                        .type(AttributeType.STRING)
                        .build())
                .billingMode(BillingMode.PAY_PER_REQUEST) // Serverless, near-zero cost at rest
                .timeToLiveAttribute("ttl") // Enable TTL for automatic expiry handling
                .pointInTimeRecoverySpecification(PointInTimeRecoverySpecification.builder()
                        .pointInTimeRecoveryEnabled(true)
                        .build()) // Enable PITR for 35-day recovery window
                .removalPolicy(criticalTableRemovalPolicy)
                .build();
        infof(
                "Created bundles DynamoDB table with name %s, id %s, PITR=true, removalPolicy=%s",
                this.bundlesTable.getTableName(),
                this.bundlesTable.getNode().getId(),
                criticalTableRemovalPolicy);

        // Create DynamoDB table for bundle POST async request storage
        this.bundlePostAsyncRequestsTable = createAsyncRequestsTable(
                props.resourceNamePrefix() + "-BundlePostAsyncRequestsTable",
                props.sharedNames().bundlePostAsyncRequestsTableName);
        infof(
                "Created bundle POST async requests DynamoDB table with name %s",
                this.bundlePostAsyncRequestsTable.getTableName());

        // Create DynamoDB table for bundle DELETE async request storage
        this.bundleDeleteAsyncRequestsTable = createAsyncRequestsTable(
                props.resourceNamePrefix() + "-BundleDeleteAsyncRequestsTable",
                props.sharedNames().bundleDeleteAsyncRequestsTableName);
        infof(
                "Created bundle DELETE async requests DynamoDB table with name %s",
                this.bundleDeleteAsyncRequestsTable.getTableName());

        cfnOutput(this, "BundlesTableName", this.bundlesTable.getTableName());
        cfnOutput(this, "BundlesTableArn", this.bundlesTable.getTableArn());
        cfnOutput(this, "BundlePostAsyncRequestsTableName", this.bundlePostAsyncRequestsTable.getTableName());
        cfnOutput(this, "BundlePostAsyncRequestsTableArn", this.bundlePostAsyncRequestsTable.getTableArn());
        cfnOutput(this, "BundleDeleteAsyncRequestsTableName", this.bundleDeleteAsyncRequestsTable.getTableName());
        cfnOutput(this, "BundleDeleteAsyncRequestsTableArn", this.bundleDeleteAsyncRequestsTable.getTableArn());

        infof(
                "DataStack %s created successfully for %s",
                this.getNode().getId(), props.sharedNames().dashedDeploymentDomainName);
    }

    private ITable createAsyncRequestsTable(String id, String tableName) {
        return Table.Builder.create(this, id)
                .tableName(tableName)
                .partitionKey(Attribute.builder()
                        .name("hashedSub")
                        .type(AttributeType.STRING)
                        .build())
                .sortKey(Attribute.builder()
                        .name("requestId")
                        .type(AttributeType.STRING)
                        .build())
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .timeToLiveAttribute("ttl")
                .removalPolicy(RemovalPolicy.DESTROY)
                .build();
    }
}
