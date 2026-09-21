export type BuildInfo = {
  schemaVersion: 1;
  appName: 'CIHOF Portrait Wall';
  packageName: string;
  packageVersion: string;
  buildTarget: 'kiosk' | 'public' | 'portal';
  mode: string;
  basePath: string;
  outDir: string;
  gitCommit: string;
  gitCommitShort: string;
  gitBranch: string;
  builtAt: string;
  /** Content revision of the bundle this artifact was built against. */
  contentRevision: string;
  /** Runtime bundle schema version this artifact expects. */
  contentSchemaVersion: number;
};

export const buildInfo: BuildInfo = __CIHOF_BUILD_INFO__;
