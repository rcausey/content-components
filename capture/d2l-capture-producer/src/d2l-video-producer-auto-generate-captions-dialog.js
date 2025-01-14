import { css, html, LitElement } from 'lit-element/lit-element.js';
import '@brightspace-ui/core/components/button/button.js';
import '@brightspace-ui/core/components/dialog/dialog.js';
import './d2l-video-producer-language-selector.js';
import { bodyCompactStyles } from '@brightspace-ui/core/components/typography/styles.js';
import { InternalLocalizeMixin } from '../src/internal-localize-mixin.js';
import { RtlMixin } from '@brightspace-ui/core/mixins/rtl-mixin.js';

class AutoGenerateCaptionsDialog extends RtlMixin(InternalLocalizeMixin(LitElement)) {
	static get properties() {
		return {
			languages: { type: Array },
			opened: { type: Boolean },
			selectedLanguage: { type: Object },

			_spokenLanguage: { type: Object },
		};
	}

	static get styles() {
		return [ bodyCompactStyles, css`
			.d2l-video-producer-auto-generate-dialog-content {
				padding-bottom: 20px;
			}

			.d2l-video-producer-publish-warning {
				font-weight: bold;
			}
		`];
	}

	constructor() {
		super();
		this.languages = [];
		this._spokenLanguage = { name: '', code: '' };
	}

	render() {
		return html`
			<d2l-dialog
				.opened="${this.opened}"
				title-text="${this.localize('autoGenerateCaptions')}"
			>
				<div class="d2l-video-producer-auto-generate-dialog-content">
					<p class="d2l-body-compact">${this.localize('selectSpokenLanguage')}</p>
					<d2l-video-producer-language-selector
						.languages="${this.languages}"
						.selectedLanguage="${this._spokenLanguage}"
						@selected-language-changed="${this._handleSpokenLanguageChanged}"
					></d2l-video-producer-language-selector>
					<p class="d2l-body-compact">${this.localize('autoGenerateDescription')}</p>
					<p class="d2l-body-compact d2l-video-producer-publish-warning">${this.localize('publishWarning')}</p>
				</div>
				<d2l-button
					@click="${this._handleAutoGenerateClick}"
					data-dialog-action="Done"
					primary
					slot="footer"
				>${this.localize('autoGenerate')}</d2l-button>
				<d2l-button
					data-dialog-action
					slot="footer"
				>${this.localize('cancel')}</d2l-button>
			</d2l-dialog>
		`;
	}

	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has('selectedLanguage')) {
			// Keeps the dropdown's initial selection in-sync with the currently-selected language in Producer.
			this._spokenLanguage = this.selectedLanguage;
		}
	}

	_handleAutoGenerateClick() {
		this.dispatchEvent(new CustomEvent('captions-auto-generation-started', {
			detail: { language: this._spokenLanguage },
			bubbles: true,
			composed: true,
		}));
	}

	_handleDialogClosed() {
		this.dispatchEvent(new CustomEvent('auto-generate-dialog-closed'));
	}

	_handleSpokenLanguageChanged(event) {
		this._spokenLanguage = event.detail.selectedLanguage;
	}
}
customElements.define('d2l-video-producer-auto-generate-captions-dialog', AutoGenerateCaptionsDialog);
