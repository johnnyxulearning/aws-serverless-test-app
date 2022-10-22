<!--
title: 'Serverless Framework Node Express API service backed by DynamoDB on AWS'
description: 'This project is an API service backed by DynamoDB running on AWS Lambda using the traditional Serverless Framework.'
layout: Doc
framework: v3
platform: AWS
language: nodeJS
priority: 1
authorLink: 'https://github.com/johnnyxulearning/'
authorName: 'Johnny Xu'
-->

# aws-serverless-test-app

#### Design considerations - REST API vs HTTP API

1. Scalability
   REST APIs (for example Expressjs) usually have larger codebase due to closely coupled endpoints than HTTP APIs. So HTTP API is more flexible and scalable.
2. Cost effectiveness
   REST APIs (for example Expressjs) usually require more compute and memory which would result in higher costs than HTTP APIs. HTTP APIs are up to 71% cheaper compared to REST APIs according to Amazon.
3. Performance
   REST APIs (for example Expressjs) usually proxy all requests to lambda which could intrduce higher latency comparing to HTTP APIs which leverage API Gateway's native routing functionality.

Decision made: HTTP API

### Top-level directory layout

    .
    ├── test-app-board-api                   # Boards API project
    ├── test-app-user-api                    # Users API project
    ├── service architecture.png             # Serverless app architecture
    └── README.md

### Service architecture diagram

![alt text](https://github.com/johnnyxulearning/aws-serverless-test-app/blob/main/service%20architecture.png?raw=true)

### Unit test

DynamoDB: can use aws cli to create a table with dummy data, then query the table that just created. If query successfully, then the test is passed. Looks like aws-sdk also provides dynamodb test capability.

Lambda: can write unit test case using frameworks like Mocha, Jest and Chai.

### Integration test

Use any HTTP client software, for example Postman.

And can be further automated as part of DevOps CI/CD pipelines
