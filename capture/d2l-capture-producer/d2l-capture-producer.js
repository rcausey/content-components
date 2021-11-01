import '@brightspace-ui/core/components/alert/alert-toast.js';
import '@brightspace-ui/core/components/button/button-icon.js';
import '@brightspace-ui/core/components/button/button.js';
import '@brightspace-ui/core/components/colors/colors.js';
import '@brightspace-ui/core/components/dialog/dialog-confirm.js';
import '@brightspace-ui/core/components/dropdown/dropdown-button-subtle.js';
import '@brightspace-ui/core/components/dropdown/dropdown-menu.js';
import './src/d2l-video-producer-language-selector.js';
import './d2l-capture-producer-editor.js';

import { css, html, LitElement } from 'lit-element/lit-element.js';
import { autorun } from 'mobx';
import ContentServiceClient from './src/content-service-client.js';
import { formatDateTimeFromTimestamp } from '@brightspace-ui/intl/lib/dateTime.js';
import { InternalLocalizeMixin } from './src/internal-localize-mixin.js';
import { bodyStandardStyles, labelStyles } from '@brightspace-ui/core/components/typography/styles.js';
import { RtlMixin } from '@brightspace-ui/core/mixins/rtl-mixin.js';
import { selectStyles } from '@brightspace-ui/core/components/inputs/input-select-styles.js';
import UserBrightspaceClient from './src/user-brightspace-client.js';
import { convertVttCueArrayToVttText } from './src/captions-utils.js';

class CaptureProducer extends RtlMixin(InternalLocalizeMixin(LitElement)) {
	static get properties() {
		return {
			contentId: { type: String, attribute: 'content-id' },
			endpoint: { type: String },
			tenantId: { type: String, attribute: 'tenant-id' },

			_alertMessage: { type: String, attribute: false },
			_captions: { type: Array, attribute: false },
			_captionsChanged: { type: Array, attribute: false },
			_captionsUrl: { type: String, attribute: false },
			_captionsLoading: { type: Boolean, attribute: false },
			_content: { type: String, attribute: false },
			_defaultLanguage: { type: Object, attribute: false },
			_errorOccurred: { type: Boolean, attribute: false },
			_finishing: { type: Boolean, attribute: false },
			_isProcessing: { type: Boolean, attribute: false },
			_languages: { type: Array, attribute: false },
			_loading: { type: Boolean, attribute: false },
			_languageToLoad: { type: Object, attribute: false },
			_metadata: { type: Object, attribute: false },
			_metadataChanged: { type: Boolean, attribute: false },
			_metadataLoading: { type: Boolean, attribute: false },
			_revisionIndexToLoad: { type: Number, attribute: false },
			_revisionsLatestToOldest: { type: Object, attribute: false },
			_saving: { type: Boolean, attribute: false },
			_selectedLanguage: { type: Object, attribute: false },
			_selectedRevisionIndex: { type: Number, attribute: false },
			_src: { type: String, attribute: false },
			_unsavedChanges: { type: String, attribute: false },
			_mediaLoaded: { type: Boolean, attribute: false },
		};
	}

	static get styles() {
		return [bodyStandardStyles, labelStyles, selectStyles, css`
			.d2l-video-producer-overlay {
				align-items: center;
				display: flex;
				flex-direction: column;
				height: 70%;
				justify-content: center;
				overflow-y: hidden;
				position: absolute;
				width: 100%;
				z-index: 99;
			}

			.d2l-video-producer-processing-message {
				text-align: center;
			}

			.d2l-video-producer-top-bar-controls {
				align-items: center;
				display: flex;
				justify-content: flex-end;
				margin-bottom: 15px;
			}

			d2l-video-producer-language-selector {
				margin-right: auto;
			}

			.d2l-video-producer-saved-unsaved-indicator-container {
				align-items: center;
				display: flex;
				flex-direction: row;
				margin-right: 15px;
			}

			.d2l-video-producer-saved-unsaved-indicator-icon {
				margin-left: 5px;
			}

			.d2l-video-producer-controls-revision-dropdown {
				margin-right: 10px;
			}

			.d2l-video-producer-controls-publish-button {
				margin-left: 10px;
			}

			.d2l-video-producer-controls-publish-button .d2l-video-producer-controls-finishing {
				display: flex;
				align-items: center;
			}

			.d2l-video-producer-controls-publish-button d2l-loading-spinner {
				margin-right: 5px;
			}

			.d2l-video-producer-controls-save-button .d2l-video-producer-controls-saving {
				display: flex;
				align-items: center;
			}

			.d2l-video-producer-controls-save-button d2l-loading-spinner {
				margin-right: 5px;
			}
		`];
	}

