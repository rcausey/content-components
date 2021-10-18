import '@brightspace-ui-labs/media-player/media-player.js';
import { css, html, LitElement } from 'lit-element/lit-element.js';

import ContentServiceClient from './clients/content-service-client.js';
import HypermediaClient from './clients/hypermedia-client.js';

const TRACK_ERROR_FETCH_INTERVAL_MILLISECONDS = 5000;

class ContentViewer extends LitElement {
	static get properties() {
		return {
			href: { type: String, attribute: 'href' },
			captionsHref: { type: String, attribute: 'captions-href' },
			activity: { type: String, attribute: 'activity' },
			allowDownload: { type: Boolean, attribute: 'allow-download'},
			allowDownloadOnError: { type: Boolean, attribute: 'allow-download-on-error' },
			framed: { type: Boolean, value: false, attribute: 'framed' },
			_captionSignedUrls: { type: Array, attribtue: false }
		};
	}

	static get styles() {
		return css`
			:host {
				display: inline-block;
				width: 100%;
			}
			:host([hidden]) {
				display: none;
			}
		`;
	}

	constructor() {
		super();
		this._resourceEntity = null;
		this._captionSignedUrls = [];
		this._captionsSignedUrlStartTime = null;
		this._lastTrackLoadFailedTime = null;
		this._trackErrorFetchTimeoutId = null;
	}

	async firstUpdated() {
		super.firstUpdated();
		if (this.activity) {
			this.hmClient = new HypermediaClient({
				entity: this.activity,
				framed: this.framed
			});
			this._resourceEntity = await this.hmClient.getResourceEntity();
		} else {
			this.client = new ContentServiceClient({
				href: this.href,
				captionsHref: this.captionsHref,
			});
		}
		await this.loadContent();
		await this.loadCaptions();

		this.dispatchEvent(new CustomEvent('cs-content-loaded', {
			bubbles: true,
			composed: true,
		}));
	}

	render() {
		return this._signedUrl && html`
			<d2l-labs-media-player
				src="${this._signedUrl}"
				crossorigin="anonymous"
				@trackloadfailed=${this.trackLoadFailedHandler}
				@tracksmenuitemchanged=${this.tracksChangedHandler}
				?allow-download=${this.allowDownload}
				?allow-download-on-error=${this.allowDownloadOnError}>
				${this._captionSignedUrls.map(captionSignedUrl => html`
					<track src="${captionSignedUrl.Value}" kind="captions" label=${captionSignedUrl.Locale} srclang=${captionSignedUrl.Locale.slice(0, 2)}>
				`)}
			</d2l-labs-media-player>
		`;
	}

	async loadCaptions() {
		clearInterval(this._trackErrorFetchTimeoutId);
		this._trackErrorFetchTimeoutId = null;

		let captionSignedUrls;
		if (this.activity) {
			captionSignedUrls = await this.hmClient.getCaptions(this._resourceEntity);
		} else {
			captionSignedUrls = await this.client.getCaptions();
		}

		if (captionSignedUrls) {
			// This forces a slot change event for the media player so it can render the new captions
			this._captionSignedUrls = [];
			this.requestUpdate();
			await this.updateComplete;

			this._captionSignedUrls = captionSignedUrls;
			this._captionsSignedUrlStartTime = (new Date()).getTime();
			this._captionsSignedUrlExpireTime = ((this._captionSignedUrls.length && this._captionSignedUrls[0].ExpireTime) || 0) * 1000;
			this.requestUpdate();
		}
	}

	async loadContent() {
		if (this.activity) {
			const { src, expires } = await this.hmClient.getMedia(this._resourceEntity);
			this._signedUrl = src;
			this._expires = expires;
		} else {
			const { Value, ExpireTime } = await this.client.getDownloadUrl();
			this._expires = ExpireTime;
			this._signedUrl = Value;
		}
		this.requestUpdate();
	}

	async trackLoadFailedHandler() {
		const elapsedTimeSinceLastLoadCaptions = (new Date()).getTime() - (this._lastTrackLoadFailedTime || 0);
		const trackErrorFetchIntervalElapsed = elapsedTimeSinceLastLoadCaptions > TRACK_ERROR_FETCH_INTERVAL_MILLISECONDS;

		if (trackErrorFetchIntervalElapsed && !this._trackErrorFetchTimeoutId) {
			this._lastTrackLoadFailedTime = (new Date()).getTime();
			await this.loadCaptions();
		} else if (!trackErrorFetchIntervalElapsed && !this._trackErrorFetchTimeoutId) {
			this._lastTrackLoadFailedTime = (new Date()).getTime();
			this._trackErrorFetchTimeoutId = setTimeout(this.loadCaptions.bind(this), TRACK_ERROR_FETCH_INTERVAL_MILLISECONDS);
		}
	}

	async tracksChangedHandler() {
		const elapsedTimeSinceLoadCaptions = (new Date()).getTime() - this._captionsSignedUrlStartTime;
		if (elapsedTimeSinceLoadCaptions > this._captionsSignedUrlExpireTime) {
			await this.loadCaptions();
		}
	}
}
customElements.define('d2l-content-viewer', ContentViewer);
