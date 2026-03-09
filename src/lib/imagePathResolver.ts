/**
 * Image path resolver
 * Resolves hash to full path (original or small) for frontend use
 */

'use client'

// import { resolveImagePath, getImagePaths } from './imageHash'
// import { buildPublicImageUrl } from './storageUrl'

/**
 * Resolve image hash to public URL
 * @param hash - Image hash (stored in database)
 * @param basePath - Base path (e.g., "designs/{designId}" or "chats/{conversationId}")
 * @param size - 'original' or 'small' (default: 'small' for previews, 'original' for modals)
 * @returns Public URL
 */
export function resolveImageUrl(hash: string, basePath: string, size: 'original' | 'small' = 'small'): string {
	// const path = resolveImagePath(hash, basePath, size)
	// return buildPublicImageUrl(path)
	throw new Error('Not implemented')
}

/**
 * Get both URLs (original and small) from a hash
 * @param hash - Image hash
 * @param basePath - Base path
 * @returns Object with original and small URLs
 */
export function getImageUrls(hash: string, basePath: string): { original: string; small: string } {
	// const paths = getImagePaths(hash, basePath)
	// return {
	// 	original: buildPublicImageUrl(paths.original),
	// 	small: buildPublicImageUrl(paths.small),
	// }
	throw new Error('Not implemented')
}

/**
 * Resolve legacy path (for backward compatibility)
 * If path is already a full path, return as-is
 * If path is a hash, resolve it
 */
export function resolveLegacyImageUrl(
	pathOrHash: string,
	basePath: string,
	size: 'original' | 'small' = 'small'
): string {
	// // Check if it's already a full path (contains /original/ or /small/)
	// if (pathOrHash.includes('/original/') || pathOrHash.includes('/small/')) {
	// 	return buildPublicImageUrl(pathOrHash)
	// }

	// // Assume it's a hash and resolve
	// return resolveImageUrl(pathOrHash, basePath, size)

	throw new Error('Not implemented')
}
