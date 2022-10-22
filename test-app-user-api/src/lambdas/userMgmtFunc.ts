import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SNSHandler,
  SNSEvent,
  SNSEventRecord,
} from "aws-lambda";
import AWS from "aws-sdk";
import ApiError from "../customErrors/apiError";
import { IUser } from "../schemas/Interfaces";
import errorHandler from "../utils/errorhandler";
import { v4 } from "uuid";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "users-table-dev"; // Hard coded for quick dev

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+                                                                                     + 
+                           Below are a list of lambdas                               +  
+                                                                                     +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

// Register user lambda
export const registerUserHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
) => {
  try {
    const result = await registerUser(event);

    return {
      statusCode: 202,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Creating your user account...",
      }),
    };
  } catch (err) {
    return errorHandler(err);
  }
};

// Creat user in dynamoDB lambda
export const createUserInDynamoDbHandler: SNSHandler = async (
  event: SNSEvent
) => {
  try {
    const records: SNSEventRecord[] = event.Records;
    await createUserInDynamoDb(tableName, records);
  } catch (error) {
    console.error(error);
  }
};

// Query user by email lambda
export const queryUserHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = await queryUserByEmail(event.queryStringParameters?.email);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    };
  } catch (err) {
    return errorHandler(err);
  }
};

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+                                                                                     + 
+            Below are functions providing core logics for the lambdas above          +  
+                                                                                     +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

// Core logic to publish messages to sns user-registration-event topic
async function registerUser(event: APIGatewayProxyEvent) {
  const sns = new AWS.SNS({
    region: "us-east-1", // Hard coded for quick dev
  });

  // Data validation to make sure body attribute is present
  if (!event.body) {
    throw new ApiError(`Bad Request`, 400, {
      error: `Event body was not found!`,
    });
  }
  const dataInJson = JSON.parse(event.body as string);

  // Constructs sns publish input
  const params: AWS.SNS.PublishInput = {
    Message: event.body || '{"body": "empty body"}',
    MessageStructure: "json",
    MessageAttributes: {
      name: {
        DataType: "String",
        StringValue: dataInJson?.name ?? "empty",
      },
      email: {
        DataType: "String",
        StringValue: dataInJson?.email ?? "empty",
      },
    },
    TopicArn: "arn:aws:sns:us-east-1:466883570052:user-registration-event",
  };

  // Publishes a message to sns topic
  try {
    const publish = await sns.publish(params).promise();

    // Local debug
    console.log(
      `Message ${params.Message} sent to the topic ${params.TopicArn}`
    );
    console.log("MessageID is " + publish.MessageId);
  } catch (err) {
    throw new ApiError(`Internal Server Error`, 500, {
      error: `Could not pulish the message. ${err}`,
    });
  }
}

// Core logic to save a user object in a table
async function createUserInDynamoDb(
  tableName: string,
  records: SNSEventRecord[]
) {
  // Retrieves table name from sns notification message and constructs table item object
  const user: IUser = {
    name: records[0].Sns.MessageAttributes.name.Value ?? "empty",
    email: records[0].Sns.MessageAttributes.email.Value ?? "empty",
    id: v4(), // Generates a ramdan uuid as user id
    status: false,
    createdAt: new Date().toISOString(),
  };

  // Saves a user object in databases
  await docClient
    .put({
      TableName: tableName,
      Item: user,
    })
    .promise();
}

// Core logic to query a user info from a table
async function queryUserByEmail(email: string | undefined) {
  // Data validation to make sure the email is not falsely
  if (!email) {
    throw new ApiError(`Bad Request`, 400, {
      error: `Query parameter email can not be empty.`,
    });
  }

  // Constructs item query input
  const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
    TableName: tableName,
    Key: {
      email: email,
    },
    AttributesToGet: ["email", "name", "id"], // Returns these attributes in api response
  };

  // Query in table
  const user = await docClient.get(params).promise();

  // Throws a 404 api error if the user item is not found
  if (!user.Item) {
    throw new ApiError(`Not Found`, 404, {
      error: `Email: ${email} was not found in our database`,
    });
  }

  return user.Item;
}
