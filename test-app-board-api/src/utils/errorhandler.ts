import ApiError from "../customErrors/apiError";

const errorHandler = (error: unknown) => {
  if (error instanceof SyntaxError) {
    return {
      reasonPhrase: "Bad Request",
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: `invalid request body format : "${error.message}"`,
      }),
    };
  }

  if (error instanceof ApiError) {
    return {
      reasonPhrase: error.reasonPhrase,
      statusCode: error.statusCode,
      headers: { "Content-Type": "application/json" },
      body: error.message,
    };
  }

  throw error;
};

export = errorHandler;
