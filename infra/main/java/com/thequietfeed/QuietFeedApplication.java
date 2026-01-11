/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 Antony Cartwright
 */

package com.thequietfeed;

import static com.thequietfeed.utils.Kind.envOr;
import static com.thequietfeed.utils.Kind.infof;
import static com.thequietfeed.utils.Kind.warnf;

import com.thequietfeed.constructs.AbstractApiLambdaProps;
import com.thequietfeed.stacks.AccountStack;
import com.thequietfeed.stacks.ApiStack;
import com.thequietfeed.stacks.AuthStack;
import com.thequietfeed.stacks.DevStack;
import com.thequietfeed.stacks.EdgeStack;
import com.thequietfeed.stacks.OpsStack;
import com.thequietfeed.stacks.PublishStack;
import com.thequietfeed.stacks.SelfDestructStack;
import com.thequietfeed.utils.KindCdk;
import java.lang.reflect.Field;
import java.nio.file.Paths;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.constructs.Construct;

public class QuietFeedApplication {

    public final DevStack devStack;
    public final DevStack ue1DevStack;
    public final AuthStack authStack;
    public final AccountStack accountStack;
    public final ApiStack apiStack;
    public final OpsStack opsStack;
    public final EdgeStack edgeStack;
    public final PublishStack publishStack;
    public final SelfDestructStack selfDestructStack;

    public static class QuietFeedApplicationProps {
        // Fields match cdk.json context keys (camelCase). Environment overrides are applied in QuietFeedApplication
        public String envName;
        public String deploymentName;
        public String hostedZoneName;
        public String subDomainName;
        public String cloudTrailEnabled;
        public String baseImageTag;
        public String selfDestructDelayHours;
        public String userPoolArn;
        public String userPoolClientId;
        public String bundlesTableArn;
        public String hostedZoneId;
        public String certificateArn;
        public String docRootPath;
        public String httpApiUrl;

        public static class Builder {
            private final QuietFeedApplicationProps p = new QuietFeedApplicationProps();

            public static Builder create() {
                return new Builder();
            }

            public QuietFeedApplicationProps build() {
                return p;
            }

