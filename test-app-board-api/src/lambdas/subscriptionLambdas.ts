import AWS from "aws-sdk";
import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import ApiError from "../customErrors/apiError";
import errorHandler from "../utils/errorhandler";

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+                                                                                     + 
+                           Below are a list of lambdas                               +  
+                                                                                     +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

// Topic subscription handler
export const subscribeTopticHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    await subscribTopic(event);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Successfully subscribed!` }),
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

// Core logic to subscribe a topic
async function subscribTopic(event: APIGatewayProxyEvent) {
  const sns = new AWS.SNS({
    region: "us-east-1", // Hard coded for quick dev
  });

  const dataInJson = JSON.parse(event.body as string);

  // Data validation to make sure email attribute is present
  if (!dataInJson.email) {
    throw new ApiError(`Bad Request`, 400, {
      error: "Email address is required",
    });
  }

  // Constuct sns subscribe message input
  const subscribeInput: AWS.SNS.Types.SubscribeInput = {
    Protocol: dataInJson?.protocol ?? "EMAIL",
    TopicArn:
      dataInJson?.topicArn ??
      "arn:aws:sns:us-east-1:466883570052:post-message-event",
    Endpoint: dataInJson.email,
  };

  // Subscribes a topic
  try {
    await sns.subscribe(subscribeInput).promise();
  } catch (err) {
    throw new ApiError(`Internal Server Error`, 500, { error: err });
  }
}
