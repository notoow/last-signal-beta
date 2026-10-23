# Mobile runtime notices

The game's root LICENSE-NOTICES.md continues to apply to all shared game assets.
Mobile additions:

- Capacitor core, Android, iOS 8.5.3: MIT, Copyright (c) 2017-present Drifty Co.
  Exact license: licenses/capacitor-MIT.txt. Source: https://github.com/ionic-team/capacitor
- Capacitor App 8.1.2: MIT, Copyright 2020-present Ionic.
  Exact license: licenses/capacitor-app-MIT.txt. Source: https://github.com/ionic-team/capacitor-plugins

The build includes these exact notices in mobile-licenses/ and preserves esbuild's
linked bundled-code notices. CLI/esbuild are build tooling. Before distributing
native binaries, inventory Gradle/SPM transitive dependencies and include their
required notices; that final native dependency audit is not complete.