            public Builder set(String key, String value) {
                try {
                    var f = QuietFeedApplicationProps.class.getDeclaredField(key);
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
        QuietFeedApplicationProps appProps = loadAppProps(app);
        var submitApplication = new QuietFeedApplication(app, appProps);
        app.synth();
        infof("CDK synth complete");
        if (submitApplication.selfDestructStack != null) {
            infof("Created stack: %s", submitApplication.selfDestructStack.getStackName());
        } else {
            infof("No SelfDestruct stack created for prod deployment");
        }
    }

    public QuietFeedApplication(App app, QuietFeedApplicationProps appProps) {

        // Determine environment and deployment name from env or appProps
        String envName = envOr("ENVIRONMENT_NAME", appProps.envName);
        String deploymentName = envOr("DEPLOYMENT_NAME", appProps.deploymentName);

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

        // Allow environment variables to override some appProps values
        var cognitoUserPoolArn = envOr("COGNITO_USER_POOL_ARN", appProps.userPoolArn, "(from userPoolArn in cdk.json)");
        var cognitoUserPoolClientId =
                envOr("COGNITO_CLIENT_ID", appProps.userPoolClientId, "(from userPoolClientId in cdk.json)");
        var cognitoUserPoolId = cognitoUserPoolArn != null
                ? cognitoUserPoolArn.split("/")[1]
                : "(unknown cognitoUserPoolId because no cognitoUserPoolArn)";
        var baseImageTag = envOr("BASE_IMAGE_TAG", appProps.baseImageTag, "(from baseImageTag in cdk.json)");
        var selfDestructDelayHoursString = envOr(
                "SELF_DESTRUCT_DELAY_HOURS",
                appProps.selfDestructDelayHours,
                "(from selfDestructDelayHours in cdk.json)");
        int selfDestructDelayHours = Integer.parseInt(selfDestructDelayHoursString);
        var selfDestructStartDatetimeIso = envOr(
                "SELF_DESTRUCT_START_DATETIME",
                ZonedDateTime.now().plusHours(selfDestructDelayHours).format(DateTimeFormatter.ISO_DATE_TIME),
                "(from current time plus delay hours)");
        ZonedDateTime selfDestructStartDatetime = ZonedDateTime.parse(selfDestructStartDatetimeIso);
        infof("Self-destruct start datetime: %s", selfDestructStartDatetime);
        var cloudTrailEnabled =
                envOr("CLOUD_TRAIL_ENABLED", appProps.cloudTrailEnabled, "(from cloudTrailEnabled in cdk.json)");
        var httpApiUrl = envOr("HTTP_API_URL", appProps.httpApiUrl, "(from httpApiUrl in cdk.json)");
        var commitHash = envOr("COMMIT_HASH", "local");
        var websiteHash = envOr("WEBSITE_HASH", "local");
        var buildNumber = envOr("BUILD_NUMBER", "local");
        var docRootPath = envOr("DOC_ROOT_PATH", appProps.docRootPath, "(from docRootPath in cdk.json)");

        // Create DevStack with resources only used during development or deployment (e.g. ECR)
        infof(
                "Synthesizing stack %s for deployment %s to environment %s for region %s",
                primaryEnv.getRegion(), sharedNames.devStackId, deploymentName, envName);
        this.devStack = new DevStack(
                app,
                sharedNames.devStackId,
                DevStack.DevStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .build());

        // Create DevStack for us-east-1 region (for the edge services like CloudFront)
        infof(
                "Synthesizing stack %s for deployment %s to environment %s for region us-east-1",
                sharedNames.ue1DevStackId, deploymentName, envName);
        this.ue1DevStack = new DevStack(
                app,
                sharedNames.ue1DevStackId,
                DevStack.DevStackProps.builder()
                        .env(usEast1Env)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .build());

        // Create the AuthStack with resources used in authentication and authorisation
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.authStackId, deploymentName, envName);
        this.authStack = new AuthStack(
                app,
                sharedNames.authStackId,
                AuthStack.AuthStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .baseImageTag(baseImageTag)
                        .cognitoClientId(cognitoUserPoolClientId)
                        .cognitoUserPoolId(cognitoUserPoolId)
                        .cognitoUserPoolClientId(cognitoUserPoolClientId)
                        .build());
        // this.authStack.addDependency(devStack);

        // Create the AccountStack
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.accountStackId, deploymentName, envName);
        this.accountStack = new AccountStack(
                app,
                sharedNames.accountStackId,
                AccountStack.AccountStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .baseImageTag(baseImageTag)
                        .cognitoUserPoolArn(cognitoUserPoolArn)
                        .build());
        // this.accountStack.addDependency(devStack);

        // Create the ApiStack with API Gateway v2 for all Lambda endpoints
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.apiStackId, deploymentName, envName);

        // Create a map of Lambda function references from other stacks
        List<AbstractApiLambdaProps> lambdaFunctions = new java.util.ArrayList<>();
        lambdaFunctions.addAll(this.authStack.lambdaFunctionProps);
        lambdaFunctions.addAll(this.accountStack.lambdaFunctionProps);

        this.apiStack = new ApiStack(
                app,
                sharedNames.apiStackId,
                ApiStack.ApiStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .lambdaFunctions(lambdaFunctions)
                        .userPoolId(cognitoUserPoolId)
                        .userPoolClientId(cognitoUserPoolClientId)
                        .customAuthorizerLambdaArn(authStack.customAuthorizerLambda.getFunctionArn())
                        .build());
        this.apiStack.addDependency(accountStack);
        this.apiStack.addDependency(authStack);

        // Get optional alert email from environment variable
        String alertEmail = envOr("ALERT_EMAIL", "");

        this.opsStack = new OpsStack(
                app,
                sharedNames.opsStackId,
                OpsStack.OpsStackProps.builder()
                        .env(primaryEnv)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .baseUrl(sharedNames.baseUrl)
                        .apexDomain(sharedNames.envDomainName)
                        .alertEmail(alertEmail)
                        .build());
        // this.opsStack.addDependency(apiStack);

