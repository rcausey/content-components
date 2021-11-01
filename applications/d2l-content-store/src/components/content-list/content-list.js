import { css, html, LitElement } from 'lit-element/lit-element.js';
import {
	bodyCompactStyles,
	bodySmallStyles
} from '@brightspace-ui/core/components/typography/styles.js';
import { observe, toJS } from 'mobx';

// Polyfills
import '@brightspace-ui/core/components/list/list.js';
import '@brightspace-ui/core/components/list/list-item.js';
import '@brightspace-ui/core/components/button/button-icon.js';
import '@brightspace-ui/core/components/icons/icon.js';
import 'd2l-alert/d2l-alert-toast.js';
import './content-list-item.js';
import './content-list-item-ghost.js';
import './content-list-header.js';
import '../content-icon.js';
import '../relative-date.js';
import '../content-file-drop.js';

import { navigationSharedStyle } from '../../styles/d2l-navigation-shared-styles.js';
import { DependencyRequester } from '../../mixins/dependency-requester-mixin.js';
import { InternalLocalizeMixin } from '../../mixins/internal-localize-mixin.js';
import { NavigationMixin } from '../../mixins/navigation-mixin.js';
import { typeLocalizationKey } from '../../util/content-type.js';
import { rootStore } from '../../state/root-store.js';

