import '@brightspace-ui/core/components/alert/alert-toast.js';
import '@brightspace-ui/core/components/button/button-icon.js';
import '@brightspace-ui/core/components/button/button-subtle.js';
import '@brightspace-ui/core/components/colors/colors.js';
import '@brightspace-ui/core/components/inputs/input-text.js';
import { formatFileSize } from '@brightspace-ui/intl/lib/fileSize.js';
import { css, html, LitElement } from 'lit-element/lit-element.js';
import { inputStyles } from '@brightspace-ui/core/components/inputs/input-styles.js';
import { InternalLocalizeMixin } from './internal-localize-mixin.js';
import { labelStyles, bodyStandardStyles } from '@brightspace-ui/core/components/typography/styles.js';
import { formatTimestampText, convertSrtTextToVttText }  from './captions-utils.js';
import constants from './constants.js';
import './d2l-video-producer-auto-generate-captions-dialog';

class CaptionsCueListItem extends InternalLocalizeMixin(LitElement) {
	static get properties() {
		return {
			active: { type: Boolean },
			cue: { type: Object },
			expanded: { type: Boolean },
		};
	}

	static get styles() {
		return [ bodyStandardStyles, inputStyles, labelStyles, css`
			.d2l-video-producer-captions-cues-list-item {
				border: 2px solid var(--d2l-color-gypsum);
				background-color: var(--d2l-color-gypsum);
				border-radius: var(--d2l-input-border-radius, 0.3rem);
				display: flex;
				flex-direction: column;
				margin-bottom: 15px;
				padding: 10px;
			}

			.d2l-video-producer-captions-cues-list-item-active {
				background-color: var(--d2l-color-gypsum);
				border: 2px solid var(--d2l-color-primary-accent-action);
				border-radius: var(--d2l-input-border-radius, 0.3rem);
				display: flex;
				flex-direction: column;
				margin-bottom: 15px;
				padding: 10px;
			}

			.d2l-video-producer-captions-cue-main-controls {
				align-items: center;
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				width: 100%;
			}

			.d2l-video-producer-captions-cue-text-input {
				margin-bottom: 10px;
				margin-top: 12px;
				width: 100%;
				/* Disable word wrap and preserve line breaks from uploaded files */
				overflow: auto;
				resize: none;
				white-space: pre;
				/* This is needed to make "white-space: pre;" work on Safari */
				word-wrap: normal;
			}

			.d2l-video-producer-captions-cue-main-controls-buttons {
				align-items: center;
				display: flex;
				flex-direction: column;
			}

			.d2l-video-producer-captions-cue-expanded-controls {
				align-items: flex-end;
				display: flex;
				flex-direction: row;
			}

			.d2l-video-producer-captions-cue-start-end-container {
				align-items: center;
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				width: 100%;
			}

			.d2l-video-producer-captions-cue-timestamp-container {
				align-items: center;
				display: flex;
				flex-direction: column;
			}

			.d2l-video-producer-sync-cue-button-anchor {
				height: 0;
				position: relative;
				width: 0;
			}

			.d2l-video-producer-sync-cue-button {
				left: 35px;
				position: absolute;
				top: -10px;
			}

			.d2l-video-producer-captions-cue-timestamp-container > d2l-input-text {
				width: 135px;
			}
		` ];
	}

	constructor() {
		super();
		this.active = false;
		this.cue = { startTime: 0, endTime: 0, text: '' };
		this.expanded = false;
	}

	render() {
		return html`
			<div
				class="d2l-video-producer-captions-cues-list-item${this.active ? '-active' : ''}"
			>
				${this._renderMainControls()}
				${this.expanded ? this._renderExpandedControls() : ''}
			</div>
		`;
	}

	get endTime() {
		return this.cue?.endTime;
	}

	get startTime() {
		return this.cue?.startTime;
	}

