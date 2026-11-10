export const KEY = 's/segment-001.mov';

export const VERSIONS = `<ListVersionsResult><Version><Key>${KEY}</Key><VersionId>v2</VersionId></Version>
  <DeleteMarker><Key>${KEY}</Key><VersionId>m1</VersionId></DeleteMarker>
  <Version><Key>${KEY}</Key><VersionId>v1</VersionId></Version>
  <Version><Key>${KEY}.bak</Key><VersionId>other</VersionId></Version></ListVersionsResult>`;
