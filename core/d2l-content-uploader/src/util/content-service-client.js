import * as querystring from '@chaitin/querystring';
import auth from 'd2l-fetch-auth/src/unframed/index.js';
import { d2lfetch } from 'd2l-fetch/src/index.js';
import { parse } from './d2lrn';

d2lfetch.use({ name: 'auth', fn: auth });

export default class ContentServiceClient {
	constructor({
		endpoint,
		tenantId
	}) {
		this.endpoint = endpoint;
		this.tenantId = tenantId;
	}

	createContent(body) {
		return this._fetch({
			path: `/api/${this.tenantId}/content/`,
			method: 'POST',
			body: {
				...body,
				clientApp: 'LmsContent',
			},
		});
	}

	createRevision(contentId, body) {
		return this._fetch({
			path: `/api/${this.tenantId}/content/${contentId}/revisions`,
			method: 'POST',
			body
		});
	}

	deleteContent(contentId) {
		return this._fetch({
			path: `/api/${this.tenantId}/content/${contentId}`,
			method: 'DELETE',
			extractJsonBody: false
		});
	}

	getRevisionByName(d2lrn) {
		const { tenantId, contentId, revisionId } = parse(d2lrn);
		return this._fetch({
			path: `/api/${tenantId}/content/${contentId}/revisions/${revisionId}`,
		});
	}

	getSecureUrlByName(d2lrn) {
		const { tenantId, contentId, revisionId } = parse(d2lrn);
		return this._fetch({
			path: `/api/${tenantId}/content/${contentId}/revisions/${revisionId}/signed-url`,
		});
	}

	getSupportedMimeTypes() {
		return this._fetch({ path: '/api/conf/supported-mime-types' });
	}

	getWorkflowProgress({
		contentId,
		revisionId
	}) {
		const headers = new Headers();

		/* The global d2l-fetch instance defined by BSI injects d2l-fetch-simple-cache as a middleware.
		 * This middleware causes the browser to return cached responses for 2 minutes, regardless of whether
		 * the origin server (e.g. Content Service) sets 'cache-control: must-revalidate, max-age=0'  in the response.
		 *
		 * We don't want this behaviour when polling the progress endpoint, as it results in stale progress data.
		 *
		 * According to d2l-fetch-simple-cache's documentation, this behaviour can be disabled by including a
		 * 'cache-control: no-cache' header in the request.
		 */
		headers.append('cache-control', 'no-cache');

		return this._fetch({
			path: `/api/${this.tenantId}/content/${contentId}/revisions/${revisionId}/progress`,
			headers
		});
	}

	processRevision({
		contentId,
		revisionId,
		captionLanguages,
	}) {
		return this._fetch({
			path: `/api/${this.tenantId}/content/${contentId}/revisions/${revisionId}/process`,
			method: 'POST',
			...(captionLanguages && { body: { captionLanguages } })
		});
	}

	signUploadRequest({
		fileName,
		contentType,
		contentDisposition
	}) {
		return this._fetch({
			path: '/api/s3/sign',
			query: {
				fileName,
				contentType,
				contentDisposition
			}
		});
	}

	async _fetch({
		path,
		method = 'GET',
		query,
		body,
		extractJsonBody = true,
		headers = new Headers()
	}) {
		if (body) {
			headers.append('Content-Type', 'application/json');
		}

		const requestInit = {
			method,
			...body && {
				body: JSON.stringify(body)
			},
			headers
		};
		const request = new Request(this._url(path, query), requestInit);

		const response = await d2lfetch.fetch(request);
		if (!response.ok) {
			throw new Error(response.statusText);
		}

		if (extractJsonBody) {
			return response.json();
		}

		return response;
	}

	_url(path, query) {
		const qs = query ? `?${querystring.stringify(query)}` : '';
		return `${this.endpoint}${path}${qs}`;
	}
}
