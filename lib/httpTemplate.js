// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
const url = require('url'),
  uuid = require('uuid');

class HttpTemplate {

  constructor(request, responses) {
    this.request = request;
    this.responses = responses;
  }

  getHost() {
    let result = 'management.azure.com';
    if (this.request.url) {
      result = url.parse(this.request.url).host;
    }
    return result;
  }

  getRequestHeaders() {
    let result = ``;
    if (this.request.body) {
      result += `Content-Length: ${JSON.stringify(this.request.body).length}\n`;
    }
    if (this.request.headers) {
      let headers = Object.keys(this.request.headers);

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        result += `${headerName}: ${this.request.headers[headerName]}`;
        if (i !== headers.length - 1) {
          result += `\n`;
        }
      }
    }
    return result;
  }

  getCurlRequestHeaders() {
    let result = ``;
    if (this.request.body) {
      result += ` \n-H 'Content-Length: ${JSON.stringify(this.request.body).length}' \\`;
    }
    if (this.request.headers) {
      let headers = Object.keys(this.request.headers);

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        result += `\n-H '${headerName}: ${this.request.headers[headerName]}' \\`;
      }
    }
    return result;
  }

  getRequestBody() {
    let body = ``;
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = JSON.stringify(this.request.body);
    }
    return body;
  }

  getCurlRequestBody() {
    let body = ``;
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = `\n-d ${JSON.stringify(this.request.body, null, 2).split('\n').join(' \\\n')}`;
    }
    return body;
  }

  getResponseHeaders(response) {
    let result = ``;
    if (response.body) {
      result += `Content-Length: ${JSON.stringify(response.body).length}\n`;
    }
    let gotContentType = false;
    if (response.headers) {
      let headers = Object.keys(response.headers);
      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        if (headerName.match(/^Content-Type$/ig) !== null) gotContentType = true;
        result += `${headerName}: ${response.headers[headerName]}`;
        if (i !== headers.length - 1) {
          result += `\n`;
        }
      }
    }
    if (!gotContentType) {
      result += `Content-Type: application/json; charset=utf-8`
    }
    return result;
  }

  getResponseBody(response) {
    let body = ``;
    if (response && response.body !== null && response.body !== undefined) {
      body = JSON.stringify(response.body);
    }
    return body;
  }

  populateRequest() {
    let requestTemplate =
      `## Request

\`\`\`http
${this.request.method} ${this.request.url} HTTP/1.1
Authorization: Bearer <token>
${this.getRequestHeaders()}
host: ${this.getHost()}
Connection: close

${this.getRequestBody()}
\`\`\`\

`;
    return requestTemplate;
  }

  populateResponse(response, responseType) {
    if (!responseType) responseType = 'Response';
    let responseGuid = uuid.v4();
    let responseTemplate = `
## ${responseType}

#### StatusCode: ${response.statusCode}

\`\`\`http
HTTP 1.1 ${response.statusCode}
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: ${responseGuid}
x-ms-correlation-request-id: ${responseGuid}
x-ms-routing-request-id: WESTUS2:${new Date().toISOString().replace(/(\W)/ig, '')}:${responseGuid}
Strict-Transport-Security: max-age=31536000; includeSubDomains
${this.getResponseHeaders(response)}
Date: ${new Date().toUTCString()}
Connection: close

${this.getResponseBody(response)}
\`\`\`
`;
    return responseTemplate;
  }

  populateCurl() {
    let template =
      `\n## Curl

\`\`\`bash
curl -X ${this.request.method} '${this.request.url}' \\\n-H 'authorization: bearer <token>' \\${this.getCurlRequestHeaders()}${this.getCurlRequestBody()}
\`\`\`
`;
    return template;
  }

  populate() {
    let template = ``;
    template += this.populateRequest();
    template += this.populateCurl();
    if (this.responses) {
      if (this.responses.longrunning) {
        if (this.responses.longrunning.initialResponse) {
          template += this.populateResponse(this.responses.longrunning.initialResponse, 'Initial Response');
        }
        if (this.responses.longrunning.finalResponse) {
          template += this.populateResponse(this.responses.longrunning.finalResponse, 'Final Response after polling is complete and successful')
        }
      } else {
        template += this.populateResponse(this.responses.standard.finalResponse, 'Response');
      }
    }
    return template;
  }
}

module.exports = HttpTemplate;