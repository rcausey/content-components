import { css, html } from 'lit-element/lit-element.js';
import { bodyStandardStyles, heading2Styles } from '@brightspace-ui/core/components/typography/styles.js';
import { observe } from 'mobx';
import { DependencyRequester } from './mixins/dependency-requester-mixin.js';
import { PageViewElement } from './components/page-view-element.js';
import { navigationSharedStyle } from './styles/d2l-navigation-shared-styles.js';
import '@brightspace-ui/core/components/button/button.js';
import '@brightspace-ui/core/components/colors/colors.js';
import '@brightspace-ui/core/components/icons/icon.js';
import '@brightspace-ui/core/components/list/list.js';
import '@brightspace-ui/core/components/list/list-item.js';
import '@brightspace-ui/core/components/list/list-item-content.js';
import 'd2l-dropdown/d2l-dropdown.js';
import 'd2l-dropdown/d2l-dropdown-content.js';
import './components/two-column-layout.js';
import './components/upload-status-management.js';

class D2lContentStoreManage extends DependencyRequester(PageViewElement) {
	static get properties() {
		return {
			page: { type: String }
		};
	}

	static get styles() {
		return [heading2Styles, bodyStandardStyles, navigationSharedStyle, css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
			.page {
				display: none;
			}
			.page[active] {
				display: block;
			}

			d2l-menu-item {
				background-color: transparent;
			}
			.h2-custom {
				margin-top: 0 !important;
			}
			.sidebar-container {
				display: flex;
				flex-direction: column;
				padding-top: 1.5rem;
				padding-bottom: 1.5rem;
			}
			.list-container {
				margin-top: 0.75rem;
			}
			.list-item-container {
				align-items: center;
				display: flex;
				flex-wrap: nowrap;
			}
			.list-item-label {
				color: var(--d2l-color-ferrite) !important;
				padding-left: 0.75rem;
			}
			:host([dir="rtl"]) .list-item-label {
				padding-left: 0;
				padding-right: 0.75rem;
			}
			.dropdown-menu {
				left: 0.75rem !important;
			}
			:host([dir="rtl"]) .dropdown-menu {
				right: 0.75rem !important;
				left: 0 !important;
			}
		`];
	}

	constructor() {
		super();
		observe(
			this.rootStore.routingStore,
			'subView',
			change => {
				if (this.rootStore.routingStore.page === 'manage') {
					this.loadSubView(change.newValue);
				}
			}
		);

		observe(
			this.rootStore.routingStore,
			'page',
			change => {
				if (change.newValue === 'manage') {
					console.log(`Four page changed from ${change.oldValue} to ${change.newValue}`);
				}

				if (this.rootStore.routingStore.page === 'manage') {
					console.log(`Your page changed from ${change.oldValue} to ${change.newValue}`);
				}
			}
		);
	}

	connectedCallback() {
		super.connectedCallback();
		this.apiClient = this.requestDependency('content-service-client');
		this.uploader = this.requestDependency('uploader');
		if (this.rootStore.routingStore.page === 'manage') {
			this.loadSubView(this.rootStore.routingStore.subView);
		}
	}

	render() {
		return html`
			<two-column-layout>
				<div slot="sidebar">
					${this.renderSidebar()}
				</div>
				<div slot="primary">
					${this.renderPrimary()}
				</div>
			</two-column-layout>
			<upload-status-management id="upload-status-management"></upload-status-management>
		`;
	}

	goToContentPage() {
		this._navigate('/manage/content', { sortBy: 'date', page: Math.floor(Math.random() * 10) });
	}

	goToRecycleBin() {
		this._navigate('/manage/trash');
	}

	handleFileChange(event) {
		this.uploader.uploadFiles(event.target.files);
		event.target.value = '';
	}

	handleFileUploadClick() {
		this.shadowRoot.querySelector('#fileInput').click();
	}

	loadSubView(subView) {
		switch (subView) {
			/* eslint-disable no-unused-expressions */
			case '':
				this._navigate('/manage/content');
				return;
			case 'content':
				import('./pages/content-page.js');
				break;
			case 'trash':
				import('./pages/trash-page.js');
				break;
			default:
				this.rootStore.routingStore.setPage('404');
				import('./d2l-content-store-404.js');
				return;
			/* eslint-enable no-unused-expressions */
		}

		this.page = subView;
	}

	openPicker(type) {
		return () => {
			const openerName = type === 'GoogleDrive' ?
				'D2L.ContentStore.AddGoogleDriveLinkDialogOpener' :
				'D2L.ContentStore.AddOneDriveLinkDialogOpener';

			const opener = D2L.LP.Web.UI.ObjectRepository.TryGet(openerName);
			if (!opener) {
				return;
			}

			const event = opener();
			event.AddListener(async e => {
				const { id: contentId } = await this.apiClient.createContent({
					title: e.m_title
				});
				if (contentId) {
					const { id: revisionId } = await this.apiClient.createRevision(contentId, {
						type,
						link: e.m_url
					});

					await this.apiClient.processRevision({ contentId, revisionId });
				}
			});
		};
	}
	renderPrimary() {
		return html`
			<content-page class="page" ?active=${this.page === 'content'}></content-page>
			<trash-page class="page" ?active=${this.page === 'trash'}></trash-page>
		`;
	}

	renderSidebar() {
		return html`
		<div class="sidebar-container d2l-navigation-gutters">
			<d2l-dropdown>
				<d2l-dropdown-button text="${this.localize('new')}" primary>
					<d2l-dropdown-menu class="dropdown-menu">
						<d2l-menu>
							<d2l-menu-item text="${this.localize('createANewItem')}" @click=${this.handleFileUploadClick}></d2l-menu-item>
							<d2l-menu-item text="${this.localize('googledrive')}" @click=${this.openPicker('GoogleDrive')}></d2l-menu-item>
							<d2l-menu-item text="${this.localize('onedrive')}" @click=${this.openPicker('Office365')}></d2l-menu-item>
						</d2l-menu>
					</d2l-dropdown-menu>
				</d2l-dropdown-button>
			</d2l-dropdown>
			<div class="list-container">
				<d2l-list separators="between">
					<d2l-list-item href="javascript:void(0)" @click=${this.goToContentPage}>
						<d2l-list-item-content class="list-item-container">
							<d2l-icon icon="tier2:content"></d2l-icon><span class="list-item-label">${this.localize('myContent')}</span>
						</d2l-list-item-content>
					</d2l-list-item>
					<d2l-list-item href="javascript:void(0)" @click=${this.goToRecycleBin}>
						<d2l-list-item-content class="list-item-container">
							<d2l-icon icon="tier2:delete"></d2l-icon><span class="list-item-label">${this.localize('trash')}</span>
						</d2l-list-item-content>
					</d2l-list-item>
				</d2l-list>
			</div>
		</div>
		<input type="file" id="fileInput" @change=${this.handleFileChange} style="display:none" multiple />
		`;
	}

}

window.customElements.define('d2l-content-store-manage', D2lContentStoreManage);
