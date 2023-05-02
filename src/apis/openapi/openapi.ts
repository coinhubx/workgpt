import { classify } from '../../lib/classify'
import { Api } from '../base'
import { Invokable } from '../types'
import { OpenApiOptions } from './types'
import { OpenApiDocument } from './document'
import { OpenApiEndpoint } from './endpoint'
import { buildRequest } from './helpers/request'

export class OpenApi extends Api {
  document: OpenApiDocument
  onBeforeRequest: ((request: Request) => Request) | undefined
  authKey?: string

  constructor(
    document: OpenApiDocument,
    { onBeforeRequest, authKey }: OpenApiOptions = {}
  ) {
    super()
    this.document = document
    this.onBeforeRequest = onBeforeRequest
    this.authKey = authKey
  }

  get namespace() {
    return this.document.name
      ? classify(this.document.name)
      : this.constructor.name
  }

  // Should look like:
  // [{method: 'get_users', usage: 'Gets all users', schema: z.string()}]
  get invokables(): Invokable[] {
    return this.document.endpoints.map(endpointToInvokable)
  }

  async invokeMethod(method: string, args: any[]): Promise<string> {
    const endpoint = this.document.endpoints.find(
      (endpoint) => endpoint.apiMethod === method
    )

    if (!endpoint) {
      throw new Error(`Unknown method: ${method}`)
    }

    let pathParams: Record<string, any> = {}
    let bodyParams: Record<string, any> = {}

    if (endpoint.parametersSchema) {
      ;[pathParams, bodyParams] = args
    } else {
      ;[bodyParams] = args
    }

    const request = buildRequest({
      origin: this.document.origin!,
      path: endpoint.path,
      method: endpoint.method,
      auth: endpoint.getAuthFor(this.authKey),
      pathParams,
      bodyParams,
    })

    const response = await this.makeRequest(request)

    if (!response.ok) {
      throw new Error(
        `Request to ${request.url} failed: ${
          response.statusText
        } / ${await response.text()}`
      )
    }

    const json = await response.json()

    // We want to parse the response to remove any extra fields
    const result = (await endpoint.apiResponseSchema?.parseAsync(json)) ?? json

    // Return a string
    return JSON.stringify(result)
  }

  async makeRequest(request: Request): Promise<Response> {
    if (this.onBeforeRequest) {
      request = this.onBeforeRequest?.(request)
    }

    const response = await fetch(request)

    if (!response.ok) {
      throw new Error(
        `Request to ${request.url} failed: ${
          response.statusText
        } / ${await response.text()}`
      )
    }

    return response
  }

  static async fromDocument(document: any, options: OpenApiOptions = {}) {
    const parsed = await OpenApiDocument.fromDocument(document)
    return new this(parsed, options)
  }
}

function endpointToInvokable(endpoint: OpenApiEndpoint): Invokable {
  return {
    method: endpoint.apiMethod,
    usage: endpoint.apiUsage,
    schema: endpoint.apiSchema,
    responseSchema: endpoint.apiResponseSchema,
  }
}
