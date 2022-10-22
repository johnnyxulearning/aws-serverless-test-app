import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  SNSHandler,
  SNSEvent,
  SNSEventRecord,
  SQSHandler,
  SQSMessageAttributes,
  SQSEvent,
} from "aws-lambda";
import AWS, { SQS } from "aws-sdk";
import ApiError from "../customErrors/apiError";
import { IMessage, IMessageBoard } from "../schemas/Interfaces";
import errorHandler from "../utils/errorhandler";

const docClient = new AWS.DynamoDB.DocumentClient();
const dbClient = new AWS.DynamoDB();
const sqs = new SQS();
const tableName = "boards-table-dev"; // Hard coded for quick dev

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+                                                                                     + 
+                           Below is a list of lambdas                               +  
+                                                                                     +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

// Retrieve all message board handler
export const listAllBoardsHandler: APIGatewayProxyHandler =
  async (): Promise<APIGatewayProxyResult> => {
    try {
      const boards = await listAllBoards();

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boards),
      };
    } catch (err) {
      return errorHandler(err);
    }
  };

// Create a message board handler
export const createBoardHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
) => {
  try {
    await createBoardProducer(event, context);

    return {
      statusCode: 202,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Creating your board...",
      }),
    };
  } catch (err) {
    return errorHandler(err);
  }
};

// Save board in dynamoDb
export const saveBoardInDynamoDbHandler = async (
  event: SQSEvent,
  context: Context
) => {
  try {
    await createBoardConsumer(event, context, () => {});
  } catch (err) {
    console.error(err);
  }
};

// Post a message to SNS topic
export const postMessageHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
) => {
  try {
    await postMessage(event);

    return {
      statusCode: 202,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Posting your message...",
      }),
    };
  } catch (err) {
    return errorHandler(err);
  }
};

// Save a message to a board in database handler
export const saveMessageInDynamoDbHandler: SNSHandler = async (
  event: SNSEvent
) => {
  try {
    const records: SNSEventRecord[] = event.Records;
    await saveMessageInDynamoDb(records);
  } catch (err) {
    console.error(err);
  }
};

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+                                                                                     + 
+            Below are functions providing core logics for the lambdas above          +  
+                                                                                     +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

// Core logic to retrieve all the boards from database
async function listAllBoards() {
  const boards = await docClient
    .scan({
      TableName: tableName,
      AttributesToGet: ["boardName", "category", "owner", "createdAt"], // Returns these attributes in api response
    })
    .promise();

  if (!boards.Items) {
    throw new ApiError(`Not Found`, 404, {
      error: `No message board was not found in our database`,
    });
  }

  return boards.Items;
}

// Core logic to save a message object in a table
async function saveMessageInDynamoDb(records: SNSEventRecord[]) {
  // Data validation to make sure board attribute is present
  if (!records[0].Sns.MessageAttributes.board.Value) {
    throw new ApiError(`Bad Request`, 400, {
      error: `Value of board is required`,
    });
  }

  // Retrieves table name from sns notification message and constructs table item object
  const tableName: string =
    records[0].Sns.MessageAttributes.board.Value ?? "empty";

  const message: IMessage = {
    content: records[0].Sns.MessageAttributes.content.Value ?? "empty",
    active: false,
    PostedAt: new Date().toISOString(),
  };

  // Saves a message object in databases
  await docClient
    .put({
      TableName: tableName,
      Item: message,
    })
    .promise();
}

// Core logic to publish messages to sns post-message-event topic
async function postMessage(event: APIGatewayProxyEvent) {
  const sns = new AWS.SNS({
    region: "us-east-1", // Hard coded for quick dev
  });

  const dataInJson = JSON.parse(event.body as string);

  // Date validation to make sure board attribute is present
  if (!dataInJson.board) {
    throw new ApiError(`Bad Request`, 400, {
      error: "Attribute board is required",
    });
  }

  // Constructs sns publish input
  const params: AWS.SNS.PublishInput = {
    Message: event.body || '{"body": "empty body"}',
    MessageStructure: "json",
    MessageAttributes: {
      board: {
        DataType: "String",
        StringValue: dataInJson.board ?? "empty",
      },
      content: {
        DataType: "String",
        StringValue: dataInJson?.content ?? "empty",
      },
    },
    TopicArn: "arn:aws:sns:us-east-1:466883570052:post-message-event",
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

// Core logic to push messages to sqs CreateBoardQueue queue
async function createBoardProducer(
  event: APIGatewayProxyEvent,
  context: Context
) {
  // Data validation to make sure body attribute is present
  if (!event.body) {
    throw new ApiError(`Bad Request`, 400, {
      error: `Event body was not found!`,
    });
  }

  const accountId: string = context.invokedFunctionArn.split(":")[4];
  const queueUrl: string = `https://sqs.us-east-1.amazonaws.com/466883570052/CreateBoardQueue`; // Hard coded for quick dev

  const dataInJson = JSON.parse(event.body as string);

  // Pushes a message to the sqs queue
  await sqs
    .sendMessage({
      QueueUrl: queueUrl,
      MessageBody: event.body,
      MessageAttributes: {
        name: {
          StringValue: dataInJson?.name ?? "empty",
          DataType: "String",
        },
        category: {
          StringValue: dataInJson?.category ?? "empty",
          DataType: "String",
        },
        owner: {
          StringValue: accountId ?? "empty",
          DataType: "String",
        },
      },
    })
    .promise();
}

// Core logic to pull messages from sqs CreateBoardQueue queue, create a new item in existing boards table and create a new board table for the newly create board
const createBoardConsumer: SQSHandler = async function (event: SQSEvent) {
  try {
    // Retrieve the data content from the sqs queue
    const messageAttributes: SQSMessageAttributes =
      event.Records[0].messageAttributes;
    const boardName: string = messageAttributes?.name.stringValue ?? "empty";

    // Construct createTable input
    const board: IMessageBoard = {
      boardName: boardName,
      category: messageAttributes?.category.stringValue ?? "empty",
      owner: messageAttributes?.owner.stringValue ?? "empty",
      createdAt: new Date().toISOString(),
    };
    const createBoardTableInput: AWS.DynamoDB.Types.CreateTableInput = {
      TableName: boardName,
      KeySchema: [
        {
          AttributeName: "content",
          KeyType: "HASH",
        },
      ],
      AttributeDefinitions: [
        {
          AttributeName: "content",
          AttributeType: "S",
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
    };

    // Create board item in boards table
    await docClient
      .put({
        TableName: tableName,
        Item: board,
      })
      .promise();

    // Create a table for the new board
    // May add some validation here to make sure we are not creating duplicated table within the same region
    await dbClient.createTable(createBoardTableInput).promise();
  } catch (err) {
    throw new ApiError("Internal Server Error", 500, {
      error: `SQS consumer error: ${err}`,
    });
  }
};
