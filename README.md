# Mocktory (beta)

Mocktory is a simple mocks manager for Node.js applications. It is built on the idea of combining [msw](https://mswjs.io/) interceptors with persistence using Redis.

The library aims to provide an easy way to manage mocks for DEV/QA/AQA teams for system testing and simulating different scenarios in real-time.

## Features

- Track all outgoing HTTP requests from a Node.js application in history.
- Manipulate responses in real-time, setting different scenarios: failure, success, or passthrough.
- Consolidate all your custom real-time and default mocks in one place.
- Template responses with request data such as query parameters or body.

## Roadmap

- Transform Swagger to a nice UI.
- Allow saving requests to custom storage (like S3).
- Provide more granular control of history TTL and other system parameters.
- Offer default enhancers for feature IDs that have unique factors apart from the basic URL.

## Installation

npm

```jsr
npm install mocktory
```

jsr

```jsr
npx jsr add mocktory
```

## Usage

```ts
import { MockService } from 'mocktory'

const ms = new MockService({
  // Define a base path to serve docs,
  // docs will be available at /api/mock-service/docs
  basePath: '/api/mock-service',

  redis: { host: config.redis.host, port: config.redis.port },

  // The history feature can aggregate all requests by the key you provide.
  // It could be a request ID, generated by AsyncLocalStorage.
  requestAggKey: () => AppContext.getRequestId(),

  // Define a pattern to import files with default mocks.
  filesPattern: '**/modules/**/*.mocking*',

  // Blacklist annoying requests to prevent them from appearing in history.
  // You can also change it in real-time.
  reqBlacklist: [
    /sqs.*amazonaws.com/,
    /s3.*amazonaws.com/,
    /sns.*amazonaws.com/,
  ],
})

// It's possible to subscribe to various events.
ms.events.on('mock:set', ({ id, body }) =>
  logger.debug(`Mock set: ${id} with body:`, body),
)
```