	_handleDeleteClicked() {
		this.dispatchEvent(new CustomEvent('captions-cue-deleted', {
			detail: { cue: this.cue },
			bubbles: true,
			composed: true,
		}));
	}

	_handleFocus() {
		this._jumpToCueStartTime();
	}

	_handleSyncEndTimestampClicked() {
		this.dispatchEvent(new CustomEvent('captions-cue-end-timestamp-synced', {
			detail: { cue: this.cue },
			bubbles: true,
			composed: true,
		}));
	}

	_handleSyncStartTimestampClicked() {
		this.dispatchEvent(new CustomEvent('captions-cue-start-timestamp-synced', {
			detail: { cue: this.cue },
			bubbles: true,
			composed: true,
		}));
	}

	_handleTextInput(event) {
		this.cue.text = event.target.value;
		this._jumpToCueStartTime();
		this.dispatchEvent(new CustomEvent('captions-edited', {
			bubbles: true,
			composed: true,
		}));
	}

	_hideExpandedControls() {
		this.expanded = false;
	}

	_jumpToCueStartTime() {
		this.dispatchEvent(new CustomEvent('media-player-time-jumped', {
			// In Chrome, if a cue's start time overlaps with a cue's end time exactly,
			// (e.g. cueA.endTime = 3.000, cueB.startTime = 3.000)
			// the displayed captions text will flicker back-and-forth between them.
			// To prevent that flickering, we jump a tiny bit ahead of the cue's start time.
			detail: { time: this.cue.startTime + 0.001 },
			bubbles: true,
			composed: true,
		}));
	}

	_renderExpandedControls() {
		return html`
			<div class="d2l-video-producer-captions-cue-expanded-controls">
				<div class="d2l-video-producer-captions-cue-start-end-container">
					<div class="d2l-video-producer-captions-cue-timestamp-container">
						<div class="d2l-video-producer-sync-cue-button-anchor">
							<d2l-button-icon
								class="d2l-video-producer-sync-cue-button"
								@click="${this._handleSyncStartTimestampClicked}"
								text=${this.localize('syncStartTimeToTimeline')}
								icon="tier1:time"
							></d2l-button-icon>
						</div>
						<d2l-input-text
							class="d2l-video-producer-captions-cue-start-timestamp"
							@focus="${this._handleFocus}"
							label=${this.localize('captionsCueStartTimestamp')}
							description=${this.localize('captionsCueStartTimestampDescription')}
							value=${formatTimestampText(this.cue.startTime)}
						></d2l-input-text>
					</div>
					<div class="d2l-video-producer-captions-cue-timestamp-container">
						<div class="d2l-video-producer-sync-cue-button-anchor">
							<d2l-button-icon
								class="d2l-video-producer-sync-cue-button"
								@click="${this._handleSyncEndTimestampClicked}"
								text=${this.localize('syncEndTimeToTimeline')}
								icon="tier1:time"
							></d2l-button-icon>
						</div>
						<d2l-input-text
							class="d2l-video-producer-captions-cue-end-timestamp"
							@focus="${this._handleFocus}"
							label=${this.localize('captionsCueEndTimestamp')}
							description=${this.localize('captionsCueEndTimestampDescription')}
							value=${formatTimestampText(this.cue.endTime)}
						></d2l-input-text>
					</div>
				</div>
			</div>
		`;
	}

	_renderMainControls() {
		return html`
			<div class="d2l-video-producer-captions-cue-main-controls">
				<textarea
					class="d2l-input d2l-video-producer-captions-cue-text-input"
					@focus="${this._handleFocus}"
					@input="${this._handleTextInput}"
					aria-label=${this.localize('captionsCueText')}
					rows="2"
				>${this.cue.text}</textarea>
				<div class="d2l-video-producer-captions-cue-main-controls-buttons">
					<d2l-button-icon
						@click="${this._handleDeleteClicked}"
						text=${this.localize('deleteCaptionsCue')}
						icon="tier1:delete"
					></d2l-button-icon>
					${ this.expanded ? (html`
						<d2l-button-icon
							text=${this.localize('hideExpandedCaptionsCueControls')}
							icon="tier1:arrow-collapse"
							@click=${this._hideExpandedControls}
						></d2l-button-icon>
					`) : (html`
						<d2l-button-icon
							text=${this.localize('openExpandedCaptionsCueControls')}
							icon="tier1:arrow-expand"
							@click=${this._showExpandedControls}
						></d2l-button-icon>
					`)}
				</div>
			</div>
		`;
	}

