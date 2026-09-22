// The eight pictures of the hub - one per area - used in the training course
// and in the "Show me" tour's menu, so both show the same thing.
//
// Cloudflare holds an image for four hours, so a changed picture under the same
// name never reaches anyone: every version gets a new filename. Bump this and
// rename the files in public/images/learn/hub/areas/ together.
export const AREA_IMG_V = "v5";
export const areaImg = (name) => `/images/learn/hub/areas/${name}-${AREA_IMG_V}.jpg`;
