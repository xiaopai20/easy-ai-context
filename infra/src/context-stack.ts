import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayAuthorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

export class ContextStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';
    const allowedEmails = this.node.tryGetContext('allowedEmails') || process.env.ALLOWED_EMAILS || '';
    const googleClientId = this.node.tryGetContext('googleClientId') || process.env.GOOGLE_CLIENT_ID || '';
    const googleClientSecret = this.node.tryGetContext('googleClientSecret') || process.env.GOOGLE_CLIENT_SECRET || '';
    const callbackUrl = this.node.tryGetContext('callbackUrl') || process.env.CALLBACK_URL || 'http://localhost:3000';

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `context-${env}`,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Domain for OAuth
    const domain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `context-${env}-${this.account}`.substring(0, 53),
      },
    });

    // User Pool Client (for API clients / future use)
    const userPoolClient = userPool.addClient('ApiClient', {
      userPoolClientName: `context-api-${env}`,
      generateSecret: false,
      refreshTokenValidity: cdk.Duration.days(30),
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          callbackUrl,
          `${callbackUrl}/`,
          'http://localhost:3000',
          'http://localhost:3000/',
          'https://chatgpt.com/connector_platform_oauth_redirect',
          'https://platform.openai.com/apps-manage/oauth',
          'cursor://anysphere.cursor-mcp/oauth/callback',
          'cursor://anysphere.cursor-mcp/oauth/context/callback',
          'http://127.0.0.1:1455/auth/callback',
          'http://localhost:1455/auth/callback',
        ],
        logoutUrls: [
          callbackUrl,
          `${callbackUrl}/`,
          'http://localhost:3000',
          'http://localhost:3000/',
          'https://chatgpt.com/connector_platform_oauth_redirect',
          'https://platform.openai.com/apps-manage/oauth',
          'cursor://anysphere.cursor-mcp/oauth/callback',
          'cursor://anysphere.cursor-mcp/oauth/context/callback',
          'http://127.0.0.1:1455/auth/callback',
          'http://localhost:1455/auth/callback',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        ...(googleClientId && googleClientSecret
          ? [cognito.UserPoolClientIdentityProvider.GOOGLE]
          : []),
      ],
    });

    // Google Identity Provider
    if (googleClientId && googleClientSecret) {
      new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool,
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        },
      });
    }

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'Table', {
      tableName: `Context-${env}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1_SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // API Gateway HTTP API (created before Lambda so we can pass ApiUrl to env)
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: `context-api-${env}`,
      description: `Context API - ${env}`,
      corsPreflight: {
        allowOrigins: env === 'prod'
          ? [callbackUrl, 'https://chatgpt.com', 'https://chat.openai.com', 'https://platform.openai.com']
          : [callbackUrl, 'http://localhost:3000', 'http://localhost:3010', 'https://chatgpt.com', 'https://chat.openai.com', 'https://platform.openai.com'],
        allowMethods: [apigateway.CorsHttpMethod.POST, apigateway.CorsHttpMethod.GET, apigateway.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'MCP-Protocol-Version', 'Mcp-Session-Id'],
        allowCredentials: true,
        exposeHeaders: ['WWW-Authenticate'],
      },
    });

    const region = this.region || 'us-east-1';
    const cognitoIssuerUrl = `https://${domain.domainName}.auth.${region}.amazoncognito.com`;
    const cognitoOidcDiscoveryUrl = `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`;
    const apiBaseUrl = `https://${httpApi.apiId}.execute-api.${region}.amazonaws.com`;

    // Lambda Function (NodejsFunction bundles deps including @context/shared)
    const apiFunction = new lambdaNodejs.NodejsFunction(this, 'ApiFunction', {
      functionName: `context-api-${env}`,
      entry: path.join(PROJECT_ROOT, 'services/api/src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      projectRoot: PROJECT_ROOT,
      depsLockFilePath: path.join(PROJECT_ROOT, 'package-lock.json'),
      environment: {
        TABLE_NAME: table.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_ISSUER_URL: cognitoIssuerUrl,
        COGNITO_OIDC_DISCOVERY_URL: cognitoOidcDiscoveryUrl,
        COGNITO_USERINFO_URL: `${cognitoIssuerUrl}/oauth2/userInfo`,
        API_BASE_URL: apiBaseUrl,
        DEV_MODE: 'false',
        ...(allowedEmails ? { ALLOWED_EMAILS: allowedEmails } : {}),
      },
    });

    table.grantReadWriteData(apiFunction);
    userPool.grant(apiFunction, 'cognito-idp:AdminGetUser');

    const authorizer = new apigatewayAuthorizers.HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
    });

    const integration = new apigatewayIntegrations.HttpLambdaIntegration('ApiIntegration', apiFunction);

    // OAuth discovery - must be public (no authorizer) so GPT can fetch before auth
    // MCP spec: clients MUST look for RFC 8414 at /.well-known/oauth-authorization-server
    // RFC 9728: for resource https://host/mcp, metadata is at /.well-known/oauth-protected-resource/mcp
    const oauthPaths = [
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
      '/mcp/.well-known/oauth-protected-resource',
    ];
    for (const oauthPath of oauthPaths) {
      httpApi.addRoutes({
        path: oauthPath,
        methods: [apigateway.HttpMethod.GET],
        integration,
      });
    }

    httpApi.addRoutes({
      path: '/hello',
      methods: [apigateway.HttpMethod.GET],
      integration,
      authorizer,
    });

    // /mcp - no authorizer at API Gateway; Lambda returns 401 + WWW-Authenticate for OAuth discovery
    // GET for SSE stream (Cursor), POST for JSON-RPC
    httpApi.addRoutes({
      path: '/mcp',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST, apigateway.HttpMethod.OPTIONS],
      integration,
    });
    httpApi.addRoutes({
      path: '/mcp/sse',
      methods: [apigateway.HttpMethod.GET],
      integration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url || '',
      exportName: `Context-${env}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      exportName: `Context-${env}-TableName`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      exportName: `Context-${env}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      exportName: `Context-${env}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: domain.domainName,
      exportName: `Context-${env}-CognitoDomain`,
    });
  }
}
