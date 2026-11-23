const PUZZLE_IMAGE_EXTENSION = /\.(?:jpe?g|png|tiff?|webp)$/i;

export const isPuzzleSidecar = (name: string) =>
    name.replace(/\\/g, '/').split('/').some((part) => part.startsWith('._') || part === '__MACOSX');

// Validate names after selection: macOS type metadata can misclassify valid JPEGs.
export const isPuzzleImageFile = (file: { name: string }) =>
    !isPuzzleSidecar(file.name) && PUZZLE_IMAGE_EXTENSION.test(file.name);