	static get content() {
		return this._content;
	}

	constructor() {
		super();

		this._isProcessing = false;
		this._selectedRevisionIndex = 0;
		this._revisionIndexToLoad = 0;

		this._alertMessage = '';
		this._errorOccurred = false;

		this._captions = [];
		this._captionsChanged = false;
		this._captionsUrl = '';
		this._captionsLoading = true;

		this._metadata = { cuts: [], chapters: [] };
		this._metadataChanged = false;
		this._metadataLoading = true;
		this._src = '';
		this._defaultLanguage = {};
		this._languages = [];
		this._selectedLanguage = {};
		this._languageToLoad = {};
		this._mediaLoaded = false;
	}

	async connectedCallback() {
		super.connectedCallback();

		this.apiClient = new ContentServiceClient({
			endpoint: this.endpoint,
			tenantId: this.tenantId
		});
		this.userBrightspaceClient = new UserBrightspaceClient();

		autorun(async() => {
			await this._loadAllDataForContent();
		});
	}

	render() {
		return html`
			<div class="d2l-video-producer">
				${(this._loading && !this._isProcessing) ? html`<div class="d2l-video-producer-overlay"><d2l-loading-spinner size=150></d2l-loading-spinner></div>` : ''}
				${this._isProcessing ? this._renderProcessingMessage() : ''}
				<div class="d2l-video-producer-top-bar-controls" style="visibility: ${(this._loading || this._isProcessing) ? 'hidden' : 'visible'};">
					<d2l-video-producer-language-selector
						?disabled="${this._saving || this._finishing}"
						.languages="${this._languages}"
						.selectedLanguage="${this._selectedLanguage}"
						@selected-language-changed="${this._handleSelectedLanguageChanged}"
					></d2l-video-producer-language-selector>
					${this._renderSavedUnsavedIndicator()}
					<d2l-dropdown-button-subtle
						class="d2l-video-producer-controls-revision-dropdown"
						?disabled="${this._saving || this._finishing}"
						text="${this._revisionsLatestToOldest?.length > 0 ? this._getLabelForRevision(this._selectedRevisionIndex) : this.localize('loadingRevisions') }"
					>
						<d2l-dropdown-menu
							@d2l-menu-item-select="${this._handleSelectedRevisionChanged}"
						>
							<d2l-menu label="${this.localize('revisions')}">
								${this._renderRevisionsDropdownItems()}
							</d2l-menu>
						</d2l-dropdown-menu>
					</d2l-dropdown-button-subtle>
					<d2l-button
						class="d2l-video-producer-controls-save-button"
						@click="${this._handleSave}"
						?disabled="${this._saveIsDisabled}"
						text="${this.localize('saveDraft')}"
					>
						<div class="d2l-video-producer-controls-saving" style="${!this._saving ? 'display: none' : ''}">
							<d2l-loading-spinner size="20"></d2l-loading-spinner>
							${this.localize('saving')}
						</div>
						<div ?hidden="${this._saving}">
							${this.localize('saveDraft')}
						</div>
					</d2l-button>
					<d2l-button
						?disabled="${this._finishIsDisabled}"
						@click="${this._handleFinish}"
						class="d2l-video-producer-controls-publish-button"
						primary
					><div class="d2l-video-producer-controls-finishing" style="${!this._finishing ? 'display: none' : ''}">
							<d2l-loading-spinner size="20"></d2l-loading-spinner>
							${this.localize('finishing')}
						</div>
						<div ?hidden="${this._finishing}">
							${this.localize('finish')}
						</div>
					</d2l-button>
				</div>
				<d2l-capture-producer-editor
					.captions="${this._captions}"
					@captions-auto-generation-started="${this._handleCaptionsAutoGenerationStarted}"
					@captions-changed="${this._handleCaptionsChanged}"
					@captions-edited="${this._handleCaptionsEdited}"
					?captions-loading="${this._captionsLoading}"
					.captionsUrl="${this._captionsUrl}"
					@captions-url-changed="${this._handleCaptionsUrlChanged}"
					?enableCutsAndChapters="${this._enableCutsAndChapters}"
					.defaultLanguage="${this._defaultLanguage}"
					.isProcessing="${this._isProcessing}"
					.languages="${this._languages}"
					@media-loaded="${this._handleMediaLoaded}"
					.metadata="${this._metadata}"
					@metadata-changed="${this._handleMetadataChanged}"
					?metadata-loading="${this._metadataLoading}"
					.selectedLanguage="${this._selectedLanguage}"
					.src="${this._src}"
					style="visibility: ${(this._loading || this._isProcessing) ? 'hidden' : 'visible'};"
				></d2l-capture-producer-editor>
				<d2l-alert-toast type="${this._errorOccurred ? 'error' : 'default'}">
					${this._alertMessage}
				</d2l-alert-toast>
				<d2l-dialog-confirm
					class="d2l-video-producer-dialog-confirm-copy-from-revision"
					text="${this.localize('confirmLoadRevisionWithUnsavedChanges')}"
				>
					<d2l-button
						@click="${this._loadNewlySelectedRevision}"
						data-dialog-action="yes"
						slot="footer"
					>
						${this.localize('yes')}
					</d2l-button>
					<d2l-button
						data-dialog-action="no"
						primary
						slot="footer"
					>
						${this.localize('no')}
					</d2l-button>
				</d2l-dialog-confirm>
				<d2l-dialog-confirm
					class="d2l-video-producer-dialog-confirm-change-language"
					text="${this.localize('confirmChangeLanguageWithUnsavedCaptionsChanges')}"
				>
					<d2l-button
						@click="${this._loadNewlySelectedLanguage}"
						data-dialog-action="yes"
						slot="footer"
					>
						${this.localize('yes')}
					</d2l-button>
					<d2l-button
						data-dialog-action="no"
						primary
						slot="footer"
					>
						${this.localize('no')}
					</d2l-button>
				</d2l-dialog-confirm>
				<d2l-dialog-confirm
					class="d2l-video-producer-dialog-confirm-finish"
					title-text="${this.localize('confirmFinish')}"
					text="${this.localize('publishWarning')}"
				>
					<d2l-button
						@click="${this._handleConfirmFinish}"
						data-dialog-action="yes"
						primary
						slot="footer"
					>
						${this.localize('finish')}
					</d2l-button>
					<d2l-button
						data-dialog-action="no"
						slot="footer"
					>
						${this.localize('cancel')}
					</d2l-button>
				</d2l-dialog-confirm>
			</div>
		`;
	}

