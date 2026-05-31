import { UTApi } from "uploadthing/server";

/** 
 * Automatically picks up UPLOADTHING_SECRET and UPLOADTHING_APP_ID (legacy) 
 * or UPLOADTHING_TOKEN (v7) from environment variables.
 */
export const utapi = new UTApi();
