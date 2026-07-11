/**
 * @deprecated Import from specific modules instead:
 * - ./doc-find.js     (handleFindDocs, findDocsInDir)
 * - ./doc-search.js   (handleSearchDocs, handleSemanticSearch, handleFindRelated)
 * - ./doc-inspect.js  (handleReadFile, handleSummarizeDoc, handleCheckStale, handleGetContext)
 * - ./doc-coverage.js (handleMeasureCoverage)
 */
export { handleFindDocs, findDocsInDir } from "./doc-find.js";
export { handleSearchDocs, handleSemanticSearch, handleFindRelated } from "./doc-search.js";
export { handleReadFile, handleSummarizeDoc, handleCheckStale, handleGetContext } from "./doc-inspect.js";
export { handleMeasureCoverage } from "./doc-coverage.js";
