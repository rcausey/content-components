import '@brightspace-ui/core/components/alert/alert-toast.js';
import '@brightspace-ui/core/components/button/button-icon.js';
import '@brightspace-ui/core/components/colors/colors.js';
import '@brightspace-ui/core/components/icons/icon.js';
import '@brightspace-ui/core/components/list/list-item.js';
import '@brightspace-ui/core/components/list/list.js';
import '../content-file-drop.js';
import '../relative-date.js';
import './content-list-header.js';
import './content-list-item-ghost.js';
import './content-list-item.js';

import { bodyCompactStyles, bodySmallStyles } from '@brightspace-ui/core/components/typography/styles.js';
import { css, html, LitElement } from 'lit-element/lit-element.js';
import { observe, toJS } from 'mobx';

import { contentSearchMixin } from '../../mixins/content-search-mixin.js';
import { DependencyRequester } from '../../mixins/dependency-requester-mixin.js';
import { InternalLocalizeMixin } from '../../mixins/internal-localize-mixin.js';
import { NavigationMixin } from '../../mixins/navigation-mixin.js';
import { navigationSharedStyle } from '../../style/d2l-navigation-shared-styles.js';
import { rootStore } from '../../state/root-store.js';

class ContentList extends DependencyRequester(InternalLocalizeMixin(NavigationMixin(contentSearchMixin(LitElement)))) {
	static get properties() {
		return {
			loading: { type: Boolean, attribute: false }
		};
	}

	static get styles() {
		return [bodyCompactStyles, bodySmallStyles, navigationSharedStyle, css`
			:host([hidden]) {
				display: none;
			}

			.title {
				word-break: break-word;
			}

			#d2l-content-store-list {
				padding-top: 1px;
			}

			.d2l-capture-central-content-list-no-results {
				display: flex;
				justify-content: center;
				margin-top: 20px;
			}

			d2l-icon {
				border-radius: 5px;
				padding: 12px;
				background-color: var(--d2l-color-celestine);
				color: var(--d2l-color-white);
			}
		`];
	}

	constructor() {
		super();
		this.infiniteScrollThreshold = 400;
		this.dateField = 'updatedAt';
		this.loading = false;
		this.alertToastMessage = '';
		this.alertToastButtonText = '';
		this.undoDeleteObject = {};

		const {
			searchQuery = '',
			sortQuery = 'updatedAt:desc',
			dateCreated = '',
			dateModified = ''
		} = rootStore.routingStore.getQueryParams();

		this.queryParams = { searchQuery, sortQuery, dateCreated, dateModified };

		window.addEventListener('scroll', this.onWindowScroll.bind(this));
		this.observeQueryParams();
	}

	connectedCallback() {
		super.connectedCallback();
		this.apiClient = this.requestDependency('content-service-client');
		this.uploader = this.requestDependency('uploader') || rootStore.uploader;
		this.observeSuccessfulUpload();
		this.reloadPage();
	}

	render() {
		return html`
			<content-list-header @change-sort=${this.changeSort}></content-list-header>
			<content-file-drop>
			<d2l-list>
				<div id="d2l-content-store-list">
					${this.renderNotFound()}
					${this._videos.map(item => this.renderContentItem(item))}
					${this.renderGhosts()}
				</div>
			</d2l-list>
			</content-file-drop>

			<d2l-alert-toast
				id="delete-toast"
				type="default"
				button-text=${this.alertToastButtonText}
				announce-text=${this.alertToastMessage}
				@d2l-alert-button-pressed=${this.undoDeleteHandler}>
				${this.alertToastMessage}
			</d2l-alert-toast>
		`;
	}

	async addNewItemIntoContentItems(item) {
		if (!item || !item.revision || !item.content || !item.upload) {
			return;
		}

		const { title } = item.content;
		const { id: revisionId, type } = item.revision;
		const { id } = item.content;
		const updatedAt = (new Date()).toISOString();

		await this.insertIntoContentItemsBasedOnSort({
			id, revisionId, type, title, updatedAt
		});
	}

	areAnyFiltersActive() {
		return this.queryParams.searchQuery ||
			this.queryParams.dateModified ||
			this.queryParams.dateCreated;
	}

	changeSort({ detail = {} }) {
		const { sortKey, sortQuery } = detail;
		if (/^(createdAt|updatedAt)$/.test(sortKey)) {
			this.dateField = sortKey;
		}

		this._navigate('/my-videos', {
			...this.queryParams,
			sortQuery
		});
	}

	contentListItemDeletedHandler(e) {
		if (e && e.detail && e.detail.id) {
			const { id } = e.detail;
			const index = this._videos.findIndex(c => c.id === id);

			if (index >= 0 && index < this._videos.length) {
				this.undoDeleteObject = this._videos[index];
				this._videos.splice(index, 1);
				this.requestUpdate();
				this.showUndoDeleteToast();

				if (this._videos.length < this._resultSize && this._moreResultsAvailable && !this.loading) {
					this.loadNext();
				}
			}
		}
	}

	contentListItemRenamedHandler(e) {
		const { detail } = e;

		if (!detail) {
			return;
		}

		const { id, title } = detail;

		if (id && title) {
			const index = this._videos.findIndex(c => c.id === id);
			if (index >= 0 && index < this._videos.length) {
				this._videos[index].title = title;
				this._videos[index][this.dateField] = (new Date()).toISOString();
				this.requestUpdate();
			}
		}
	}