        // Create the Edge stack (CloudFront, Route53)
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.edgeStackId, deploymentName, envName);
        this.edgeStack = new EdgeStack(
                app,
                sharedNames.edgeStackId,
                EdgeStack.EdgeStackProps.builder()
                        .env(usEast1Env)
                        .crossRegionReferences(true)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .hostedZoneName(appProps.hostedZoneName)
                        .hostedZoneId(appProps.hostedZoneId)
                        .certificateArn(appProps.certificateArn)
                        .apiGatewayUrl(httpApiUrl)
                        .build());

        // Create the Publish stack (Bucket Deployments to CloudFront)
        infof(
                "Synthesizing stack %s for deployment %s to environment %s",
                sharedNames.publishStackId, deploymentName, envName);
        String distributionId = this.edgeStack.distribution.getDistributionId();
        this.publishStack = new PublishStack(
                app,
                sharedNames.publishStackId,
                PublishStack.PublishStackProps.builder()
                        .env(usEast1Env)
                        .crossRegionReferences(false)
                        .envName(envName)
                        .deploymentName(deploymentName)
                        .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                        .cloudTrailEnabled(cloudTrailEnabled)
                        .sharedNames(sharedNames)
                        .distributionId(distributionId)
                        .commitHash(commitHash)
                        .websiteHash(websiteHash)
                        .buildNumber(buildNumber)
                        .docRootPath(docRootPath)
                        .build());
        // this.publishStack.addDependency(this.edgeStack);

        // Create the SelfDestruct stack only for non-prod deployments
        if (!"prod".equals(envName)) {
            this.selfDestructStack = new SelfDestructStack(
                    app,
                    sharedNames.selfDestructStackId,
                    SelfDestructStack.SelfDestructStackProps.builder()
                            .env(primaryEnv)
                            .crossRegionReferences(false)
                            .envName(envName)
                            .deploymentName(deploymentName)
                            .resourceNamePrefix(sharedNames.appResourceNamePrefix)
                            .cloudTrailEnabled(cloudTrailEnabled)
                            .sharedNames(sharedNames)
                            .baseImageTag(baseImageTag)
                            .selfDestructLogGroupName(sharedNames.ew2SelfDestructLogGroupName)
                            .selfDestructStartDatetime(selfDestructStartDatetime)
                            .selfDestructDelayHours(selfDestructDelayHours)
                            .isApplicationStack(true)
                            .build());
        } else {
            this.selfDestructStack = null;
        }
    }

    // populate from cdk.json context using exact camelCase keys
    public static QuietFeedApplicationProps loadAppProps(Construct scope) {
        return loadAppProps(scope, null);
    }

    public static QuietFeedApplicationProps loadAppProps(Construct scope, String pathPrefix) {
        QuietFeedApplicationProps props = QuietFeedApplicationProps.Builder.create().build();
        var cdkPath =
                Paths.get((pathPrefix == null ? "" : pathPrefix) + "cdk.json").toAbsolutePath();
        if (!cdkPath.toFile().exists()) {
            warnf("Cannot find application properties (cdk.json) at %s", cdkPath);
        } else {
            infof("Loading application properties from cdk.json %s", cdkPath);
            for (Field f : QuietFeedApplicationProps.class.getDeclaredFields()) {
                if (f.getType() != String.class) continue;
                try {
                    f.setAccessible(true);
                    String current = (String) f.get(props);
                    String fieldName = f.getName();
                    String ctx = KindCdk.getContextValueString(scope, fieldName, current);
                    if (ctx != null) f.set(props, ctx);
                    infof("Load context %s=%s", fieldName, ctx);
                } catch (Exception e) {
                    warnf("Failed to read context for %s: %s", f.getName(), e.getMessage());
                }
            }
        }

        // default env to dev if not set
        if (props.envName == null || props.envName.isBlank()) props.envName = "dev";
        return props;
    }
}
