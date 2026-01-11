/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed;

import static com.thequietfeed.utils.Kind.envOr;
import static com.thequietfeed.utils.Kind.infof;
import static com.thequietfeed.utils.Kind.warnf;

import com.thequietfeed.stacks.ApexStack;
import com.thequietfeed.stacks.BackupStack;
import com.thequietfeed.stacks.DataStack;
import com.thequietfeed.stacks.IdentityStack;
import com.thequietfeed.stacks.ObservabilityStack;
import com.thequietfeed.stacks.ObservabilityUE1Stack;
import com.thequietfeed.utils.KindCdk;
import java.lang.reflect.Field;
import java.nio.file.Paths;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.constructs.Construct;

public class QuietFeedEnvironment {

    public final ObservabilityStack observabilityStack;
    public final ObservabilityUE1Stack observabilityUE1Stack;
    public final DataStack dataStack;
    public final BackupStack backupStack;
    public final IdentityStack identityStack;
    public final ApexStack apexStack;

    public static class QuietFeedEnvironmentProps {

        public String envName;
        public String hostedZoneName;
        public String hostedZoneId;
        public String certificateArn;
        public String deploymentDomainName;
        public String baseUrl;
        public String subDomainName;
        public String accessLogGroupRetentionPeriodDays;
        public String cloudTrailEnabled;
        public String cloudTrailLogGroupPrefix;
        public String cloudTrailLogGroupRetentionPeriodDays;
        public String holdingDocRootPath;
        public String googleClientId;
        public String googleClientSecretArn;
        public String antonyccClientId;
        public String antonyccBaseUri;

        public static class Builder {
            private final QuietFeedEnvironmentProps p = new QuietFeedEnvironmentProps();

            public static Builder create() {
                return new Builder();
            }

            public QuietFeedEnvironmentProps build() {
                return p;
            }

            public Builder set(String key, String value) {
                try {
                    var f = QuietFeedEnvironmentProps.class.getDeclaredField(key);
                    f.setAccessible(true);
                    f.set(p, value);
                } catch (Exception ignored) {
                }
                return this;
            }
        }
    }

    public static void main(final String[] args) {
        App app = new App();
        QuietFeedEnvironment.QuietFeedEnvironmentProps appProps = loadAppProps(app);
        var submitEnvironment = new QuietFeedEnvironment(app, appProps);
        app.synth();
        infof("CDK synth complete");
    }

    public QuietFeedEnvironment(App app, QuietFeedEnvironmentProps appProps) {

        // Determine environment and deployment name from env or appProps
        var envName = envOr("ENVIRONMENT_NAME", appProps.envName);
        var deploymentName = envOr("DEPLOYMENT_NAME", envName);

        // Determine primary environment (account/region) from CDK env
        Environment primaryEnv = KindCdk.buildPrimaryEnvironment();
        Environment usEast1Env = Environment.builder()
                .region("us-east-1")
                .account(primaryEnv.getAccount())
                .build();

        var nameProps = new QuietFeedSharedNames.QuietFeedSharedNamesProps();
        nameProps.envName = envName;
        nameProps.deploymentName = deploymentName;
        nameProps.hostedZoneName = appProps.hostedZoneName;
        nameProps.subDomainName = appProps.subDomainName;
        nameProps.regionName = primaryEnv.getRegion();
        nameProps.awsAccount = primaryEnv.getAccount();
        var sharedNames = new QuietFeedSharedNames(nameProps);

        // Load configuration from environment variables not defaulted in the cdk.json
        var googleClientSecretArn = envOr(
                "GOOGLE_CLIENT_SECRET_ARN", appProps.googleClientSecretArn, "(from googleClientSecretArn in cdk.json)");
        var cloudTrailEnabled =
                envOr("CLOUD_TRAIL_ENABLED", appProps.cloudTrailEnabled, "(from cloudTrailEnabled in cdk.json)");
        var accessLogGroupRetentionPeriodDays = Integer.parseInt(
                envOr("ACCESS_LOG_GROUP_RETENTION_PERIOD_DAYS", appProps.accessLogGroupRetentionPeriodDays, "30"));
        var holdingDocRootPath =
                envOr("HOLDING_DOC_ROOT_PATH", appProps.holdingDocRootPath, "(from holdingDocRootPath in cdk.json)");

        // Create ObservabilityStack with resources used in monitoring the application
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.observabilityStackId, deploymentName, envName);
        this.observabilityStack = new ObservabilityStack(
                app,
                sharedNames.observabilityStackId,
                ObservabilityStack.ObservabilityStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .cloudTrailLogGroupPrefix(appProps.cloudTrailLogGroupPrefix)
                        .cloudTrailLogGroupRetentionPeriodDays(appProps.cloudTrailLogGroupRetentionPeriodDays)
                        .accessLogGroupRetentionPeriodDays(accessLogGroupRetentionPeriodDays)
                        .apexDomain(sharedNames.hostedZoneName)
                        .build());

