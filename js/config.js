/* SnowBall+ runtime settings. Edit this one file after deploying the backend (see backend/README.md).
 *   apiBase: "https://uiqwynkiu6.execute-api.us-east-2.amazonaws.com"            -> no backend: everything is simulated (the original behaviour).
 *   apiBase: "https://uiqwynkiu6.execute-api.us-east-2.amazonaws.com"              -> same origin (CloudFront routes /api/* to the backend).
 *   apiBase: "https://uiqwynkiu6.execute-api.us-east-2.amazonaws.com"  -> API Gateway URL from the SAM output.
 * If the backend cannot be reached, the app falls back to the simulation and says so in the banner.
 */
/* snowbullApi: URL of the deployed SnowBull service (snowbull/ folder on Vercel), e.g. "https://snowbull.vercel.app".
 *   null -> SnowBull runs in offline mode, using the RAG engine in the browser and the prices shown in SnowBall+.
 * Remember to add the same origin to connect-src in deploy/cloudfront-security-headers.json. */
window.SB_CONFIG = { apiBase: "https://uiqwynkiu6.execute-api.us-east-2.amazonaws.com", snowbullApi: "https://snowbull-daneil-long.vercel.app" };
