/**
 * DynamoDB Client Singleton
 * ─────────────────────────
 * Provides a pre-configured DynamoDB DocumentClient that points to
 * LocalStack (http://localhost:4566) or a real AWS endpoint.
 * 
 * Uses the AWS SDK v3 DocumentClient which automatically handles
 * marshalling/unmarshalling between JS objects and DynamoDB's wire format.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const rawClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

export const dynamoClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,   // Don't serialize undefined fields
    convertEmptyValues: true,      // Convert empty strings to null (DynamoDB constraint)
  },
  unmarshallOptions: {
    wrapNumbers: false,            // Return plain JS numbers, not NumberValue objects
  },
});

// Re-export the raw client for operations that need it (e.g., ListTables)
export const rawDynamoClient = rawClient;