	_showExpandedControls() {
		this.expanded = true;
	}
}

customElements.define('d2l-video-producer-captions-cues-list-item', CaptionsCueListItem);

class VideoProducerCaptions extends InternalLocalizeMixin(LitElement) {
	static get properties() {
		return {
			activeCue: { type: Object },
			captions: { type: Array },
			defaultLanguage: { type: Object },
			languages: { type: Array },
			loading: { type: Boolean },
			selectedLanguage: { type: Object },

			_autoGenerateDialogOpened: { type: Boolean, attribute: false },
			_newCueText: { type: String, attribute: false },
			_numberOfVisibleCuesInList: { type: Number, attribute: false }
		};
	}

	static get styles() {
		return [ labelStyles, css`
			.d2l-video-producer-captions {
				align-items: center;
				border: 1px solid var(--d2l-color-mica);
				box-sizing: border-box;
				display: flex;
				flex-direction: column;
				height: 532px;
				justify-content: center;
				position: relative;
				width: 360px;
			}

			.d2l-video-producer-captions-editor-top-buttons {
				background-color: white;
				border-bottom: 1px solid var(--d2l-color-mica);
				display: flex;
				flex-direction: row;
				justify-content: space-around;
				left: 0;
				position: absolute;
				top: 0;
				width: 100%;
				z-index: 100;
			}

			.d2l-video-producer-no-captions-message {
				margin-left: 20px;
				margin-right: 20px;
				margin-top: 65%;
				text-align: center;
			}

			.d2l-video-producer-captions-cues-list {
				display: flex;
				flex-direction: column;
				height: 481px;
				margin-top: 43px;
				overflow-x: hidden;
				overflow-y: scroll;
				padding: 0px 10px 10px 10px;
				position: relative;
				width: 95%;
			}

			.d2l-video-producer-captions-cues-list-bottom {
				align-items: center;
				display: flex;
				justify-content: center;
				padding: 20px;
				width: 100%;
			}

			.d2l-video-producer-captions-bottom-bar {
				background-color: white;
				border-top: 1px solid var(--d2l-color-mica);
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				margin-top: auto;
				padding-bottom: 8px;
				padding-top: 8px;
				width: 100%;
			}
		`];
	}

	constructor() {
		super();
		this.activeCue = null;
		this.captions = [];
		this.languages = [];
		this._autoGenerateDialogOpened = false;
		this._newCueText = '';
		this._numberOfVisibleCuesInList = 0;
		this.listBottomObserver = null;

		this._loadMoreVisibleCues = this._loadMoreVisibleCues.bind(this);
		this._onFilesAdded = this._onFilesAdded.bind(this);
	}

	render() {
		return html`
			<div class="d2l-video-producer-captions">
				${this._renderContent()}
				<d2l-alert-toast
					id="d2l-video-producer-captions-alert-toast"
				></d2l-alert-toast>
			</div>
		`;
	}

	updated(changedProperties) {
		changedProperties.forEach((oldValue, propName) => {
			if (propName === 'loading' && !this.loading) {
				// We use IntersectionObserver for lazy loading.
				// IntersectionObserver uses a direct reference to its root element. In this case, the root
				// is an empty div we use to mark the bottom of the captions cues list.
				// Whenever this empty div is recreated (e.g. after the component goes from loading to non-loading state),
				// IntersectionObserver's root becomes stale and the intersection logic stops working.
				// To get around that, we initialize a new IntersectionObserver that points to the new
				// list bottom div, whenever this component finishes loading.
				this._updateLazyLoadForCaptionsCuesList();
			}
			if (propName === 'captions') {
				this._updateNumberOfVisibleCuesInList();
			}
			if (propName === 'activeCue') {
				this._scrollToActiveCue();
			}
		});
	}

