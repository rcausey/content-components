import { expect, fixture, html } from '@open-wc/testing';
import { val } from '../../../../locales/en.js';
import '../content-list.js';

describe('content-list', () => {
	const testContentItems = [
		{
			id: 'some-id',
			revisionId: 'some-rev-id',
			lastRevType: 'scorm',
			title: 'some title',
			updatedAt: '2020-02-21T17:42:42.679Z'
		},
		{
			id: 'some-other-id',
			revisionId: 'some-other-rev-id',
			lastRevType: 'video',
			title: 'some title 2',
			updatedAt: '2020-01-21T17:42:42.679Z'
		}
	];
	const testRevision = {
		id: '7890',
		title: 'last rev test title',
		type: 'PNG'
	};
	const apiClientMock = {
		undeleteContent: () => true
	};
	let el;

	beforeEach(async() => {
		el = await fixture(html`<content-list></content-list>`);
		el.apiClient = apiClientMock;
		await el.updateComplete;
	});

	it.skip('passes all aXe tests with content items', async() => {
		el.loading = false;
		el.contentItems = testContentItems.slice();
		await el.updateComplete;
		await expect(el).to.be.accessible();
	});

	it.skip('passes all aXe tests with no results', async() => {
		el.loading = false;
		await el.updateComplete;
		await expect(el).to.be.accessible();
	});

	it.skip('passes all aXe tests while loading', async() => {
		el.loading = true;
		await el.updateComplete;
		await expect(el).to.be.accessible();
	});

	describe('upload tests', () => {
		it('uploading content item does not appear if there is a next page and should be last item', async() => {
			el.loading = false;
			el.contentItems = testContentItems.slice();
			el.hasNextPage = true;
			el.queryParams.sortQuery = 'updatedAt:asc';
			await el.updateComplete;

			const now = new Date();
			const newUploadContentId = '123';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId,
					createdAt: now.toISOString()
				},
				revision: testRevision
			};
			await el.updateComplete;

			expect(el.contentItems.length).to.equal(testContentItems.length);
		});

		it('uploading content item with sort on updatedAt:asc', async() => {
			el.loading = false;
			el.queryParams.sortQuery = 'updatedAt:asc';
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const now = new Date();
			const newUploadContentId = '1234';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId,
					createdAt: now.toISOString()
				},
				revision: testRevision
			};
			await el.updateComplete;
			const lastItemIndex = el.contentItems.length - 1;
			expect(el.contentItems[lastItemIndex].id).to.equal(newUploadContentId);
		});

		it('uploading content item with sort on updatedAt:desc', async() => {
			el.loading = false;
			el.queryParams.sortQuery = 'updatedAt:desc';
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const now = new Date();
			const newUploadContentId = '12345';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId,
					createdAt: now.toISOString()
				},
				revision: testRevision
			};
			await el.updateComplete;
			expect(el.contentItems[0].id).to.equal(newUploadContentId);
		});

		it('uploading content item with sort on lastRevTitle.keyword:asc', async() => {
			el.loading = false;
			el.queryParams.sortQuery = 'lastRevTitle.keyword:asc';
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const now = new Date();
			const newUploadContentId = '123456';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId,
					title: 'AAAA',
					createdAt: now.toISOString()
				},
				revision: {
					id: '67890',
					type: 'PNG'
				}
			};
			await el.updateComplete;
			expect(el.contentItems[0].id).to.equal(newUploadContentId);

			const newUploadContentId1 = '123456a';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId1,
					title: 'ZZZZ',
					createdAt: now.toISOString()
				},
				revision: {
					id: '67890',
					type: 'PNG'
				}
			};
			await el.updateComplete;
			const lastItemIndex = el.contentItems.length - 1;
			expect(el.contentItems[lastItemIndex].id).to.equal(newUploadContentId1);
		});

		it('uploading content item with sort on lastRevTitle.keyword:desc', async() => {
			el.loading = false;
			el.queryParams.sortQuery = 'lastRevTitle.keyword:desc';
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const now = new Date();
			const newUploadContentId = '1234567';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId,
					title: 'ZZZZ1',
					createdAt: now.toISOString()
				},
				revision: {
					id: '67890',
					type: 'PNG'
				}
			};
			await el.updateComplete;
			expect(el.contentItems[0].id).to.equal(newUploadContentId);

			const newUploadContentId1 = '1234567a';
			el.uploader.successfulUpload = {
				upload: {},
				content: {
					id: newUploadContentId1,
					title: 'AAAA1',
					createdAt: now.toISOString()
				},
				revision: {
					id: '67890',
					type: 'PNG'
				}
			};
			await el.updateComplete;
			const lastItemIndex = el.contentItems.length - 1;
			expect(el.contentItems[lastItemIndex].id).to.equal(newUploadContentId1);
		});
	});

	describe('rename tests', () => {
		it('renaming an item', async() => {
			el.loading = false;
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const contentListItem = el.shadowRoot.querySelector(`#${testContentItems[0].id}`);
			const newTitle = 'changed title';
			expect(el.contentItems[0].title).to.equal(testContentItems[0].title);
			contentListItem.dispatchRenameEvent(newTitle);
			await el.updateComplete;

			const oneMinuteAgo = Date.now() - (1000 * 60);
			const contentItemDate = new Date(el.contentItems[0].updatedAt);
			expect(el.contentItems[0].title).to.equal(newTitle);
			expect(contentItemDate > oneMinuteAgo).to.be.true;
		});
	});

	describe('deletion tests', () => {
		const deleteToastRemovedMessage = val.removedFile;
		const deleteToastUndoMessage = val.actionUndone;

		it('deletion removes item from contentItems', async() => {
			el.loading = false;
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const deleteToast = el.shadowRoot.querySelector('#delete-toast');
			const contentListItem = el.shadowRoot.querySelector(`#${testContentItems[0].id}`);

			expect(deleteToast.hasAttribute('open')).to.be.false;
			expect(el.contentItems.length).to.equal(testContentItems.length);

			contentListItem.dispatchDeletedEvent();
			await el.updateComplete;

			expect(el.contentItems.findIndex(c => c.id === testContentItems[0].id)).to.equal(-1);
			expect(el.contentItems.length).to.equal(testContentItems.length - 1);
			expect(deleteToast.hasAttribute('open')).to.be.true;
			expect(deleteToast.innerHTML).to.contain(deleteToastRemovedMessage);
		});

		it.skip('undo delete using the toast option', async() => {
			el.loading = false;
			el.contentItems = testContentItems.slice();
			await el.updateComplete;

			const deleteToast = el.shadowRoot.querySelector('#delete-toast');
			const contentListItem = el.shadowRoot.querySelector(`#${testContentItems[0].id}`);

			expect(deleteToast.hasAttribute('open')).to.be.false;
			expect(el.contentItems.length).to.equal(testContentItems.length);

			contentListItem.dispatchDeletedEvent();
			await el.updateComplete;

			expect(el.contentItems.findIndex(c => c.id === testContentItems[0].id)).to.equal(-1);
			expect(el.contentItems.length).to.equal(testContentItems.length - 1);
			expect(deleteToast.hasAttribute('open')).to.be.true;
			expect(deleteToast.innerHTML).to.contain(deleteToastRemovedMessage);

			const alertElement = deleteToast.shadowRoot.querySelector('d2l-alert');
			const undoButtonInAlert = alertElement.shadowRoot.querySelector('d2l-button-subtle');
			await undoButtonInAlert.click();
			await el.updateComplete;
			await deleteToast.updateComplete;
			await el.updateComplete;

			expect(deleteToast.innerHTML).to.contain(deleteToastUndoMessage);
			expect(deleteToast.hasAttribute('open')).to.be.true;
			expect(el.contentItems.length).to.equal(testContentItems.length);
			expect(el.contentItems.findIndex(c => c.id === testContentItems[0].id)).to.equal(0);
		});
	});
});
