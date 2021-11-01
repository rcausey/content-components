# d2l-capture-producer

[![NPM version](https://img.shields.io/npm/v/@brightspace-ui-labs/video-producer.svg)](https://www.npmjs.org/package/@brightspace-ui-labs/video-producer)

> Note: this is a ["labs" component](https://github.com/BrightspaceUI/guide/wiki/Component-Tiers). While functional, these tasks are prerequisites to promotion to BrightspaceUI "official" status:
>
> - [ ] [Design organization buy-in](https://github.com/BrightspaceUI/guide/wiki/Before-you-build#working-with-design)
> - [ ] [design.d2l entry](http://design.d2l/)
> - [ ] [Architectural sign-off](https://github.com/BrightspaceUI/guide/wiki/Before-you-build#web-component-architecture)
> - [x] [Continuous integration](https://github.com/BrightspaceUI/guide/wiki/Testing#testing-continuously-with-travis-ci)
> - [ ] [Cross-browser testing](https://github.com/BrightspaceUI/guide/wiki/Testing#cross-browser-testing-with-sauce-labs)
> - [ ] [Unit tests](https://github.com/BrightspaceUI/guide/wiki/Testing#testing-with-polymer-test) (if applicable)
> - [ ] [Accessibility tests](https://github.com/BrightspaceUI/guide/wiki/Testing#automated-accessibility-testing-with-axe)
> - [ ] [Visual diff tests](https://github.com/BrightspaceUI/visual-diff)
> - [ ] [Localization](https://github.com/BrightspaceUI/guide/wiki/Localization) with Serge (if applicable)
> - [x] Demo page
> - [x] README documentation

## Installation

To install from NPM:

```shell
npm install @brightspace-ui-labs/video-producer
```

## `video-producer`

### Usage
(See demo page for a more detailed example)

### HTML Example

```html
	<d2l-capture-producer
		endpoint="http://content-service-staging.brightspace.d2l.com"
		tenant-id="0840bb02-1f06-431d-9ae8-70c18a4dbf6b"
		content-id="c2c54ba6-845c-4711-8aa3-2af37827b344"
	></d2l-capture-producer>
```

### LitElement Example

```js
import '@brightspace-ui-labs/video-producer/video-producer.js';

const defaultLanguage = { code: 'en-us', name: 'English' };
let selectedLanguage = { code: 'fr-fr', name: 'French' };
const metadata = { cuts: [], chapters: [] };
const handleMetadataChanged = e => (metadata = e.detail);

const contentServiceEndpoint = 'http://content-service-staging.brightspace.d2l.com';
const tenantId = '0840bb02-1f06-431d-9ae8-70c18a4dbf6b';
const contentId='c2c54ba6-845c-4711-8aa3-2af37827b344';

class MyComponent {
	// ...
	render() {
		return html`
			<d2l-capture-producer
				.endpoint="${contentServiceEndpoint}"
				.tenant-id="${tenantId}"
				.content-id="${contentId}"
			></d2l-capture-producer>
		`;
	}
}
```

**Properties:**

| Property | Type | Description |
|--|--|--|
| src | String | Source of the video file. |
| .endpoint | String | API endpoint URL for Content Service. |
| .tenant-id | String | ID of the Brightspace tenant that owns the audio/video content. |
| .content-id | String | ID of the audio/video content object. |

**Events:**

| Event | Description |
|--|--|
| @content-loaded | Fired when the content specified by contentId has been loaded. event.details contains a "content" object possessing the properties of the content object. |

## `video-producer-language-selector`

### Usage
```js
import '@brightspace-ui-labs/video-producer/video-producer-language-selector.js';

const languages = [
	{ code: 'en-us', name: 'English' },
	{ code: 'fr-fr', name: 'French' },
];
let selectedLanguage = { code: 'fr-fr', name: 'French' };
const handleSelectedLanguageChanged = e => (selectedLanguage = e.detail.selectedLanguage);
const disabled = false;

class MyComponent {
	// ...
	render() {
		return html`
			<d2l-video-producer-language-selector
				?disabled="${disabled}"
				.languages="${languages}"
				.selectedLanguage="${selectedLanguage}"
				@selected-language-changed="${handleSelectedLanguageChanged}"
			></d2l-video-producer-language-selector>
		`;
	}
}
```

**Properties:**

| Property | Type | Description |
|--|--|--|
| .languages | Object | An array of objects representing the available languages to select. Each language object should have two properties: `code` and `name`. |
| .selectedLanguage | Object | An object representing the currently selected language. Should have two properties: `code` and `name`. |
| .disabled | Boolean | Enables or disables the language dropdown button. |

**Events:**

| Event | Description |
|--|--|
| @selected-language-changed | Fired when the selected language has changed. |

## Developing, Testing and Contributing

After cloning the repo, run `npm install` to install dependencies.

### Running the demos

To start an [es-dev-server](https://open-wc.org/developing/es-dev-server.html) that hosts the demo page and tests:

```shell
npm run start:d2l-capture-producer
```

### Linting

```shell
# eslint and lit-analyzer
npm run lint

# eslint only
npm run lint:eslint

# lit-analyzer only
npm run lint:lit
```

### Testing

```shell
# lint, unit test and visual-diff test
npm test

# lint only
npm run lint

# unit tests only
npm run test:headless

# debug or run a subset of local unit tests
# then navigate to `http://localhost:9876/debug.html`
npm run test:headless:watch
```

### Visual Diff Testing

This repo uses the [@brightspace-ui/visual-diff utility](https://github.com/BrightspaceUI/visual-diff/) to compare current snapshots against a set of golden snapshots stored in source control.

The golden snapshots in source control must be updated by Github Actions.  If your PR's code changes result in visual differences, a PR with the new goldens will be automatically opened for you against your branch.

If you'd like to run the tests locally to help troubleshoot or develop new tests, you can use these commands:

```shell
# Install dependencies locally
npm i mocha -g
npm i @brightspace-ui/visual-diff puppeteer --no-save
# run visual-diff tests
mocha './test/**/*.visual-diff.js' -t 10000
# subset of visual-diff tests:
mocha './test/**/*.visual-diff.js' -t 10000 -g some-pattern
# update visual-diff goldens
mocha './test/**/*.visual-diff.js' -t 10000 --golden
```

## Versioning & Releasing

> TL;DR: Commits prefixed with `fix:` and `feat:` will trigger patch and minor releases when merged to `master`. Read on for more details...

The [sematic-release GitHub Action](https://github.com/BrightspaceUI/actions/tree/master/semantic-release) is called from the `release.yml` GitHub Action workflow to handle version changes and releasing.

### Version Changes

All version changes should obey [semantic versioning](https://semver.org/) rules:
1. **MAJOR** version when you make incompatible API changes,
2. **MINOR** version when you add functionality in a backwards compatible manner, and
3. **PATCH** version when you make backwards compatible bug fixes.

The next version number will be determined from the commit messages since the previous release. Our semantic-release configuration uses the [Angular convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular) when analyzing commits:
* Commits which are prefixed with `fix:` or `perf:` will trigger a `patch` release. Example: `fix: validate input before using`
* Commits which are prefixed with `feat:` will trigger a `minor` release. Example: `feat: add toggle() method`
* To trigger a MAJOR release, include `BREAKING CHANGE:` with a space or two newlines in the footer of the commit message
* Other suggested prefixes which will **NOT** trigger a release: `build:`, `ci:`, `docs:`, `style:`, `refactor:` and `test:`. Example: `docs: adding README for new component`

To revert a change, add the `revert:` prefix to the original commit message. This will cause the reverted change to be omitted from the release notes. Example: `revert: fix: validate input before using`.

### Releases

When a release is triggered, it will:
* Update the version in `package.json`
* Tag the commit
* Create a GitHub release (including release notes)
* Deploy a new package to NPM

### Releasing from Maintenance Branches

Occasionally you'll want to backport a feature or bug fix to an older release. `semantic-release` refers to these as [maintenance branches](https://semantic-release.gitbook.io/semantic-release/usage/workflow-configuration#maintenance-branches).

Maintenance branch names should be of the form: `+([0-9])?(.{+([0-9]),x}).x`.

Regular expressions are complicated, but this essentially means branch names should look like:
* `1.15.x` for patch releases on top of the `1.15` release (after version `1.16` exists)
* `2.x` for feature releases on top of the `2` release (after version `3` exists)