	_dispatchCaptionsVttReplaced(vttString) {
		this.dispatchEvent(new CustomEvent('captions-vtt-replaced', {
			detail: { vttString },
			composed: false
		}));
	}

	_handleClearAllClicked() {
		this._dispatchCaptionsVttReplaced('WEBVTT'); // WebVTT file with no cues.
	}

	_handleInsertNewCue() {
		this.dispatchEvent(new CustomEvent('captions-cue-added', {
			detail: { text: this._newCueText },
			bubbles: true,
			composed: true,
		}));
		this._newCueText = '';
	}

	_handleNewCueTextInput(event) {
		this._newCueText = event.target.value;
	}

	_handleNewCueTextKeyPress(event) {
		if (event.keyCode === constants.ADD_NEW_CUE_KEY_CODE) {
			this._handleInsertNewCue();
		}
	}

	_loadMoreVisibleCues(intersectionEntries) {
		intersectionEntries.forEach(entry => {
			if (entry.isIntersecting) {
				if (this._numberOfVisibleCuesInList === 0) {
					this._numberOfVisibleCuesInList = constants.NUM_OF_VISIBLE_CAPTIONS_CUES;
				} else {
					if (this._numberOfVisibleCuesInList < this.captions.length - 1) {
						this._numberOfVisibleCuesInList += constants.NUM_OF_VISIBLE_CAPTIONS_CUES;
					}
				}
			}
		});
	}

	_onAutoGenerateClicked() {
		this._autoGenerateDialogOpened = true;
	}

	_onAutoGenerateDialogClosed() {
		this._autoGenerateDialogOpened = false;
	}

	_onFilesAdded(event) {
		if (!(event?.target?.files?.length === 1)) {
			return;
		}

		const file = event.target.files[0];
		const extension = file.name.split('.').pop();
		if (!['srt', 'vtt'].includes(extension.toLowerCase())) {
			this._openAlertToast({type: 'critical', text: this.localize('captionsInvalidFileType') });
		} else if (file.size > constants.MAX_CAPTIONS_UPLOAD_SIZE_IN_BYTES) {
			this._openAlertToast({type: 'critical', text: this.localize('captionsFileTooLarge', { localizedMaxFileSize: formatFileSize(constants.MAX_CAPTIONS_UPLOAD_SIZE_IN_BYTES) }) });
		} else {
			const fileReader = new FileReader();
			fileReader.addEventListener('load', event => {
				try {
					if (extension === 'vtt') {
						this._dispatchCaptionsVttReplaced(event.target.result);
					} else {
						const vttText = convertSrtTextToVttText(event.target.result);
						this._dispatchCaptionsVttReplaced(vttText);
					}
				} catch (error) {
					this._openAlertToast({type: 'critical', text: this.localize(error.message) });
					return;
				}
			});
			fileReader.addEventListener('error', () => {
				this._openAlertToast({type: 'critical', text: this.localize('captionsReadError') });
			});
			fileReader.readAsText(file, 'UTF-8');
		}
	}

	_onUploadClicked() {
		this.shadowRoot.querySelector('#d2l-video-producer-captions-file-uploader').click();
	}

	_openAlertToast({type, text}) {
		const alertToast = this.shadowRoot.querySelector('#d2l-video-producer-captions-alert-toast');
		alertToast.setAttribute('open', 'open');
		alertToast.setAttribute('type', type);
		alertToast.innerText = text;
	}