	async _createNewDraftRevision() {
		return await this.apiClient.createRevision({
			contentId: this._content.id,
			body: {
				extension: this._selectedRevision.extension,
				sourceFormat: 'hd',
				formats: ['ld'],
			},
			draftFromSource: this._selectedRevision.id,
		});
	}

	get _enableCutsAndChapters() {
		// Add more content types to this array when they support cuts and chapters.
		return ['Video'].includes(this._selectedRevision?.type);
	}

	get _finishIsDisabled() {
		return (
			// Disable if content is not yet loaded.
			!this._content ||
			// Disable if the latest revision is currently selected, it is not a draft, and there are no unsaved changes.
			// (Because publishing would create a duplicate revision with no changes from the previous one.)
			(this._selectedRevisionIndex === 0 && !this._selectedRevision.draft && !this._unsavedChanges) ||
			// Disable if we are currently loading or saving data.
			this._saving || this._finishing || this._metadataLoading || this._captionsLoading
		);
	}

	async _finishRevision(autoGenerateCaptionsLanguage) {
		this._finishing = true;

		let draftToPublish;
		if (!this._latestDraftRevision || this._selectedRevisionIndex !== 0) {
			try {
				draftToPublish = await this._createNewDraftRevision();
			} catch (error) {
				this._errorOccurred = true;
				this._alertMessage = this.localize('finishError');
				this.shadowRoot.querySelector('d2l-alert-toast').open = true;
				this._finishing = false;
				return;
			}
		} else {
			draftToPublish = this._latestDraftRevision;
		}

		if (this._unsavedChanges) {
			if (this._enableCutsAndChapters) {
				await this.apiClient.updateMetadata({
					contentId: this._content.id,
					metadata: this._metadata,
					revisionId: draftToPublish.id,
				});
				this._metadataChanged = false;
			}
			await this.apiClient.updateCaptions({
				contentId: this._content.id,
				captionsVttText: convertVttCueArrayToVttText(this._captions),
				revisionId: draftToPublish.id,
				locale: this._selectedLanguage.code
			});
			this._captionsChanged = false;
		}

		try {
			await this.apiClient.processRevision({
				contentId: this._content.id,
				revisionId: draftToPublish.id,
				captionLanguages: autoGenerateCaptionsLanguage ? [autoGenerateCaptionsLanguage.code] : undefined,
			});
			this._isProcessing = true;
			this._loadAllDataForContent();
		} catch (error) {
			this._errorOccurred = true;
		}
		this._alertMessage = this._errorOccurred
			? this.localize('finishError')
			: this.localize('finishSuccess');
		this.shadowRoot.querySelector('d2l-alert-toast').open = true;
		this._finishing = false;
	}

