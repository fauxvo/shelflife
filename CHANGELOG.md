# Changelog

## [1.7.0](https://github.com/fauxvo/shelflife/compare/v1.6.0...v1.7.0) (2026-02-12)


### Features

* add "Most Keep Votes" sort option to community page ([55a6aea](https://github.com/fauxvo/shelflife/commit/55a6aea75d6b21c390e3cfe2ca10fd488fcb3089))
* enhance admin review panel and show available season counts ([cc8cb8f](https://github.com/fauxvo/shelflife/commit/cc8cb8f472e5d5d3f22c48d0cd86784824bd89a1))
* show available season count from Overseerr on TV show cards ([5438154](https://github.com/fauxvo/shelflife/commit/54381542fc714f22c5ef9ebdfa90326b81f496cb))


### Bug Fixes

* use const tuple for community sort enum to preserve literal types ([9ec4674](https://github.com/fauxvo/shelflife/commit/9ec467483f6be0b29cc0563071d3a76b8e41b0c2))

## [1.6.0](https://github.com/fauxvo/shelflife/compare/v1.5.1...v1.6.0) (2026-02-12)


### Features

* add sorting to admin round review panel ([f45ab29](https://github.com/fauxvo/shelflife/commit/f45ab2931bca0d044bc4ce3f10fc42277644db8a))

## [1.5.1](https://github.com/fauxvo/shelflife/compare/v1.5.0...v1.5.1) (2026-02-11)


### Bug Fixes

* improve stats accuracy and real-time updates ([4d44f39](https://github.com/fauxvo/shelflife/commit/4d44f39b7abebb1344f6936488bf96dbd4458c29))
* improve stats accuracy, real-time updates, and admin nomination handling ([e9f5484](https://github.com/fauxvo/shelflife/commit/e9f5484c0ba5afc5809e92e73f5601a3d8a12dee))

## [1.5.0](https://github.com/fauxvo/shelflife/compare/v1.4.2...v1.5.0) (2026-02-11)


### Features

* add configurable auto-sync via cron job ([e8bf31c](https://github.com/fauxvo/shelflife/commit/e8bf31c1d79225f663e40d0ff7ae41f6592ea3c6))
* add configurable auto-sync via cron job ([684d20e](https://github.com/fauxvo/shelflife/commit/684d20e5e68e7404587793d44e16ebb49ca3f83b))
* add scope filter to browse all users' content ([9649684](https://github.com/fauxvo/shelflife/commit/9649684be872d10e9d2d9570bc97775c6ba9d136))
* add scope filter to browse all users' content and default sort by newest ([672efc8](https://github.com/fauxvo/shelflife/commit/672efc889af63e4e26783ec2883507d91846e122))


### Bug Fixes

* address code review feedback for cron job PR ([c241068](https://github.com/fauxvo/shelflife/commit/c24106800b7adb64d821f47a444b853926500ec1))
* **ci:** exclude migrate.js from ESLint ([6ed1d38](https://github.com/fauxvo/shelflife/commit/6ed1d389cdfad44cd60d6a3a922cb6fb145b1fe0))

## [1.4.2](https://github.com/fauxvo/shelflife/compare/v1.4.1...v1.4.2) (2026-02-09)


### Bug Fixes

* address code review feedback for nomination counts PR ([4160714](https://github.com/fauxvo/shelflife/commit/41607145d8798815e0bed503e30948a25d1ca942))
* correct nomination counts for admin user stats and community page ([b8e9c00](https://github.com/fauxvo/shelflife/commit/b8e9c0011ed688af86ff8a26ebc88d1cacd9c84a))
* correct nomination counts for admin user stats and community page ([abc651c](https://github.com/fauxvo/shelflife/commit/abc651c6fea98af228e119218ec30e4e2bfe74cb))

## [1.4.1](https://github.com/fauxvo/shelflife/compare/v1.4.0...v1.4.1) (2026-02-07)


### Bug Fixes

* handle duplicate column errors in migration script ([886452f](https://github.com/fauxvo/shelflife/commit/886452ff8c93e0afbb593f743d86a82e97456fdf))

## [1.4.0](https://github.com/fauxvo/shelflife/compare/v1.3.0...v1.4.0) (2026-02-07)


### Features

* update dashboard stats optimistically after voting ([c92bb6a](https://github.com/fauxvo/shelflife/commit/c92bb6ac9508eee78c3b137a786d69e67891d464))


### Bug Fixes

* address code review issues ([9110fab](https://github.com/fauxvo/shelflife/commit/9110faba7e5f259269617fb2b28f362b9706efaf))
* exclude own nominations from community listing ([918542c](https://github.com/fauxvo/shelflife/commit/918542cdfc4dcf837aed2bccff96cc2a59eeb5b1))
* exclude own nominations from community listing ([a0d8717](https://github.com/fauxvo/shelflife/commit/a0d8717bdf2151bbc264442dbd6f532d76f9eac0))
* show own nominations in community with self-vote controls ([fd5b3bf](https://github.com/fauxvo/shelflife/commit/fd5b3bfb6f18e3699c7530cb2157ca92a5dd2d1f))

## [1.3.0](https://github.com/fauxvo/shelflife/compare/v1.2.0...v1.3.0) (2026-02-07)


### Features

* community voting, review rounds, trim votes, and dashboard search ([8df44f7](https://github.com/fauxvo/shelflife/commit/8df44f799043fe5d393a129b475cfcfcd7bb7421))
* community voting, review rounds, trim votes, and search ([e4c66d6](https://github.com/fauxvo/shelflife/commit/e4c66d6a78b804e5a8e80b6a1ba841753ab78978))


### Bug Fixes

* address PR review feedback - error states, race condition ([54022c1](https://github.com/fauxvo/shelflife/commit/54022c11f9dc03fd16cd17f929d961a982e8a3a0))

## [1.2.0](https://github.com/fauxvo/shelflife/compare/v1.1.1...v1.2.0) (2026-02-07)


### Features

* toast notifications for sync and auto-refresh stats ([d8ea297](https://github.com/fauxvo/shelflife/commit/d8ea297f7e5f246210c68e1c4dc9d4f960188ab5))
* toast notifications for sync results ([1743248](https://github.com/fauxvo/shelflife/commit/17432488222cdb0b127077bc206f45d8cb212411))


### Bug Fixes

* address code review - tests, accessibility, export ([b5e93f6](https://github.com/fauxvo/shelflife/commit/b5e93f682c4e9fbb44feefbaeeca1085218e0e3b))

## [1.1.1](https://github.com/fauxvo/shelflife/compare/v1.1.0...v1.1.1) (2026-02-07)


### Bug Fixes

* session cookie not persisting over plain HTTP ([d8a24b6](https://github.com/fauxvo/shelflife/commit/d8a24b6a2d141bdfea7056ce493a7054bb0ca214))
* session cookie not persisting over plain HTTP ([4198b4e](https://github.com/fauxvo/shelflife/commit/4198b4edd19ce0226315ef7d87e33312169e72fa))

## [1.1.0](https://github.com/fauxvo/shelflife/compare/v1.0.1...v1.1.0) (2026-02-07)


### Features

* add DEBUG logging and app version display ([865a470](https://github.com/fauxvo/shelflife/commit/865a4703ea847f1c18dff960bba6293d3898f2bc))
* debug logging, version display, and logout fix ([9c4d52c](https://github.com/fauxvo/shelflife/commit/9c4d52cd0c80fd1caac9d0a1cdce7605004951d2))


### Bug Fixes

* address code review feedback ([624936a](https://github.com/fauxvo/shelflife/commit/624936a039e3317b3ee9f9694f9f75fa05d17b3e))
* logout redirect and add DEBUG to docs ([904318e](https://github.com/fauxvo/shelflife/commit/904318edf6e31ebbdd688a33f1c16fc44f86dc20))

## [1.0.1](https://github.com/fauxvo/shelflife/compare/v1.0.0...v1.0.1) (2026-02-07)


### Bug Fixes

* auto-run database migrations on container startup ([155f881](https://github.com/fauxvo/shelflife/commit/155f88185553a8430c8cfd84d123d60dc9335e38))

## 1.0.0 (2026-02-07)


### Features

* add Husky pre-commit hooks with lint-staged and Prettier Tailwind plugin ([f33a467](https://github.com/fauxvo/shelflife/commit/f33a467912d4f242c77893354c16a59fcd6b7f01))
* add Release Please workflow for automatic changelog generation ([c41b137](https://github.com/fauxvo/shelflife/commit/c41b13791d326e1b6621a58d6459dc7c032fb7f2))
* add Unraid WebUI label and custom app icon ([64522b1](https://github.com/fauxvo/shelflife/commit/64522b14711dc3f7217427115b1b5a1d718f78e2))
* add Unraid WebUI label and custom app icon ([c64afaa](https://github.com/fauxvo/shelflife/commit/c64afaa5733757c08d859c2da53ced347b193ae9))


### Bug Fixes

* exclude test files from production build ([b9f8f42](https://github.com/fauxvo/shelflife/commit/b9f8f4297de807f666de853cf00b33f20187fb58))
* exclude test files from production build ([712fab2](https://github.com/fauxvo/shelflife/commit/712fab2612bf3081ece4d6d16e16a475ede1a180))
* grant Claude Code Review write permissions and proper tooling ([6e53401](https://github.com/fauxvo/shelflife/commit/6e5340113decaa3591282323b88a3c6ee6c74c9a))
* resolve SQLite permissions error on Unraid volume mounts ([f4126fc](https://github.com/fauxvo/shelflife/commit/f4126fc8f8db2797e8278faf05417da524f2be9b))
* resolve SQLite permissions error on Unraid volume mounts ([9313974](https://github.com/fauxvo/shelflife/commit/93139745857ce5c3aa5c07d10e5d348f3f4dd8e1))