	_renderBottomBar() {
		return html`
			<div class="d2l-video-producer-captions-bottom-bar">
				<d2l-button-icon
					class="d2l-video-producer-captions-add-cue-button"
					@click="${this._handleInsertNewCue}"
					?disabled="${!this._newCueText}"
					icon="tier1:plus-default"
					text="${this.localize('insertNewCaptionsAtCurrentTime')}"
				></d2l-button-icon>
				<d2l-input-text
					@input="${this._handleNewCueTextInput}"
					@keypress="${this._handleNewCueTextKeyPress}"
					label="${this.localize('newCaptionsText')}"
					label-hidden
					placeholder="${this.localize('newCaptionsTextPlaceholder')}"
					value="${this._newCueText}"
				></d2l-input-text>
				<d2l-button-icon
					class="d2l-video-producer-captions-clear-all-button"
					@click="${this._handleClearAllClicked}"
					icon="tier1:blocked"
					text="${this.localize('clearAll')}"
				></d2l-button-icon>
			</div>
		`;
	}

	_renderContent() {
		if (this.loading) {
			return this._renderLoadingIndicator();
		} else {
			return html`
				${this._renderTopButtons()}
				${this.captions?.length > 0 ?  this._renderCuesList() : this._renderEmptyCaptionsMessage()}
				${this._renderBottomBar()}
				<input
					accept=".srt,.vtt"
					@change="${this._onFilesAdded}"
					id="d2l-video-producer-captions-file-uploader"
					style="display: none;"
					type="file"
				></input>
				<d2l-video-producer-auto-generate-captions-dialog
					@d2l-dialog-close="${this._onAutoGenerateDialogClosed}"
					.languages="${this.languages}"
					.opened="${this._autoGenerateDialogOpened}"
					.selectedLanguage="${this.selectedLanguage}"
				></d2l-video-producer-auto-generate-captions-dialog>
			`;
		}
	}

	_renderCuesList() {
		return html`
			<div class="d2l-video-producer-captions-cues-list">
				${this.captions.slice(0, this._numberOfVisibleCuesInList).map(cue => html`
					<d2l-video-producer-captions-cues-list-item
						?active="${this.activeCue && (cue.startTime === this.activeCue.startTime) && (cue.endTime === this.activeCue.endTime)}"
						.cue="${cue}"
					></d2l-video-producer-captions-cues-list-item>
				`)}
				<div class="d2l-video-producer-captions-cues-list-bottom"></div>
			</div>
		`;
	}

	_renderEmptyCaptionsMessage() {
		return html`
			<p class="d2l-body-standard d2l-video-producer-no-captions-message">${this.localize('noCaptions', { language: this.selectedLanguage.name })}</p>
		`;
	}

	_renderLoadingIndicator() {
		return html`<d2l-loading-spinner size="150"></d2l-loading-spinner>`;
	}

	_renderTopButtons() {
		return html`
			<div class="d2l-video-producer-captions-editor-top-buttons">
				<d2l-button-subtle
					text="${this.localize('autoGenerate')}"
					icon="tier1:manual-run"
					@click="${this._onAutoGenerateClicked}"
				></d2l-button-subtle>
				<d2l-button-subtle
					text="${this.localize('upload')}"
					icon="tier1:upload"
					@click="${this._onUploadClicked}"
				></d2l-button-subtle>
			</div>
		`;
	}

	_resetVisibleCuesInList() {
		this.visibleCuesInList = this.captions.slice(0, constants.NUM_OF_VISIBLE_CAPTIONS_CUES);
	}