	_fireContentLoadedEvent(content) {
		this.dispatchEvent(new CustomEvent(
			'content-loaded',
			{
				composed: false,
				detail: { content }
			}
		));
	}

	_formatCaptionsSrcLang() {
		// Some of the 5-character language codes we receive from the D2L locales endpoint are all lowercase, e.g. "en-us".
		// We need to convert them to mixed case ("en-US") in order to match the spec for <track> element's "srclang" attribute.
		// If the format is incorrect, <track> will not process the captions into cue objects.
		if (this._selectedLanguage.code.length === 5) {
			return `${this._selectedLanguage.code.slice(0, 2)}-${this._selectedLanguage.code.slice(3).toUpperCase()}`;
		}
		return this._selectedLanguage.code;
	}

	_getLabelForRevision(revisionIndex) {
		if (!this._revisionsLatestToOldest) {
			return '';
		}
		const revision = this._revisionsLatestToOldest[revisionIndex];

		// 'createdAt' was added to revisions' schema in Oct 2021, so older revisions may not have it.
		if (revision.createdAt) {
			const timestamp = formatDateTimeFromTimestamp(Date.parse(revision.createdAt), { format: 'medium' });
			return this.localize(revision.draft ? 'revisionTimestampDraft' : 'revisionTimestamp', { timestamp });
		} else {
			const revisionNumber = this._revisionsLatestToOldest.length - revisionIndex;
			return this.localize(revision.draft ? 'revisionNumberDraft' : 'revisionNumber', { number: revisionNumber });
		}
	}

	_handleCaptionsAutoGenerationStarted(event) {
		this._finishRevision(event.detail.language);
	}

	_handleCaptionsChanged(event) {
		this._captions = event.detail.captions;
		if (!this._captionsLoading) {
			this._captionsChanged = true;
		}
		this._captionsLoading = false;
	}

	_handleCaptionsEdited() {
		if (!this._captionsLoading) {
			this._captionsChanged = true;
		}
	}

	_handleCaptionsUrlChanged(event) {
		this._captionsLoading = true;
		// Media Player's onSlotChange might not execute if the <track> slot's attributes change.
		// To force it to execute, we need to temporarily remove the slot and re-add it.
		// In D2LVideoProducerEditor.render(), we hide the <track> slot when captionsUrl is falsy.
		this._captionsUrl = '';
		setTimeout(() => {
			this._captionsUrl = event.detail.captionsUrl;
			this._captionsChanged = true;
		}, 0);
	}

	_handleChaptersChanged(e) {
		this._metadata = { ...this._metadata, chapters: e.detail.chapters };
		this._metadataChanged = true;
	}

	_handleConfirmFinish() {
		this._finishRevision();
	}

	_handleFinish() {
		this.shadowRoot.querySelector('.d2l-video-producer-dialog-confirm-finish').open();
	}

	_handleMediaLoaded() {
		this._mediaLoaded = true;
	}

	_handleMetadataChanged(event) {
		this._metadata = event.detail;
		if (!this._metadataLoading) {
			this._metadataChanged = true;
		}
		this._metadataLoading = false;
	}

