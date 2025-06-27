export const ClientToDevtools = 'preact-client-to-devtools';
export const DevtoolsToClient = 'preact-devtools-to-client';
export const ContentScriptName = 'preact-content-script';
export const DevtoolsPanelName = 'preact-devtools-panel';
export const DevtoolsPanelInlineName = 'preact-devtools-panel/inline';
export const PageHookName = 'preact-page-hook';

export const PROFILE_RELOAD = 'preact-devtools_profile-and-reload';
export const STATS_RELOAD = 'preact-devtools_stats-and-reload';

export enum NodeType {
  Element = 1,
  Text = 3,
  CData = 4,
  XMLProcessingInstruction = 7,
  Comment = 8,
  Document = 9,
  DocumentType = 10, // like <!DOCTYPE html>
  DocumentFragment = 11,
}