	getCompareBasedOnSort(item) {
		const itemUpdatedAtDate = new Date(item.updatedAt);
		switch (this.queryParams.sortQuery) {
			case 'updatedAt:desc':
				return e => {
					const elementUpdatedAtDate = new Date(e.updatedAt);
					return elementUpdatedAtDate <= itemUpdatedAtDate;
				};

			case 'updatedAt:asc':
				return e => {
					const elementUpdatedAtDate = new Date(e.updatedAt);
					return elementUpdatedAtDate >= itemUpdatedAtDate;
				};

			case 'lastRevTitle.keyword:desc':
				return e => {
					return e.title.toLowerCase() <= item.title.toLowerCase();
				};

			case 'lastRevTitle.keyword:asc':
				return e => {
					return e.title.toLowerCase() >= item.title.toLowerCase();
				};

			default:
				return () => true;
		}
	}

	async insertIntoContentItemsBasedOnSort(item) {
		let indexToInsertAt = this._videos.findIndex(this.getCompareBasedOnSort(item));
		if (indexToInsertAt === -1) {
			indexToInsertAt = this._videos.length;
		}

		if (!this._moreResultsAvailable || indexToInsertAt !== this._videos.length) {
			this._videos.splice(indexToInsertAt, 0, item);
			this.requestUpdate();
			await this.updateComplete;
		}
	}

	async loadNext({ append = true } = {}) {
		this.loading = true;
		const { sortQuery, searchQuery, dateModified, dateCreated } = this.queryParams;
		await this._handleVideoSearch({
			append,
			createdAt: dateCreated,
			query: searchQuery,
			sort: sortQuery,
			updatedAt: dateModified,
		});

		this.loading = false;
	}

	observeQueryParams() {
		observe(
			rootStore.routingStore,
			'queryParams',
			change => {
				if (this.loading) {
					return;
				}

				const {
					searchQuery: updatedSearchQuery = '',
					sortQuery: updatedSortQuery = 'updatedAt:desc',
					dateCreated: updatedDateCreated = '',
					dateModified: updatedDateModified = ''
				} = toJS(change.newValue);

				const { searchQuery, sortQuery, dateCreated, dateModified } =
					this.queryParams;

				if (updatedSearchQuery === searchQuery && updatedSortQuery === sortQuery &&
					updatedDateCreated === dateCreated && updatedDateModified === dateModified
				) {
					return;
				}

				this.queryParams = {
					searchQuery: updatedSearchQuery,
					sortQuery: updatedSortQuery,
					dateCreated: updatedDateCreated,
					dateModified: updatedDateModified
				};
				this.reloadPage();
			}
		);
	}

	observeSuccessfulUpload() {
		observe(
			this.uploader,
			'successfulUpload',
			async change => {
				if (change.newValue &&
					change.newValue.content &&
					!this.areAnyFiltersActive()) {
					return this.addNewItemIntoContentItems(toJS(change.newValue));
				}
			}
		);
	}

	onWindowScroll() {
		const contentListElem = this.shadowRoot.querySelector('#d2l-content-store-list');
		if (contentListElem) {
			const bottom = contentListElem.getBoundingClientRect().top + window.pageYOffset + contentListElem.clientHeight;
			const scrollY = window.pageYOffset + window.innerHeight;
			if (bottom - scrollY < this.infiniteScrollThreshold && this._moreResultsAvailable && !this.loading) {
				this.loadNext();
			}
		}
	}

	async reloadPage() {
		this.loading = true;
		this._videos = [];
		this._start = 0;
		this._navigate('/my-videos', this.queryParams);

		try {
			await this.loadNext({ append: false });
		} catch (error) {
			this.loading = false;
			this._videos = [];
			this._start = 0;
		}
	}

	renderContentItem(item) {
		return html`
		<content-list-item
			id=${item.id}
			revision-id=${item.revisionId}
			selectable
			title=${item.title}
			@content-list-item-renamed=${this.contentListItemRenamedHandler}
			@content-list-item-deleted=${this.contentListItemDeletedHandler}
		>
			<d2l-icon icon="tier1:file-video" slot="icon"></d2l-icon>
			<div slot="title" class="title">${item.title}</div>
			<div slot="type">${item.type}</div>
			<relative-date slot="date" value=${item[this.dateField]}></relative-date>
		</content-list-item>
		`;
	}

	renderGhosts() {
		return new Array(5).fill().map(() => html`
			<d2l-list>
				<content-list-item-ghost ?hidden=${!this.loading}></content-list-item-ghost>
			</d2l-list>
		`);
	}

	renderNotFound() {
		return !this.loading && this._videos.length === 0 ? html`
			<div class="d2l-capture-central-content-list-no-results">
				${this.localize('noResults')}
			</div>
		` : html``;
	}

	showUndoDeleteToast() {
		const deleteToastElement = this.shadowRoot.querySelector('#delete-toast');

		if (deleteToastElement) {
			deleteToastElement.removeAttribute('open');
			this.alertToastMessage = this.localize('removedFile');
			this.alertToastButtonText = this.localize('undo');
			deleteToastElement.setAttribute('open', true);
		}
	}

	async undoDeleteHandler() {
		const deleteToastElement = this.shadowRoot.querySelector('#delete-toast');

		if (deleteToastElement && this.undoDeleteObject && this.undoDeleteObject.id) {
			deleteToastElement.removeAttribute('open');
			await this.apiClient.undeleteContent({ contentId: this.undoDeleteObject.id });

			if (!this.areAnyFiltersActive()) {
				await this.insertIntoContentItemsBasedOnSort(this.undoDeleteObject);
			}

			this.undoDeleteObject = {};
			this.alertToastMessage = this.localize('restoredFile');
			this.alertToastButtonText = '';
			this.requestUpdate();
			deleteToastElement.setAttribute('open', true);
		}
	}
}

window.customElements.define('content-list', ContentList);