	async _handleSave() {
		this._saving = true;

		if (!this._latestDraftRevision || this._selectedRevisionIndex !== 0) {
			try {
				await this._createNewDraftRevision();
				await this._loadRevisionsList();
				this._selectedRevisionIndex = 0;
			} catch (error) {
				this._errorOccurred = true;
				this._alertMessage = this.localize('saveError');
				this._saving = false;
				return;
			}
		}

		try {
			if (this._enableCutsAndChapters) {
				await this.apiClient.updateMetadata({
					contentId: this._content.id,
					metadata: this._metadata,
					revisionId: this._latestDraftRevision.id,
				});
				this._metadataChanged = false;
			}
			await this.apiClient.updateCaptions({
				contentId: this._content.id,
				captionsVttText: convertVttCueArrayToVttText(this._captions),
				revisionId: this._latestDraftRevision.id,
				locale: this._selectedLanguage.code
			});
			this._captionsChanged = false;
		} catch (error) {
			this._errorOccurred = true;
		}
		this._alertMessage = this._errorOccurred
			? this.localize('saveError')
			: this.localize('saveSuccess');
		this.shadowRoot.querySelector('d2l-alert-toast').open = true;
		this._saving = false;
	}

	_handleSelectedLanguageChanged(e) {
		this._languageToLoad = e.detail.selectedLanguage;
		if (this._captionsChanged) {
			this.shadowRoot.querySelector('.d2l-video-producer-dialog-confirm-change-language').open();
		} else {
			this._loadNewlySelectedLanguage();
		}
	}

	async _handleSelectedRevisionChanged(e) {
		const newlySelectedRevisionIndex = Number.parseInt(e.target.dataset.revisionIndex);
		this._revisionIndexToLoad = newlySelectedRevisionIndex;
		if (this._unsavedChanges) {
			this.shadowRoot.querySelector('.d2l-video-producer-dialog-confirm-copy-from-revision').open();
		} else {
			this._loadNewlySelectedRevision();
		}
	}

	get _latestDraftRevision() {
		return this._revisionsLatestToOldest?.find(x => x.draft);
	}

	async _loadAllDataForContent() {
		this._captionsLoading = true;
		this._metadataLoading = true;
		this._src = '';

		this._content = await this.apiClient.getContent(this.contentId);
		this._fireContentLoadedEvent(this._content);

		if (this._content.revisions) {
			this._revisionsLatestToOldest = this._content.revisions.slice().reverse();

			const latestRevision = this._content.revisions[this._content.revisions.length - 1];
			if (!latestRevision.draft) {
				try {
					const latestRevisionProgress = await this.apiClient.getRevisionProgress({
						contentId: this.contentId,
						revisionId: latestRevision.id,
					});
					if (!latestRevisionProgress.ready) {
						this._isProcessing = true;
						await this._pollUntilProcessingComplete(latestRevision.id);
						this._isProcessing = false;
					}
				} catch (error) {
					this._loading = true;
					this._alertMessage = this.localize('getProcessingProgressError');
					this.shadowRoot.querySelector('d2l-alert-toast').open = true;
					return;
				}
			}
		}

		this._src = (await this.apiClient.getSignedUrl(this.contentId)).value;
		await this._setupLanguages();
		if (this._enableCutsAndChapters) {
			this._loadMetadata(this._revisionsLatestToOldest[0].id);
		} else {
			this._metadataLoading = false;
		}
		this._loadCaptions(this._revisionsLatestToOldest[0].id, this._selectedLanguage.code);
	}

	async _loadCaptions(revision, locale) {
		this._captionsLoading = true;
		this._captionsUrl = '';
		try {
			const res = await this.apiClient.getCaptionsUrl({
				contentId: this._content.id,
				revisionId: revision,
				locale,
				draft: true,
			});
			this._captionsUrl = res.captionsUrl;
		} catch (error) {
			if (error.message === 'Not Found') {
				this._captions = [];
				this._captionsLoading = false;
			} else {
				const language = this._languages.find(lang => lang.code === locale);
				this._alertMessage = this.localize('loadCaptionsError', { language: language.name });
				this.shadowRoot.querySelector('d2l-alert-toast').open = true;
			}
		}
	}

	get _loading() {
		return !(
			this._mediaLoaded
			&& this._selectedLanguage
			&& this._selectedLanguage.code
		);
	}

	async _loadMetadata(revisionId) {
		this._metadataLoading = true;
		try {
			this._metadata = await this.apiClient.getMetadata({
				contentId: this._content.id,
				revisionId,
				draft: true
			});
			this._metadataLoading = false;
		} catch (error) {
			if (error.message === 'Not Found') {
				this._metadata = { chapters: [], cuts: [] };
				this._metadataLoading = false;
			} else {
				this._errorOccurred = true;
				this._alertMessage = this.localize('loadMetadataError');
				this.shadowRoot.querySelector('d2l-alert-toast').open = true;
			}
		}
	}

