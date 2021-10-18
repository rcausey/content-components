import SirenParse from 'siren-parser';
import * as querystring from '@chaitin/querystring';
import fetchAuthUnframed from 'd2l-fetch-auth/src/unframed/index.js';
import fetchAuthFramed from 'd2l-fetch-auth/es6/d2lfetch-auth-framed.js';
import { d2lfetch } from 'd2l-fetch/src/index.js';

export default class HypermediaClient {
	constructor({ entity, framed }) {
		this.entity = SirenParse(entity);
		this.framed = framed;
		if (this.framed) {
			this.d2lfetch = d2lfetch.addTemp({
				name: 'auth',
				fn: fetchAuthFramed
			});
		} else {
			this.d2lfetch = d2lfetch.addTemp({
				name: 'auth',
				fn: fetchAuthUnframed
			});
		}
	}

	async getCaptions(resourceEntity) {
		if (!resourceEntity.hasActionByName('get-tracks')) {
			return null;
		}
		const getTracksAction = resourceEntity.getActionByName('get-tracks');
		const getTracksResponse = await this._fetch({ url: getTracksAction.href });
		const tracksEntity =  SirenParse(getTracksResponse);
		const { tracks } = tracksEntity.properties;
		return tracks;
	}

	async getMedia(resourceEntity) {
		if (!resourceEntity.hasActionByName('get-media')) {
			return null;
		}
		const getMediaAction = resourceEntity.getActionByName('get-media');
		const formatField = getMediaAction.getFieldByName('format');
		const format = formatField.value[0].value;
		const url = `${getMediaAction.href}?format=${format}&attachment=false`;
		const getMediaResponse = await this._fetch({ url });
		const mediaEntity =  SirenParse(getMediaResponse);
		const { src, expires } = mediaEntity.properties;
		return { src, expires };
	}

	async getResourceEntity() {
		if (!this.entity.hasLinkByClass('content-service-resource')) {
			return null;
		}

		const { href } = this.entity.getLinkByClass('content-service-resource');
		const resourceResponse = await this._fetch({ url: href });
		const resourceEntity = SirenParse(resourceResponse);
		return resourceEntity;
	}

	async _fetch({
		url,
		method = 'GET',
		query,
		body,
		extractJsonBody = true,
		headers = new Headers(),
		doNotUseCache = true
	}) {

		if (body) {
			headers.append('Content-Type', 'application/json');
		}

		if (doNotUseCache) {
			headers.append('pragma', 'no-cache');
			headers.append('cache-control', 'no-cache');
		}

		const requestInit = {
			method,
			...body && {
				body: JSON.stringify(body)
			},
			headers
		};
		const request = new Request(this._url(url, query), requestInit);
		const response = await this.d2lfetch.fetch(request);
		if (!response.ok) {
			throw new Error(response.statusText);
		}

		if (extractJsonBody) {
			return response.json();
		}

		return response;
	}

	_url(url, query) {
		const qs = query ? `?${querystring.stringify(query)}` : '';
		return `${url}${qs}`;
	}
}