        // Create ObservabilityUE1Stack with resources used in monitoring the application us-east-1
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.observabilityUE1StackId, deploymentName, envName);
        this.observabilityUE1Stack = new ObservabilityUE1Stack(
                app,
                sharedNames.observabilityUE1StackId,
                ObservabilityUE1Stack.ObservabilityUE1StackProps.builder()
                        .env(usEast1Env)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .logGroupRetentionPeriodDays(accessLogGroupRetentionPeriodDays)
                        .build());

        // Create DataStack with shared persistence for all deployments
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.dataStackId, deploymentName, envName);
        this.dataStack = new DataStack(
                app,
                sharedNames.dataStackId,
                DataStack.DataStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .build());

        // Create BackupStack for AWS Backup infrastructure (depends on DataStack tables)
        // Note: alertTopic is configured at application level (OpsStack), not here
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.backupStackId, deploymentName, envName);
        this.backupStack = new BackupStack(
                app,
                sharedNames.backupStackId,
                BackupStack.BackupStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .build());
        this.backupStack.addDependency(this.dataStack);

        // Create the identity stack before any user-aware services
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.identityStackId, deploymentName, envName);
        this.identityStack = new IdentityStack(
                app,
                sharedNames.identityStackId,
                IdentityStack.IdentityStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .hostedZoneName(appProps.hostedZoneName)
                        .hostedZoneId(appProps.hostedZoneId)
                        .certificateArn(appProps.certificateArn)
                        .googleClientId(appProps.googleClientId)
                        .googleClientSecretArn(googleClientSecretArn)
                        .antonyccClientId(appProps.antonyccClientId)
                        .antonyccBaseUri(appProps.antonyccBaseUri)
                        .build());

        this.apexStack = new ApexStack(
                app,
                sharedNames.apexStackId,
                ApexStack.ApexStackProps.builder()
                        .env(usEast1Env)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(envName)
                        .resourceNamePrefix(sharedNames.envResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .hostedZoneName(appProps.hostedZoneName)
                        .hostedZoneId(appProps.hostedZoneId)
                        .certificateArn(appProps.certificateArn)
                        .accessLogGroupRetentionPeriodDays(accessLogGroupRetentionPeriodDays)
                        .holdingDocRootPath(holdingDocRootPath)
                        .build());
    }

    // load context from cdk.json like existing apps
    public static QuietFeedEnvironmentProps loadAppProps(Construct scope) {
        return loadAppProps(scope, null);
    }

    public static QuietFeedEnvironmentProps loadAppProps(Construct scope, String pathPrefix) {
        QuietFeedEnvironmentProps props = QuietFeedEnvironmentProps.Builder.create().build();
        var cdkPath =
                Paths.get((pathPrefix == null ? "" : pathPrefix) + "cdk.json").toAbsolutePath();
        if (!cdkPath.toFile().exists()) {
            warnf("Cannot find application properties (cdk.json) at %s", cdkPath);
        } else {
            for (Field f : QuietFeedEnvironmentProps.class.getDeclaredFields()) {
                if (f.getType() != String.class) continue;
                try {
                    f.setAccessible(true);
                    String current = (String) f.get(props);
                    String fieldName = f.getName();
                    String ctx =
                            com.thequietfeed.utils.KindCdk.getContextValueString(scope, fieldName, current);
                    if (ctx != null) f.set(props, ctx);
                } catch (Exception ignored) {
                }
            }
        }
        if (props.envName == null || props.envName.isBlank()) props.envName = "dev";
        return props;
    }
}