	async _scrollToActiveCue() {
		// The active cue might have changed before the captions tab finished loading.
		const waitUntilLoadingFinished = resolve => {
			if (this.loading) {
				setTimeout(() => waitUntilLoadingFinished(resolve), 100);
			} else {
				resolve();
			}
		};
		await new Promise(resolve => waitUntilLoadingFinished(resolve));

		if (!this.activeCue) return;

		// Make sure the cue list element is finished drawing along with its cue list item elements.
		let captionsCuesList = this.shadowRoot.querySelector('.d2l-video-producer-captions-cues-list');
		if (!(captionsCuesList?.childNodes?.length >= this._numberOfVisibleCuesInList)) {
			const waitUntilListIsReady = resolve => {
				captionsCuesList = this.shadowRoot.querySelector('.d2l-video-producer-captions-cues-list');
				if (captionsCuesList?.childNodes?.length >= this._numberOfVisibleCuesInList) {
					resolve();
				} else {
					setTimeout(() => waitUntilListIsReady(resolve), 100);
				}
			};
			await new Promise(resolve => waitUntilListIsReady(resolve));
		}

		let activeCueListItem;
		let i = 0;
		while ((!activeCueListItem) && (i < captionsCuesList.childNodes.length)) {
			const cueListItem = captionsCuesList.childNodes[i];
			if ((cueListItem.startTime === this.activeCue.startTime) && (cueListItem.endTime === this.activeCue.endTime)) {
				activeCueListItem = cueListItem;
			}
			i++;
		}
		// Since we do lazy loading in the captions cues list, the active cue might not have been loaded into the list yet.
		// If that's the case, we load more items into the list gradually (to prevent DOM overload) until the active cue is in the list.
		if (!activeCueListItem) {
			const loadCuesUntilActiveCueIsDisplayed = resolve => {
				this._numberOfVisibleCuesInList += constants.NUM_OF_VISIBLE_CAPTIONS_CUES;
				setTimeout(() => {
					captionsCuesList = this.shadowRoot.querySelector('.d2l-video-producer-captions-cues-list');
					while ((!activeCueListItem) && (i < captionsCuesList.childNodes.length)) {
						const cueListItem = captionsCuesList.childNodes[i];
						if ((cueListItem.startTime === this.activeCue.startTime) && (cueListItem.endTime === this.activeCue.endTime)) {
							activeCueListItem = cueListItem;
							resolve();
							return;
						}
						i++;
					}
					// In theory, the active cue should always be found by the time we get to the end of the captions array.
					// But in the rare case where that doesn't happen, we prevent this function from recursing forever.
					if (i >= this.captions.length) {
						resolve();
					} else {
						loadCuesUntilActiveCueIsDisplayed(resolve);
					}
				}, 100);
			};
			await new Promise(resolve => loadCuesUntilActiveCueIsDisplayed(resolve));
		}

		if (activeCueListItem) {
			// The scroll might not work if the cues list element hasn't finished rendering yet.
			setTimeout(() => activeCueListItem.scrollIntoView(), 300);
		}
	}

	_updateLazyLoadForCaptionsCuesList() {
		if (this.listBottomObserver) {
			this.listBottomObserver.disconnect();
		}
		if (this.captions && this.captions.length > 0) {
			const options = {
				root: this.shadowRoot.querySelector('.d2l-video-producer-captions-cues-list'),
				rootMargin: '0px',
				threshold: 0.1,
			};
			const listBottom = this.shadowRoot.querySelector('.d2l-video-producer-captions-cues-list-bottom');
			this.listBottomObserver = new IntersectionObserver(this._loadMoreVisibleCues, options);
			this.listBottomObserver.observe(listBottom);
		}
	}

	_updateNumberOfVisibleCuesInList() {
		if (
			(Math.abs(this.captions.length - this._numberOfVisibleCuesInList) === 1) || // Adding or removing a single captions cue through the UI
			(this.captions.length <= constants.NUM_OF_VISIBLE_CAPTIONS_CUES)
		) {
			this._numberOfVisibleCuesInList = this.captions.length;
		} else if (this.captions.length > constants.NUM_OF_VISIBLE_CAPTIONS_CUES) {
			this._numberOfVisibleCuesInList = constants.NUM_OF_VISIBLE_CAPTIONS_CUES;
		}
	}
}

customElements.define('d2l-video-producer-captions', VideoProducerCaptions);
