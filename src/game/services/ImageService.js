/**
 * ImageService
 * Centralized helpers for sprite creation, scaling, and texture filtering.
 */
export class ImageService {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Create a Phaser image with standardized defaults.
     * @param {number} x - World x.
     * @param {number} y - World y.
     * @param {string} textureKey - Loaded texture key.
     * @param {object} [options]
     * @returns {Phaser.GameObjects.Image}
     */
    createImage(x, y, textureKey, options = {}) {
        const image = this.scene.add.image(x, y, textureKey);

        const originX = options.originX ?? options.origin ?? 0.5;
        const originY = options.originY ?? options.origin ?? 0.5;
        image.setOrigin(originX, originY);

        if (Number.isFinite(options.scale)) {
            image.setScale(options.scale);
        }

        if (Number.isFinite(options.alpha)) {
            image.setAlpha(options.alpha);
        }

        if (typeof options.visible === "boolean") {
            image.setVisible(options.visible);
        }

        if (Number.isFinite(options.depth)) {
            image.setDepth(options.depth);
        }

        if (options.interactive) {
            image.setInteractive(
                typeof options.interactive === "object"
                    ? options.interactive
                    : { useHandCursor: true }
            );
        }

        if (Number.isFinite(options.displayWidth) || Number.isFinite(options.displayHeight)) {
            this.fitImageToBounds(
                image,
                options.displayWidth || image.width,
                options.displayHeight || image.height,
                { allowUpscale: true }
            );
        }

        this.applyLinearFilter(image);
        return image;
    }

    /**
     * Apply linear filtering to avoid nearest-neighbor artifacts.
     * @param {Phaser.GameObjects.Image} image - Sprite/image object.
     */
    applyLinearFilter(image) {
        image?.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
    }

    /**
     * Fit image uniformly inside a bounding box.
     * @param {Phaser.GameObjects.Image} image - Image to resize.
     * @param {number} maxWidth - Max render width in CSS pixels.
     * @param {number} maxHeight - Max render height in CSS pixels.
     * @param {{allowUpscale?: boolean}} [opts]
     * @returns {number} final scale
     */
    fitImageToBounds(image, maxWidth, maxHeight, opts = {}) {
        if (!image?.width || !image?.height) return 1;

        const allowUpscale = opts.allowUpscale !== false;
        let scale = Math.min(maxWidth / image.width, maxHeight / image.height);
        if (!allowUpscale) {
            scale = Math.min(scale, 1);
        }
        image.setScale(scale);
        return scale;
    }

    /**
     * Scale image to target width while preserving aspect ratio.
     * @param {Phaser.GameObjects.Image} image - Image to resize.
     * @param {number} targetWidth - Desired display width.
     * @returns {number} final scale
     */
    setScaleFromWidth(image, targetWidth) {
        if (!image?.width || !Number.isFinite(targetWidth) || targetWidth <= 0) return 1;
        const scale = targetWidth / image.width;
        image.setScale(scale);
        return scale;
    }

    /**
     * Scale image to fit in a square box.
     * @param {Phaser.GameObjects.Image} image - Image to resize.
     * @param {number} maxDimension - Max width/height.
     * @param {{allowUpscale?: boolean}} [opts]
     * @returns {number} final scale
     */
    setScaleFromMaxDimension(image, maxDimension, opts = {}) {
        return this.fitImageToBounds(image, maxDimension, maxDimension, opts);
    }
}