	async _loadNewlySelectedLanguage() {
		this._loadCaptions(this._selectedRevision.id, this._languageToLoad.code)
			.then(() => {
				this._captionsChanged = false;
			});
		this._selectedLanguage = Object.assign({}, this._languageToLoad);
		this._languageToLoad = {};
	}

	async _loadNewlySelectedRevision() {
		const revisionId = this._revisionsLatestToOldest[this._revisionIndexToLoad].id;
		if (this._enableCutsAndChapters) this._loadMetadata(revisionId);
		this._loadCaptions(revisionId, this._selectedLanguage.code);
		this._selectedRevisionIndex = this._revisionIndexToLoad;
		this._captionsChanged = false;
		this._metadataChanged = false;
	}

	async _loadRevisionsList() {
		this._content = await this.apiClient.getContent(this.contentId);
		this._fireContentLoadedEvent(this._content);
		if (this._content.revisions) {
			this._revisionsLatestToOldest = this._content.revisions.slice().reverse();
		}
	}

	async _pollUntilProcessingComplete(revisionId) {
		const _pollProgress = resolve => {
			setTimeout(() => {
				this.apiClient.getRevisionProgress({ contentId: this.contentId, revisionId })
					.then(revisionProgress => {
						if (revisionProgress.ready) {
							resolve();
						} else {
							_pollProgress(resolve);
						}
					});
			}, 3000);
		};
		return new Promise(resolve => {
			_pollProgress(resolve);
		});
	}

	_renderProcessingMessage() {
		return html`
			<div class="d2l-video-producer-overlay">
				<d2l-loading-spinner size=100></d2l-loading-spinner>
				<p class="d2l-body-standard d2l-video-producer-processing-message">${this.localize('mediaFileProcessing')}</p>
			</div>
		`;
	}

	_renderRevisionsDropdownItems() {
		if (this._revisionsLatestToOldest) {
			return this._revisionsLatestToOldest.map((revision, index) => {
				const label = this._getLabelForRevision(index);
				return html`<d2l-menu-item data-revision-index="${index}" text="${label}"></d2l-menu-item>`;
			});
		} else {
			return '';
		}
	}

	_renderSavedUnsavedIndicator() {
		let feedbackColor = 'var(--d2l-color-feedback-success)';
		let icon = 'tier1:check-circle';
		let langterm = 'saved';
		if (this._unsavedChanges) {
			feedbackColor = 'var(--d2l-color-feedback-warning)';
			icon = 'tier1:alert';
			langterm = 'unsaved';
		}
		return html`
		  <div class="d2l-video-producer-saved-unsaved-indicator-container">
			<p class="d2l-label-text" style="color: ${feedbackColor};">
				${this.localize(langterm)}
			</p>
			<d2l-icon class="d2l-video-producer-saved-unsaved-indicator-icon" icon="${icon}" style="color: ${feedbackColor};"></d2l-icon>
		  </div>`;
	}

	get _saveIsDisabled() {
		return (
			// Disable if content is not yet loaded.
			!this._content ||
			// Disable if the latest draft is loaded and there are no unsaved changes.
			// (If a non-draft revision is loaded, we always allow the user to Save Draft,
			// because they may want to copy the revision's data into a new draft but make changes at a later time.)
			((this._selectedRevisionIndex === 0) && this._selectedRevision.draft && !this._unsavedChanges) ||
			// Disable if we are currently loading/saving data.
			this._saving || this._finishing || this._metadataLoading || this._captionsLoading
		);
	}

	get _selectedRevision() {
		return this._revisionsLatestToOldest ? this._revisionsLatestToOldest[this._selectedRevisionIndex] : undefined;
	}

	async _setupLanguages() {
		const { Items } = await this.userBrightspaceClient.getLocales();
		this._languages = Items.map(({ LocaleName, CultureCode, IsDefault }) => {
			const code = CultureCode.toLowerCase();
			return { name: LocaleName, code, isDefault: IsDefault  };
		});
		this._selectedLanguage = this._languages.find(language => language.isDefault);
		this._defaultLanguage = this._selectedLanguage;
	}

	get _unsavedChanges() {
		return this._captionsChanged || this._metadataChanged;
	}
}
customElements.define('d2l-capture-producer', CaptureProducer);
