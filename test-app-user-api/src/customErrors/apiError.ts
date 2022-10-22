class ApiError extends Error {
  constructor(
    public reasonPhrase: string,
    public statusCode: number,
    body: Record<string, unknown> = {}
  ) {
    super(JSON.stringify(body));
  }
}

export = ApiError;
