import '@brightspace-ui/core/components/button/button-icon.js';
import '@brightspace-ui/core/components/inputs/input-text.js';
import '@brightspace-ui-labs/media-player/media-player.js';
import { css, html, LitElement } from 'lit-element';
import { bodyCompactStyles } from '@brightspace-ui/core/components/typography/styles.js';
import { RequesterMixin } from '@brightspace-ui/core/mixins/provider-mixin.js';
import { formatFileSize } from '@brightspace-ui/intl/lib/fileSize.js';
import { MobxReactionUpdate } from '@adobe/lit-mobx';
import { InternalLocalizeMixin } from '../mixins/internal-localize-mixin';

export class Preview extends MobxReactionUpdate(RequesterMixin(InternalLocalizeMixin(LitElement))) {
	static get properties() {
		return {
			fileName: { type: String, attribute: 'file-name', reflect: true },
			fileSize: { type: String, attribute: 'file-size', reflect: true },
			fileType: { type: String, attribute: 'file-type', reflect: true },
			resource: { type: String, attribute: true },
			_mediaSources: { type: Array, attribute: false },
		};
	}

	static get styles() {
		return [bodyCompactStyles, css`
			#container {
				display: flex;
				flex-direction: column;
				align-items: center;
			}
			#staged-file {
				display: table;
				margin: 0 auto;
			}
			#staged-file > * {
				margin: 3px;
				display: inline-block;
			}
			#file-details {
				font-weight: 600;
				word-break: break-word;
				overflow-wrap: break-word;
			}
		`];
	}

	constructor() {
		super();
		this.contentTitle = '';
		this.fileName = '';
		this.fileSize = 0;
		this.fileType = '';
		this._mediaSources = null;
	}

	async connectedCallback() {
		super.connectedCallback();
		const formats = this._isAudio() ? ['mp3'] : ['hd', 'sd'];
		this._mediaSources = this.resource ?
			await Promise.all(formats.map(format => this._getSource(this.resource, format))) :
			null;
	}

	render() {
		const fileSize = this._fileSize ? ` (${formatFileSize(this.fileSize)})` : '';
		const icon = this._isAudio() ? 'tier1:file-audio' : 'tier1:file-video';
		const player = this._mediaSources && html`
		<d2l-labs-media-player style="width:100%">${this._mediaSources.map(mediaSource => this._renderSource(mediaSource))}</d2l-labs-media-player>`;
		return html`
			<div id="container">
				<div id="staged-file">
					<d2l-icon icon=${icon}></d2l-icon>
					<p id="file-details" class="d2l-body-compact">${this.fileName}${fileSize}</p>
					<d2l-button-icon
						id="change-file-button"
						aria-expanded="false"
						aria-haspopup="false"
						aria-label=${this.localize('changeFile')}
						text="${this.localize('remove')} ${this.fileName}"
						icon="tier1:close-default"
						@click=${this.onChangeFileClick}>
					</d2l-button-icon>
				</div>
				${player}
			</div>
		`;
	}

	onChangeFileClick() {
		this.dispatchEvent(new CustomEvent('cancel', {
			bubbles: true,
			composed: true
		}));
	}

	async _getSource(resourceUrn, format) {
		const client = this.requestInstance('content-service-client');
		return {
			src: (await client.getSecureUrlByName(resourceUrn, format)).value,
			format
		};
	}

	_isAudio() {
		return this.fileType.startsWith('audio');
	}

	_renderSource(source) {
		return html`<source src=${source.src} label=${this.localize(`format${source.format.toUpperCase()}`)} ?default=${source.format === 'hd'}>`;
	}
}

customElements.define('d2l-content-uploader-preview', Preview);