class ContentList extends DependencyRequester(InternalLocalizeMixin(NavigationMixin(LitElement))) {
	static get properties() {
		return {
			contentItems: { type: Array, attribute: false },
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
		`];
	}

	constructor() {
		super();
		this.contentItems = [];
		this.infiniteScrollThreshold = 400;
		this.resultSize = 20;
		this.dateField = 'updatedAt';
		this.totalResults = 0;
		this.loading = false;
		this.hasNextPage = false;
		this.searchQueryStart = 0;
		this.alertToastMessage = '';
		this.alertToastButtonText = '';
		this.undoDeleteObject = {};

		const {
			searchQuery = '',
			sortQuery = 'updatedAt:desc',
			contentType = '',
			dateCreated = '',
			dateModified = ''
		} = rootStore.routingStore.getQueryParams();

		this.queryParams = { searchQuery, sortQuery, contentType, dateCreated, dateModified };

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
				<div id="d2l-content-store-list" class="d2l-navigation-gutters">
					${this.renderNotFound()}
					${this.contentItems.map(item => this.renderContentItem(item))}
					${this.renderGhosts()}
				</div>
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
		const { id: lastRevId, type: lastRevType } = item.revision;
		const { id } = item.content;
		const updatedAt = (new Date()).toISOString();

		await this.insertIntoContentItemsBasedOnSort({
			id, lastRevType, title, lastRevId, updatedAt
		});
	}

	areAnyFiltersActive() {
		return this.queryParams.searchQuery ||
			this.queryParams.contentType ||
			this.queryParams.dateModified ||
			this.queryParams.dateCreated;
	}

	changeSort({ detail = {} }) {
		const { sortKey, sortQuery } = detail;
		if (/^(createdAt|updatedAt)$/.test(sortKey)) {
			this.dateField = sortKey;
		}

		this._navigate('/manage/content', {
			...this.queryParams,
			sortQuery
		});
	}

	contentListItemDeletedHandler(e) {
		if (e && e.detail && e.detail.id) {
			const { id } = e.detail;
			const index = this.contentItems.findIndex(c => c.id === id);

			if (index >= 0 && index < this.contentItems.length) {
				this.undoDeleteObject = this.contentItems[index];
				this.contentItems.splice(index, 1);
				this.requestUpdate();
				this.showUndoDeleteToast();

				if (this.contentItems.length < this.resultSize && this.hasNextPage && !this.loading) {
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
			const index = this.contentItems.findIndex(c => c.id === id);
			if (index >= 0 && index < this.contentItems.length) {
				this.contentItems[index].title = title;
				this.contentItems[index][this.dateField] = (new Date()).toISOString();
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
		let indexToInsertAt = this.contentItems.findIndex(this.getCompareBasedOnSort(item));
		if (indexToInsertAt === -1) {
			indexToInsertAt = this.contentItems.length;
		}

		if (!this.hasNextPage || indexToInsertAt !== this.contentItems.length) {
			this.contentItems.splice(indexToInsertAt, 0, item);
			this.requestUpdate();
			await this.updateComplete;
		}
	}

	async loadNext() {
		this.loading = true;
		const { sortQuery, searchQuery, contentType, dateModified, dateCreated } = this.queryParams;
		const searchResult = await this.apiClient.searchContent({
			start: this.searchQueryStart,
			size: this.resultSize,
			sort: sortQuery,
			query: searchQuery,
			contentType,
			updatedAt: dateModified,
			createdAt: dateCreated
		});
		this.totalResults = searchResult.hits.total;
		this.searchQueryStart += searchResult.hits.hits.length;
		this.hasNextPage = this.searchQueryStart < this.totalResults;
		this.contentItems.push(...searchResult.hits.hits.map(item => ({ ...item._source, title: item._source.title || item._source.lastRevTitle })));
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
					contentType: updatedContentType = '',
					dateCreated: updatedDateCreated = '',
					dateModified: updatedDateModified = ''
				} = toJS(change.newValue);

				const { searchQuery, sortQuery, contentType, dateCreated, dateModified } =
					this.queryParams;

				if (updatedSearchQuery === searchQuery && updatedSortQuery === sortQuery &&
					updatedContentType === contentType && updatedDateCreated === dateCreated &&
					updatedDateModified === dateModified
				) {
					return;
				}

				this.queryParams = {
					searchQuery: updatedSearchQuery,
					sortQuery: updatedSortQuery,
					contentType: updatedContentType,
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
		const bottom = contentListElem.getBoundingClientRect().top + window.pageYOffset + contentListElem.clientHeight;
		const scrollY = window.pageYOffset + window.innerHeight;
		if (bottom - scrollY < this.infiniteScrollThreshold && this.hasNextPage && !this.loading) {
			this.loadNext();
		}
	}

	async reloadPage() {
		this.loading = true;
		this.contentItems = [];
		this.searchQueryStart = 0;
		this._navigate('/manage/content', this.queryParams);

		try {
			await this.loadNext();
		} catch (error) {
			this.loading = false;
			this.contentItems = [];
			this.searchQueryStart = 0;
		}
	}

	renderContentItem(item) {
		const { lastRevType: type } = item;
		const lkey = typeLocalizationKey(type);
		const iconType = lkey ? this.localize(lkey) : type;
		return html`
		<content-list-item
			id=${item.id}
			revision-id=${item.lastRevId}
			selectable
			type=${type}
			title=${item.title}
			@content-list-item-renamed=${this.contentListItemRenamedHandler}
			@content-list-item-deleted=${this.contentListItemDeletedHandler}
		>
			<content-icon type="${iconType}" slot="icon"></content-icon>
			<div slot="title" class="title">${item.title}</div>
			<div slot="type">${type}</div>
			<relative-date slot="date" value=${item[this.dateField]}></relative-date>
		</content-list-item>
		`;
	}

	renderGhosts() {
		return new Array(5).fill().map(() => html`
			<d2l-list><content-list-item-ghost ?hidden=${!this.loading}></content-list-item-ghost></d2l-list>
		`);
	}

	renderNotFound() {
		return !this.loading && this.contentItems.length === 0 ? html`
			<d2l-list>
				<d2l-list-item class="d2l-body-compact">
					${this.localize('noResultsFound')}
				</d2l-list-item>
			</d2l-list>
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
			this.alertToastMessage = this.localize('actionUndone');
			this.alertToastButtonText = '';
			this.requestUpdate();
			deleteToastElement.setAttribute('open', true);
		}
	}
}

window.customElements.define('content-list', ContentList);
