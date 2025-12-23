import type { Logger } from "./logger";
import type { AxiosResponse, AxiosError } from "axios";

// Helper to log outgoing HTTP requests
export function logHttpRequest(
  logger: Logger,
  method: string,
  url: string,
  context?: Record<string, unknown>
) {
  logger.debug(
    {
      http: {
        method,
        url,
        direction: "outgoing",
      },
      ...context,
    },
    `HTTP ${method} ${url}`
  );
}

// Helper to log successful HTTP responses
export function logHttpResponse(
  logger: Logger,
  method: string,
  url: string,
  response: AxiosResponse | Response,
  startTime: number,
  context?: Record<string, unknown>
) {
  const duration = Date.now() - startTime;

  // Both Axios and Fetch responses have status property
  const statusCode = response.status;
  const statusText = "statusText" in response ? response.statusText : "";

  logger.info(
    {
      http: {
        method,
        url,
        statusCode,
        statusText,
        duration,
        direction: "outgoing",
      },
      ...context,
    },
    `HTTP ${method} ${url} completed in ${duration}ms with status ${statusCode}`
  );
}

// Helper to log HTTP errors
export function logHttpError(
  logger: Logger,
  method: string,
  url: string,
  error: unknown,
  startTime: number,
  context?: Record<string, unknown>
) {
  const duration = Date.now() - startTime;

  if (error && typeof error === "object" && "response" in error) {
    // Axios error with response
    const axiosError = error as AxiosError;
    logger.error(
      {
        err: axiosError,
        http: {
          method,
          url,
          statusCode: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          duration,
          direction: "outgoing",
          responseData: axiosError.response?.data,
        },
        ...context,
      },
      `HTTP ${method} ${url} failed with status ${axiosError.response?.status}`
    );
  } else if (error && typeof error === "object" && "code" in error) {
    // Network error (no response)
    logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        http: {
          method,
          url,
          errorCode: (error as any).code,
          duration,
          direction: "outgoing",
        },
        ...context,
      },
      `HTTP ${method} ${url} failed with network error`
    );
  } else {
    // Other error
    logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        http: {
          method,
          url,
          duration,
          direction: "outgoing",
        },
        ...context,
      },
      `HTTP ${method} ${url} failed`
    );
  }
}
