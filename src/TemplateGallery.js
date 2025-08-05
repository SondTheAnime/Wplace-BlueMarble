/**
 * TemplateGallery - Modal gallery interface for managing loaded templates
 * 
 * Provides a visual gallery interface that allows users to view, manage,
 * and interact with all loaded templates in the Blue Marble system.
 */
export default class TemplateGallery {
    /**
     * Creates a new TemplateGallery instance
     * @param {Object} templateManager - TemplateManager instance for accessing templates
     * @param {Object} overlay - Overlay instance for modal functionality
     */
    constructor(templateManager, overlay) {
        this.templateManager = templateManager;
        this.overlay = overlay;
        this.isVisible = false;
        this.galleryElement = null;
        this.templateCards = new Map(); // Cache for template cards
        this.thumbnailCache = new Map(); // Cache for generated thumbnails

        // Bind methods to preserve context
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.refresh = this.refresh.bind(this);
        this.handleTemplateToggle = this.handleTemplateToggle.bind(this);
        this.handleTemplateRemove = this.handleTemplateRemove.bind(this);
        this.handleTemplateNavigate = this.handleTemplateNavigate.bind(this);
        this.createTemplateCard = this.createTemplateCard.bind(this);
        this.generateThumbnail = this.generateThumbnail.bind(this);
        this.clearThumbnailCache = this.clearThumbnailCache.bind(this);
        this.preloadThumbnails = this.preloadThumbnails.bind(this);
        this.updateThumbnail = this.updateThumbnail.bind(this);
        this.updateTemplateCardVisualState = this.updateTemplateCardVisualState.bind(this);
        this.showRemoveConfirmationDialog = this.showRemoveConfirmationDialog.bind(this);
        this.confirmTemplateRemoval = this.confirmTemplateRemoval.bind(this);
        this.removeTemplateCardFromDisplay = this.removeTemplateCardFromDisplay.bind(this);
        this.updateExistingTemplateCard = this.updateExistingTemplateCard.bind(this);
        this.reorderTemplateCards = this.reorderTemplateCards.bind(this);
        this.setupAutomaticRefresh = this.setupAutomaticRefresh.bind(this);
        this.setupStateSynchronization = this.setupStateSynchronization.bind(this);
        this.syncTemplateStates = this.syncTemplateStates.bind(this);
        this.detectTemplateChanges = this.detectTemplateChanges.bind(this);
        this.updateTemplateState = this.updateTemplateState.bind(this);
        this.cleanup = this.cleanup.bind(this);

        // State synchronization tracking
        this.lastKnownTemplateState = new Map(); // Track template states for change detection
        this.syncInterval = null; // Interval for periodic state synchronization
        this.isDestroyed = false; // Flag to prevent operations after cleanup

        // Set up automatic refresh when templates are added/removed
        this.setupAutomaticRefresh();
        
        // Set up state synchronization system
        this.setupStateSynchronization();
    }

    /**
     * Shows the template gallery modal
     * Requirements: 1.1, 5.1, 5.2, 5.3
     */
    show() {
        if (this.isVisible) return;

        // Create gallery modal if it doesn't exist
        if (!this.galleryElement) {
            this.createGalleryModal();
        }

        // Refresh template list
        this.refresh();

        this.isVisible = true;
    }

    /**
     * Hides the template gallery modal
     * Implements proper cleanup when gallery is closed
     * Requirements: 5.1, 5.2, 5.3, 3.4
     */
    hide() {
        if (!this.isVisible || !this.galleryElement) return;

        // Perform cleanup before hiding
        this.cleanup();

        // Use the Overlay class closeModal method for proper cleanup
        this.overlay.closeModal(this.galleryElement);

        this.isVisible = false;
        this.galleryElement = null; // Reset reference since modal is removed from DOM
    }

    /**
     * Refreshes the template gallery with current templates
     * Updates the display to reflect current state of templateManager
     * Implements efficient re-rendering to avoid unnecessary DOM updates
     * Requirements: 1.4, 3.4
     */
    refresh() {
        if (!this.galleryElement) return;

        const contentArea = this.galleryElement.querySelector('#bm-gallery-content');
        const templateGrid = contentArea.querySelector('.bm-template-grid');
        const emptyState = contentArea.querySelector('#bm-gallery-empty');
        const countElement = this.galleryElement.querySelector('#bm-gallery-count');

        // Get templates from templateManager
        const templates = this.templateManager.templatesArray || [];
        const templateIds = new Set(templates.map(template => this.getTemplateId(template)));

        // Update template count in header
        if (countElement) {
            const count = templates.length;
            countElement.textContent = count === 1 ? '1 template' : `${count} templates`;
        }

        // Handle empty state display
        if (templates.length === 0) {
            // Show empty state
            templateGrid.style.display = 'none';
            emptyState.style.display = 'block';
            
            // Clear all cached cards since there are no templates
            this.templateCards.clear();
            templateGrid.innerHTML = '';
            
            console.log('Gallery refresh: Showing empty state');
            return;
        }

        // Hide empty state and show templates
        emptyState.style.display = 'none';
        templateGrid.style.display = 'grid';

        // Efficient re-rendering: Remove cards for templates that no longer exist
        const cardsToRemove = [];
        this.templateCards.forEach((card, templateId) => {
            if (!templateIds.has(templateId)) {
                cardsToRemove.push(templateId);
                // Remove card from DOM
                if (card.parentNode) {
                    card.parentNode.removeChild(card);
                }
            }
        });

        // Clean up cache for removed templates
        cardsToRemove.forEach(templateId => {
            this.templateCards.delete(templateId);
            this.clearThumbnailCache(templateId);
        });

        // Efficient re-rendering: Add or update cards for current templates
        const newTemplates = [];
        templates.forEach(template => {
            const templateId = this.getTemplateId(template);
            const existingCard = this.templateCards.get(templateId);

            if (!existingCard) {
                // New template - needs to be added
                newTemplates.push(template);
            } else {
                // Existing template - update visual state if needed
                this.updateExistingTemplateCard(templateId, template);
            }
        });

        // Preload thumbnails for new templates only
        if (newTemplates.length > 0) {
            this.preloadThumbnails(newTemplates);
            console.log(`Gallery refresh: Adding ${newTemplates.length} new template cards`);
        }

        // Create and append cards for new templates
        newTemplates.forEach(template => {
            const card = this.createTemplateCard(template);
            templateGrid.appendChild(card);
        });

        // Ensure proper grid order by sorting existing cards
        this.reorderTemplateCards(templates);

        console.log(`Gallery refresh completed: ${templates.length} templates, ${newTemplates.length} new, ${cardsToRemove.length} removed`);
    }

    /**
     * Creates the main gallery modal structure
     * Uses the Overlay class modal functionality for consistent styling and behavior
     * Requirements: 1.1, 1.4
     */
    createGalleryModal() {
        // Use the Overlay class to create a modal with proper backdrop and close functionality
        this.overlay.createModal(
            {
                'id': 'bm-gallery-overlay',
                'className': 'bm-modal-backdrop bm-gallery-backdrop'
            },
            {
                'id': 'bm-gallery-container',
                'className': 'bm-modal-content bm-gallery-content',
                'style': `
                    background-color: rgba(21, 48, 99, 0.95);
                    color: white;
                    border-radius: 8px;
                    padding: 0;
                    max-width: min(95vw, 1200px);
                    max-height: min(90vh, 800px);
                    width: 90vw;
                    height: 80vh;
                    overflow: hidden;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
                    letter-spacing: 0.05em;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                `
            },
            () => {
                this.hide();
            }
        )
            // Add modal close button
            .addModalCloseButton().buildElement()

            // Add gallery header
            .addDiv({
                'id': 'bm-gallery-header',
                'className': 'bm-gallery-header',
                'style': `
                padding: 20px 20px 15px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            `
            })
            .addHeader(2, {
                'textContent': 'Template Gallery',
                'style': `
                    margin: 0;
                    font-size: 1.5em;
                    font-weight: bold;
                    color: white;
                `
            }).buildElement()
            .addDiv({
                'className': 'bm-gallery-header-info',
                'style': `
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    font-size: 0.9em;
                    color: rgba(255, 255, 255, 0.8);
                `
            })
            .addSmall({
                'id': 'bm-gallery-count',
                'textContent': '0 templates',
                'style': 'margin: 0;'
            }).buildElement()
            .addButton({
                'id': 'bm-gallery-help',
                'textContent': '?',
                'title': 'Gallery Help',
                'style': `
                    background-color: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    color: white;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                `
            }).buildElement()
            .buildElement()
            .buildElement()

            // Add gallery content area
            .addDiv({
                'id': 'bm-gallery-content',
                'className': 'bm-gallery-content-area',
                'style': `
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                position: relative;
            `
            })
            // Add template grid container
            .addDiv({
                'className': 'bm-template-grid',
                'style': `
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                    min-height: 200px;
                `
            }).buildElement()

            // Add empty state placeholder
            .addDiv({
                'id': 'bm-gallery-empty',
                'className': 'bm-empty-state',
                'style': `
                    display: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 1.1em;
                `
            })
            .addDiv({
                'style': `
                        font-size: 3em;
                        margin-bottom: 15px;
                        opacity: 0.5;
                    `,
                'textContent': '📁'
            }).buildElement()
            .addP({
                'textContent': 'No templates loaded',
                'style': `
                        margin: 0 0 10px 0;
                        font-weight: bold;
                    `
            }).buildElement()
            .addSmall({
                'textContent': 'Load a template using the file upload button to start using the gallery',
                'style': `
                        margin: 0 0 10px 0;
                        opacity: 0.8;
                        line-height: 1.3;
                    `
            }).buildElement()
            .addSmall({
                'textContent': 'Templates will appear here with thumbnails and management controls',
                'style': `
                        margin: 0;
                        opacity: 0.6;
                        font-size: 0.9em;
                    `
            }).buildElement()
            .buildElement()
            .buildElement()

            // Build the modal and append to document body
            .buildOverlay(document.body);

        // Store reference to the modal element for later use
        this.galleryElement = document.getElementById('bm-gallery-overlay');

        // Add help button functionality
        const helpButton = this.galleryElement.querySelector('#bm-gallery-help');
        if (helpButton) {
            // Add hover effect
            helpButton.addEventListener('mouseenter', () => {
                helpButton.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                helpButton.style.transform = 'scale(1.1)';
            });
            
            helpButton.addEventListener('mouseleave', () => {
                helpButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                helpButton.style.transform = 'scale(1)';
            });

            // Add click handler for help
            helpButton.addEventListener('click', () => {
                this.showGalleryHelp();
            });

            // Add comprehensive tooltip
            this.addTooltip(helpButton, 'Click for gallery usage instructions and keyboard shortcuts', 'bottom');
        }
    }

    /**
     * Generates a thumbnail for a template using createImageBitmap
     * Creates a 100x100px thumbnail with nearest-neighbor filtering for pixel art
     * Handles thumbnail generation failures with placeholder icons
     * Requirements: 1.2
     * @param {Object} template - Template object from templateManager
     * @returns {Promise<HTMLCanvasElement|null>} Canvas element with thumbnail or null if failed
     */
    async generateThumbnail(template) {
        let templateId = 'unknown';
        
        try {
            // Validate template parameter
            if (!template || typeof template !== 'object') {
                console.error('Invalid template object provided to generateThumbnail:', template);
                return null;
            }

            // Extract template ID using helper method
            templateId = this.getTemplateId(template);

            // Check cache first for performance optimization
            if (this.thumbnailCache.has(templateId)) {
                const cachedThumbnail = this.thumbnailCache.get(templateId);
                console.log(`Using cached thumbnail for template ${templateId}`);
                return cachedThumbnail;
            }

            // Validate template has a file to generate thumbnail from
            if (!template.file) {
                console.warn(`Template ${templateId} has no file for thumbnail generation`);
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Validate file is a valid image-like object
            if (typeof template.file !== 'object' || !template.file) {
                console.error(`Template ${templateId} file is not a valid object:`, typeof template.file);
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Create bitmap from template file with error handling
            let sourceBitmap;
            try {
                sourceBitmap = await createImageBitmap(template.file);
            } catch (bitmapError) {
                console.error(`Failed to create bitmap for template ${templateId}:`, bitmapError);
                
                // Provide specific error messages for common bitmap creation failures
                if (bitmapError.name === 'InvalidStateError') {
                    console.error(`Template ${templateId} file is in invalid state for bitmap creation`);
                } else if (bitmapError.name === 'SecurityError') {
                    console.error(`Security error creating bitmap for template ${templateId}`);
                } else if (bitmapError.name === 'TypeError') {
                    console.error(`Template ${templateId} file is not a valid image source`);
                }
                
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Validate bitmap dimensions
            if (!sourceBitmap.width || !sourceBitmap.height || 
                sourceBitmap.width <= 0 || sourceBitmap.height <= 0) {
                console.error(`Template ${templateId} has invalid bitmap dimensions: ${sourceBitmap.width}x${sourceBitmap.height}`);
                sourceBitmap.close(); // Clean up bitmap
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Check for reasonable size limits to prevent memory issues
            const maxDimension = 10000; // Reasonable limit for source images
            if (sourceBitmap.width > maxDimension || sourceBitmap.height > maxDimension) {
                console.warn(`Template ${templateId} has very large dimensions: ${sourceBitmap.width}x${sourceBitmap.height}, may cause performance issues`);
            }

            // Create thumbnail canvas with fixed 100x100px size
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 100;
            thumbnailCanvas.height = 100;

            const ctx = thumbnailCanvas.getContext('2d');
            if (!ctx) {
                console.error(`Failed to get 2D context for thumbnail canvas for template ${templateId}`);
                sourceBitmap.close();
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Configure nearest-neighbor filtering for pixel art
            ctx.imageSmoothingEnabled = false;
            if (ctx.imageSmoothingQuality) {
                ctx.imageSmoothingQuality = 'high';
            }

            // Calculate scaling to fit within 100x100 while maintaining aspect ratio
            const sourceWidth = sourceBitmap.width;
            const sourceHeight = sourceBitmap.height;
            const maxSize = 100;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (sourceWidth > sourceHeight) {
                // Landscape orientation
                drawWidth = maxSize;
                drawHeight = (sourceHeight / sourceWidth) * maxSize;
                offsetX = 0;
                offsetY = (maxSize - drawHeight) / 2;
            } else {
                // Portrait or square orientation
                drawHeight = maxSize;
                drawWidth = (sourceWidth / sourceHeight) * maxSize;
                offsetX = (maxSize - drawWidth) / 2;
                offsetY = 0;
            }

            // Validate calculated dimensions
            if (drawWidth <= 0 || drawHeight <= 0 || !isFinite(drawWidth) || !isFinite(drawHeight)) {
                console.error(`Invalid calculated dimensions for template ${templateId}: ${drawWidth}x${drawHeight}`);
                sourceBitmap.close();
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            try {
                // Clear canvas with transparent background
                ctx.clearRect(0, 0, 100, 100);

                // Draw scaled image centered in canvas
                ctx.drawImage(
                    sourceBitmap,
                    0, 0, sourceWidth, sourceHeight,  // Source rectangle
                    offsetX, offsetY, drawWidth, drawHeight  // Destination rectangle
                );

            } catch (drawError) {
                console.error(`Failed to draw image for template ${templateId}:`, drawError);
                sourceBitmap.close();
                this.thumbnailCache.set(templateId, null);
                return null;
            }

            // Clean up source bitmap
            sourceBitmap.close();

            // Cache the generated thumbnail
            this.thumbnailCache.set(templateId, thumbnailCanvas);

            console.log(`Generated thumbnail for template ${templateId} (${sourceWidth}x${sourceHeight} -> ${Math.round(drawWidth)}x${Math.round(drawHeight)})`);

            return thumbnailCanvas;

        } catch (error) {
            console.error(`Unexpected error generating thumbnail for template ${templateId}:`, error);

            // Provide specific error context
            let errorContext = 'Unknown error';
            if (error.name === 'TypeError') {
                errorContext = 'Type error - invalid data format';
            } else if (error.name === 'ReferenceError') {
                errorContext = 'Reference error - missing dependencies';
            } else if (error.name === 'RangeError') {
                errorContext = 'Range error - invalid dimensions';
            } else if (error.message) {
                errorContext = error.message;
            }

            console.error(`Thumbnail generation failed for ${templateId}: ${errorContext}`);

            // Cache null result to avoid repeated failed attempts
            this.thumbnailCache.set(templateId, null);

            return null;
        }
    }

    /**
     * Clears the thumbnail cache for a specific template or all templates
     * Useful when templates are updated or removed
     * @param {string} [templateId] - Optional template ID to clear specific thumbnail, omit to clear all
     */
    clearThumbnailCache(templateId = null) {
        if (templateId) {
            // Clear specific template thumbnail
            if (this.thumbnailCache.has(templateId)) {
                this.thumbnailCache.delete(templateId);
                console.log(`Cleared thumbnail cache for template ${templateId}`);
            }
        } else {
            // Clear all thumbnails
            const cacheSize = this.thumbnailCache.size;
            this.thumbnailCache.clear();
            console.log(`Cleared all thumbnail cache (${cacheSize} items)`);
        }
    }

    /**
     * Preloads thumbnails for all templates to improve gallery performance
     * Called when gallery is opened to ensure smooth thumbnail display
     * @param {Array} templates - Array of template objects to preload thumbnails for
     */
    async preloadThumbnails(templates) {
        if (!templates || templates.length === 0) return;

        console.log(`Preloading thumbnails for ${templates.length} templates...`);

        // Generate thumbnails in parallel for better performance
        const thumbnailPromises = templates.map(template =>
            this.generateThumbnail(template).catch(error => {
                const templateId = this.getTemplateId(template);
                console.warn(`Failed to preload thumbnail for template ${templateId}:`, error);
                return null;
            })
        );

        try {
            await Promise.all(thumbnailPromises);
            console.log('Thumbnail preloading completed');
        } catch (error) {
            console.error('Error during thumbnail preloading:', error);
        }
    }

    /**
     * Updates thumbnail for a specific template (useful when template is modified)
     * Clears cached thumbnail and regenerates it
     * @param {string} templateId - ID of template to update thumbnail for
     * @param {Object} template - Updated template object
     */
    async updateThumbnail(templateId, template) {
        // Clear existing cached thumbnail
        this.clearThumbnailCache(templateId);

        // Generate new thumbnail
        const newThumbnail = await this.generateThumbnail(template);

        // Update any existing cards that display this template
        const existingCard = this.templateCards.get(templateId);
        if (existingCard) {
            const thumbnailArea = existingCard.querySelector('.bm-template-thumbnail');
            const existingCanvas = thumbnailArea.querySelector('.bm-thumbnail-canvas');
            const placeholder = thumbnailArea.querySelector('.bm-thumbnail-placeholder');

            if (existingCanvas) {
                existingCanvas.remove();
            }

            if (newThumbnail) {
                newThumbnail.className = 'bm-thumbnail-canvas';
                newThumbnail.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                `;

                thumbnailArea.appendChild(newThumbnail);
                placeholder.style.display = 'none';
            } else {
                // Show error placeholder
                placeholder.style.display = 'block';
                placeholder.textContent = '❌';
                placeholder.title = 'Failed to generate thumbnail';
            }
        }

        console.log(`Updated thumbnail for template ${templateId}`);
    }

    /**
     * Creates a template card element for a given template
     * Generates a comprehensive card with thumbnail, info, and controls
     * Requirements: 1.2, 1.3, 6.1, 6.2, 6.3, 6.4
     * @param {Object} template - Template object from templateManager
     * @returns {HTMLElement} Template card element
     */
    createTemplateCard(template) {
        // Extract template data with fallbacks
        const templateId = this.getTemplateId(template);
        const templateName = template.displayName || 'Unnamed Template';
        const templateCoords = template.coords || [0, 0, 0, 0];
        const pixelCount = template.pixelCount || 0;

        // Calculate dimensions from template file if available
        let dimensions = 'Unknown';
        let dimensionsWidth = 0;
        let dimensionsHeight = 0;

        if (template.file && template.file.width && template.file.height) {
            dimensionsWidth = template.file.width;
            dimensionsHeight = template.file.height;
            dimensions = `${dimensionsWidth}×${dimensionsHeight}`;
        } else if (template.chunked) {
            // Try to calculate dimensions from chunked tiles
            const tileKeys = Object.keys(template.chunked);
            if (tileKeys.length > 0) {
                // Parse tile coordinates to estimate dimensions
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                tileKeys.forEach(tileKey => {
                    const parts = tileKey.split(',');
                    if (parts.length === 4) {
                        const tileX = parseInt(parts[0]);
                        const tileY = parseInt(parts[1]);
                        const pixelX = parseInt(parts[2]);
                        const pixelY = parseInt(parts[3]);

                        const absoluteX = tileX * 1000 + pixelX;
                        const absoluteY = tileY * 1000 + pixelY;

                        minX = Math.min(minX, absoluteX);
                        minY = Math.min(minY, absoluteY);
                        maxX = Math.max(maxX, absoluteX);
                        maxY = Math.max(maxY, absoluteY);
                    }
                });

                if (minX !== Infinity && maxX !== -Infinity) {
                    dimensionsWidth = maxX - minX + 1;
                    dimensionsHeight = maxY - minY + 1;
                    dimensions = `${dimensionsWidth}×${dimensionsHeight}`;
                }
            }
        }

        // Format pixel count with locale-appropriate thousands separators
        const pixelCountFormatted = new Intl.NumberFormat().format(pixelCount);

        // Format coordinates display
        const coordsDisplay = `Tile: ${templateCoords[0]},${templateCoords[1]} Pixel: ${templateCoords[2]},${templateCoords[3]}`;

        // Determine if template is enabled (check templatesJSON for current state)
        let isEnabled = true;
        if (this.templateManager.templatesJSON &&
            this.templateManager.templatesJSON.templates &&
            this.templateManager.templatesJSON.templates[templateId]) {
            isEnabled = this.templateManager.templatesJSON.templates[templateId].enabled !== false;
        }

        // Create card element
        const card = document.createElement('div');
        card.className = 'bm-template-card';
        card.dataset.templateId = templateId;

        // Apply card styling
        card.style.cssText = `
            background-color: rgba(0, 0, 0, 0.3);
            border: 1px solid ${isEnabled ? '#1061e5' : 'rgba(255, 255, 255, 0.2)'};
            border-radius: 8px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: all 0.2s ease;
            cursor: pointer;
            position: relative;
            min-height: 200px;
        `;

        // Create thumbnail area
        const thumbnailArea = document.createElement('div');
        thumbnailArea.className = 'bm-template-thumbnail';
        thumbnailArea.style.cssText = `
            width: 100%;
            height: 100px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        `;

        // Create placeholder icon (shown while loading or on failure)
        const placeholderIcon = document.createElement('div');
        placeholderIcon.className = 'bm-thumbnail-placeholder';
        placeholderIcon.textContent = '📷';
        placeholderIcon.style.cssText = `
            font-size: 2em;
            opacity: 0.5;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
        `;

        thumbnailArea.appendChild(placeholderIcon);

        // Generate thumbnail asynchronously
        this.generateThumbnail(template).then(thumbnailCanvas => {
            if (thumbnailCanvas) {
                // Successfully generated thumbnail
                thumbnailCanvas.className = 'bm-thumbnail-canvas';
                thumbnailCanvas.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                `;

                // Add thumbnail to area and hide placeholder
                thumbnailArea.appendChild(thumbnailCanvas);
                placeholderIcon.style.display = 'none';

                console.log(`Thumbnail loaded for template ${templateId}`);
            } else {
                // Failed to generate thumbnail, keep placeholder visible
                console.warn(`Using placeholder for template ${templateId} - thumbnail generation failed`);

                // Update placeholder to indicate failure
                placeholderIcon.textContent = '❌';
                placeholderIcon.title = 'Failed to generate thumbnail';
            }
        }).catch(error => {
            console.error(`Error loading thumbnail for template ${templateId}:`, error);

            // Show error placeholder
            placeholderIcon.textContent = '❌';
            placeholderIcon.title = 'Failed to generate thumbnail';
        });

        // Create info section
        const infoSection = document.createElement('div');
        infoSection.className = 'bm-template-info';
        infoSection.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        // Template name
        const nameElement = document.createElement('h3');
        nameElement.className = 'bm-template-name';
        nameElement.textContent = templateName;
        nameElement.style.cssText = `
            margin: 0;
            font-size: 1em;
            font-weight: 500;
            color: white;
            word-wrap: break-word;
            line-height: 1.2;
        `;

        // Template stats (dimensions and pixel count)
        const statsElement = document.createElement('p');
        statsElement.className = 'bm-template-stats';
        statsElement.style.cssText = `
            margin: 0;
            font-size: 0.85em;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.3;
        `;

        const dimensionsSpan = document.createElement('span');
        dimensionsSpan.className = 'bm-dimensions';
        dimensionsSpan.textContent = dimensions;
        dimensionsSpan.style.cssText = `
            display: block;
            margin-bottom: 2px;
        `;

        const pixelCountSpan = document.createElement('span');
        pixelCountSpan.className = 'bm-pixel-count';
        pixelCountSpan.textContent = `${pixelCountFormatted} pixels`;
        pixelCountSpan.style.cssText = `
            display: block;
            font-weight: 500;
        `;

        statsElement.appendChild(dimensionsSpan);
        statsElement.appendChild(pixelCountSpan);

        // Template coordinates
        const coordsElement = document.createElement('p');
        coordsElement.className = 'bm-template-coords';
        coordsElement.textContent = coordsDisplay;
        coordsElement.style.cssText = `
            margin: 0;
            font-size: 0.75em;
            color: rgba(255, 255, 255, 0.6);
            font-family: 'Roboto Mono', 'Courier New', monospace;
            word-break: break-all;
        `;

        // Assemble info section
        infoSection.appendChild(nameElement);
        infoSection.appendChild(statsElement);
        infoSection.appendChild(coordsElement);

        // Create controls section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'bm-template-controls';
        controlsSection.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            align-items: center;
            margin-top: auto;
        `;

        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'bm-toggle-btn';
        toggleBtn.dataset.enabled = isEnabled.toString();
        toggleBtn.title = isEnabled ? 'Disable template' : 'Enable template';
        toggleBtn.style.cssText = `
            background-color: ${isEnabled ? '#1061e5' : 'rgba(255, 255, 255, 0.2)'};
            border: none;
            border-radius: 4px;
            padding: 8px 10px;
            color: white;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.2s ease;
            min-width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'bm-toggle-icon';
        toggleIcon.textContent = isEnabled ? '👁' : '👁‍🗨';
        toggleBtn.appendChild(toggleIcon);

        // Navigate button
        const navigateBtn = document.createElement('button');
        navigateBtn.className = 'bm-navigate-btn';
        navigateBtn.title = 'Set coordinates to template';
        navigateBtn.style.cssText = `
            background-color: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 4px;
            padding: 8px 10px;
            color: white;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.2s ease;
            min-width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const navigateIcon = document.createElement('span');
        navigateIcon.className = 'bm-navigate-icon';
        navigateIcon.textContent = '📍';
        navigateBtn.appendChild(navigateIcon);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'bm-remove-btn';
        removeBtn.title = 'Remove template';
        removeBtn.style.cssText = `
            background-color: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 4px;
            padding: 8px 10px;
            color: white;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.2s ease;
            min-width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const removeIcon = document.createElement('span');
        removeIcon.className = 'bm-remove-icon';
        removeIcon.textContent = '🗑';
        removeBtn.appendChild(removeIcon);

        // Add hover effects
        const addHoverEffect = (button, hoverColor) => {
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = hoverColor;
                button.style.transform = 'translateY(-1px)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = button.className.includes('toggle') && isEnabled ?
                    '#1061e5' : 'rgba(255, 255, 255, 0.2)';
                button.style.transform = 'translateY(0)';
            });
        };

        addHoverEffect(toggleBtn, '#1061e5');
        addHoverEffect(navigateBtn, '#1061e5');
        addHoverEffect(removeBtn, '#dc3545');

        // Add event listeners
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTemplateToggle(templateId);
        });

        navigateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTemplateNavigate(templateId);
        });

        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTemplateRemove(templateId);
        });

        // Add comprehensive tooltips to control buttons
        this.addTooltip(toggleBtn, 
            isEnabled ? 'Disable template (hide from canvas)' : 'Enable template (show on canvas)', 
            'top'
        );
        
        this.addTooltip(navigateBtn, 
            'Navigate to template location (set coordinates and close gallery)', 
            'top'
        );
        
        this.addTooltip(removeBtn, 
            'Remove template permanently (cannot be undone)', 
            'top'
        );

        // Add card hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        // Assemble controls section
        controlsSection.appendChild(toggleBtn);
        controlsSection.appendChild(navigateBtn);
        controlsSection.appendChild(removeBtn);

        // Assemble final card
        card.appendChild(thumbnailArea);
        card.appendChild(infoSection);
        card.appendChild(controlsSection);

        // Cache the card
        this.templateCards.set(templateId, card);

        return card;
    }

    /**
     * Handles template toggle (enable/disable) action
     * Integrates with TemplateManager to enable/disable templates and updates visual state
     * Requirements: 2.1, 2.2, 2.3, 2.4
     * @param {string} templateId - ID of template to toggle
     */
    handleTemplateToggle(templateId) {
        // Find the template card for loading indicator
        const card = this.templateCards.get(templateId);
        const toggleBtn = card?.querySelector('.bm-toggle-btn');
        
        try {
            // Show loading indicator
            if (toggleBtn) {
                this.showButtonLoadingState(toggleBtn, 'Toggling...');
            }

            // Validate templateId parameter
            if (!templateId || typeof templateId !== 'string') {
                console.error('Invalid template ID provided to handleTemplateToggle:', templateId);
                this.overlay.handleDisplayError('Invalid template ID provided');
                return;
            }

            // Ensure templateManager is available
            if (!this.templateManager) {
                console.error('TemplateManager not available');
                this.overlay.handleDisplayError('Template system not available');
                return;
            }

            // Ensure templatesJSON exists
            if (!this.templateManager.templatesJSON || 
                !this.templateManager.templatesJSON.templates || 
                !this.templateManager.templatesJSON.templates[templateId]) {
                console.error(`Template ${templateId} not found in templatesJSON`);
                this.overlay.handleDisplayError(`Template not found in system`);
                return;
            }

            // Get template information for better error messages
            const template = this.templateManager.templatesJSON.templates[templateId];
            const templateName = template.name || template.displayName || 'Unnamed Template';

            // Get current enabled state
            const currentState = template.enabled !== false;
            const newState = !currentState;

            // Update enabled state in templatesJSON
            template.enabled = newState;

            console.log(`Template ${templateId} (${templateName}) ${newState ? 'enabled' : 'disabled'}`);

            // Update visual state immediately
            this.updateTemplateCardVisualState(templateId, newState);

            // Display success message with template name
            this.overlay.handleDisplayStatus(
                `✓ ${templateName} ${newState ? 'enabled' : 'disabled'} successfully`
            );

        } catch (error) {
            console.error(`Error toggling template ${templateId}:`, error);
            
            // Provide more specific error messages based on error type
            let errorMessage = 'Failed to toggle template';
            if (error.name === 'TypeError') {
                errorMessage = 'Template data is corrupted or invalid';
            } else if (error.message.includes('permission')) {
                errorMessage = 'Permission denied when updating template';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error while updating template';
            } else if (error.message) {
                errorMessage = `Failed to toggle template: ${error.message}`;
            }
            
            this.overlay.handleDisplayError(errorMessage);
        } finally {
            // Clear loading indicator
            if (toggleBtn) {
                this.clearButtonLoadingState(toggleBtn);
            }
        }
    }

    /**
     * Updates the visual state of a template card to reflect its enabled/disabled status
     * Changes toggle button appearance, card border, and icon state
     * Requirements: 2.4
     * @param {string} templateId - ID of template to update visual state for
     * @param {boolean} isEnabled - New enabled state of the template
     */
    updateTemplateCardVisualState(templateId, isEnabled) {
        // Find the template card in the cached cards
        const card = this.templateCards.get(templateId);
        if (!card) {
            console.warn(`Template card ${templateId} not found in cache`);
            return;
        }

        // Update card border to reflect enabled state
        card.style.borderColor = isEnabled ? '#1061e5' : 'rgba(255, 255, 255, 0.2)';

        // Find and update the toggle button
        const toggleBtn = card.querySelector('.bm-toggle-btn');
        if (toggleBtn) {
            // Update button data attribute
            toggleBtn.dataset.enabled = isEnabled.toString();
            
            // Update button title/tooltip
            toggleBtn.title = isEnabled ? 'Disable template' : 'Enable template';
            
            // Update button background color
            toggleBtn.style.backgroundColor = isEnabled ? '#1061e5' : 'rgba(255, 255, 255, 0.2)';
            
            // Update toggle icon
            const toggleIcon = toggleBtn.querySelector('.bm-toggle-icon');
            if (toggleIcon) {
                toggleIcon.textContent = isEnabled ? '👁' : '👁‍🗨';
            }

            // Update hover effect to use correct base color
            const updateHoverEffect = () => {
                toggleBtn.removeEventListener('mouseenter', updateHoverEffect);
                toggleBtn.removeEventListener('mouseleave', updateHoverEffect);
                
                toggleBtn.addEventListener('mouseenter', () => {
                    toggleBtn.style.backgroundColor = '#1061e5';
                    toggleBtn.style.transform = 'translateY(-1px)';
                });
                
                toggleBtn.addEventListener('mouseleave', () => {
                    toggleBtn.style.backgroundColor = isEnabled ? '#1061e5' : 'rgba(255, 255, 255, 0.2)';
                    toggleBtn.style.transform = 'translateY(0)';
                });
            };
            
            updateHoverEffect();
        }

        console.log(`Updated visual state for template ${templateId}: ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Handles template removal action
     * Shows confirmation dialog and removes template if confirmed
     * Requirements: 3.1, 3.2, 3.3, 3.4
     * @param {string} templateId - ID of template to remove
     */
    handleTemplateRemove(templateId) {
        try {
            // Validate templateId parameter
            if (!templateId || typeof templateId !== 'string') {
                console.error('Invalid template ID provided to handleTemplateRemove:', templateId);
                this.overlay.handleDisplayError('Invalid template ID provided');
                return;
            }

            // Ensure templateManager is available
            if (!this.templateManager) {
                console.error('TemplateManager not available');
                this.overlay.handleDisplayError('Template system not available');
                return;
            }

            // Get template information for confirmation dialog
            const template = this.templateManager.templatesJSON?.templates?.[templateId];
            if (!template) {
                console.error(`Template ${templateId} not found in system`);
                this.overlay.handleDisplayError('Template not found in system');
                return;
            }

            const templateName = template.name || template.displayName || 'Unnamed Template';

            // Show confirmation dialog
            this.showRemoveConfirmationDialog(templateId, templateName);

        } catch (error) {
            console.error(`Error initiating template removal for ${templateId}:`, error);
            
            // Provide more specific error messages
            let errorMessage = 'Failed to initiate template removal';
            if (error.name === 'TypeError') {
                errorMessage = 'Template data is corrupted or invalid';
            } else if (error.message.includes('permission')) {
                errorMessage = 'Permission denied when accessing template';
            } else if (error.message) {
                errorMessage = `Failed to remove template: ${error.message}`;
            }
            
            this.overlay.handleDisplayError(errorMessage);
        }
    }

    /**
     * Shows a confirmation dialog for template removal
     * Creates a modal dialog with confirm/cancel options
     * Requirements: 3.1
     * @param {string} templateId - ID of template to remove
     * @param {string} templateName - Display name of template
     */
    showRemoveConfirmationDialog(templateId, templateName) {
        // Create confirmation modal
        this.overlay.createModal(
            {
                'id': 'bm-remove-confirmation-modal',
                'className': 'bm-modal-backdrop bm-remove-confirmation-backdrop'
            },
            {
                'id': 'bm-remove-confirmation-content',
                'className': 'bm-modal-content bm-remove-confirmation-content',
                'style': `
                    background-color: rgba(21, 48, 99, 0.95);
                    color: white;
                    border-radius: 8px;
                    padding: 30px;
                    max-width: 400px;
                    width: 90vw;
                    text-align: center;
                    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
                    letter-spacing: 0.05em;
                    border: 2px solid #dc3545;
                `
            },
            () => {
                // Modal closed without action
                console.log('Remove confirmation dialog closed');
            }
        )
            // Add warning icon
            .addDiv({
                'style': `
                    font-size: 3em;
                    margin-bottom: 15px;
                    color: #dc3545;
                `,
                'textContent': '⚠️'
            }).buildElement()

            // Add confirmation title
            .addHeader(3, {
                'textContent': 'Remove Template',
                'style': `
                    margin: 0 0 15px 0;
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #dc3545;
                `
            }).buildElement()

            // Add confirmation message
            .addP({
                'textContent': `Are you sure you want to remove "${templateName}"?`,
                'style': `
                    margin: 0 0 10px 0;
                    font-size: 1em;
                    line-height: 1.4;
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: bold;
                `
            }).buildElement()
            .addSmall({
                'textContent': 'This action cannot be undone. The template will be permanently removed from your gallery.',
                'style': `
                    color: rgba(255, 255, 255, 0.7);
                    font-style: italic;
                    display: block;
                    margin-bottom: 20px;
                    line-height: 1.3;
                `
            }).buildElement()

            // Add button container
            .addDiv({
                'className': 'bm-confirmation-buttons',
                'style': `
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 25px;
                `
            })

            // Add cancel button
            .addButton({
                'textContent': 'Cancel',
                'className': 'bm-cancel-btn',
                'style': `
                    background-color: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    padding: 10px 20px;
                    color: white;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-family: inherit;
                    transition: all 0.2s ease;
                    min-width: 80px;
                `
            }).buildElement()

            // Add confirm button
            .addButton({
                'textContent': 'Remove',
                'className': 'bm-confirm-remove-btn',
                'style': `
                    background-color: #dc3545;
                    border: 1px solid #dc3545;
                    border-radius: 4px;
                    padding: 10px 20px;
                    color: white;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-family: inherit;
                    transition: all 0.2s ease;
                    min-width: 80px;
                    font-weight: bold;
                `
            }).buildElement()

            .buildElement()

            // Build and show the modal
            .buildOverlay(document.body);

        // Get the modal element and buttons
        const modal = document.getElementById('bm-remove-confirmation-modal');
        const cancelBtn = modal.querySelector('.bm-cancel-btn');
        const confirmBtn = modal.querySelector('.bm-confirm-remove-btn');

        // Add button event listeners
        cancelBtn.addEventListener('click', () => {
            this.overlay.closeModal(modal);
        });

        confirmBtn.addEventListener('click', () => {
            this.overlay.closeModal(modal);
            this.confirmTemplateRemoval(templateId, templateName);
        });

        // Add hover effects
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            cancelBtn.style.transform = 'translateY(-1px)';
        });

        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.backgroundColor = '#c82333';
            confirmBtn.style.transform = 'translateY(-1px)';
        });

        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.backgroundColor = '#dc3545';
            confirmBtn.style.transform = 'translateY(0)';
        });
    }

    /**
     * Confirms and executes template removal
     * Integrates with TemplateManager and updates gallery display
     * Requirements: 3.2, 3.3, 3.4
     * @param {string} templateId - ID of template to remove
     * @param {string} templateName - Display name of template
     */
    confirmTemplateRemoval(templateId, templateName) {
        try {
            // Show loading indicator in status
            this.overlay.handleDisplayStatus(`Removing template "${templateName}"...`);

            // Validate parameters
            if (!templateId || typeof templateId !== 'string') {
                console.error('Invalid template ID provided to confirmTemplateRemoval:', templateId);
                this.overlay.handleDisplayError('Invalid template ID provided');
                return;
            }

            if (!templateName || typeof templateName !== 'string') {
                console.error('Invalid template name provided to confirmTemplateRemoval:', templateName);
                this.overlay.handleDisplayError('Invalid template name provided');
                return;
            }

            // Ensure templateManager is available
            if (!this.templateManager) {
                console.error('TemplateManager not available');
                this.overlay.handleDisplayError('Template system not available');
                return;
            }

            // Verify template still exists before attempting removal
            if (!this.templateManager.templatesJSON?.templates?.[templateId]) {
                console.warn(`Template ${templateId} no longer exists, may have been removed already`);
                this.overlay.handleDisplayStatus(`✓ Template "${templateName}" was already removed`);
                return;
            }

            // Remove template using TemplateManager
            // Note: The automatic refresh system will handle gallery updates
            const success = this.templateManager.deleteTemplate(templateId);

            if (success) {
                // Clear thumbnail cache for removed template
                this.clearThumbnailCache(templateId);

                // Show success message with checkmark
                this.overlay.handleDisplayStatus(`✓ Template "${templateName}" removed successfully`);

                console.log(`Successfully removed template ${templateId} (${templateName})`);
            } else {
                // Show error message with more context
                console.error(`TemplateManager.deleteTemplate returned false for ${templateId}`);
                this.overlay.handleDisplayError(`Failed to remove template "${templateName}" - operation was rejected`);
            }

        } catch (error) {
            console.error(`Error confirming template removal for ${templateId}:`, error);
            
            // Provide more specific error messages
            let errorMessage = `Failed to remove template "${templateName}"`;
            if (error.name === 'TypeError') {
                errorMessage = `Template "${templateName}" data is corrupted`;
            } else if (error.message.includes('permission')) {
                errorMessage = `Permission denied when removing template "${templateName}"`;
            } else if (error.message.includes('network')) {
                errorMessage = `Network error while removing template "${templateName}"`;
            } else if (error.message.includes('file')) {
                errorMessage = `File system error while removing template "${templateName}"`;
            } else if (error.message) {
                errorMessage = `Failed to remove template "${templateName}": ${error.message}`;
            }
            
            this.overlay.handleDisplayError(errorMessage);
        }
    }

    /**
     * Removes a template card from the gallery display
     * Updates the visual gallery without full refresh for better UX
     * Requirements: 3.4
     * @param {string} templateId - ID of template card to remove
     */
    removeTemplateCardFromDisplay(templateId) {
        // Remove from template cards cache
        const card = this.templateCards.get(templateId);
        if (card) {
            // Animate card removal
            card.style.transition = 'all 0.3s ease';
            card.style.transform = 'scale(0.8)';
            card.style.opacity = '0';

            // Remove from DOM after animation
            setTimeout(() => {
                if (card.parentNode) {
                    card.parentNode.removeChild(card);
                }
            }, 300);

            // Remove from cache
            this.templateCards.delete(templateId);

            console.log(`Removed template card ${templateId} from display`);
        }
    }

    /**
     * Updates an existing template card with current template data
     * Efficiently updates card information without recreating the entire card
     * @param {string} templateId - ID of template to update
     * @param {Object} template - Updated template object
     */
    updateExistingTemplateCard(templateId, template) {
        const card = this.templateCards.get(templateId);
        if (!card) return;

        // Update template name if changed
        const nameElement = card.querySelector('.bm-template-name');
        if (nameElement && template.displayName) {
            const newName = template.displayName;
            if (nameElement.textContent !== newName) {
                nameElement.textContent = newName;
            }
        }

        // Update template stats if changed
        const dimensionsSpan = card.querySelector('.bm-dimensions');
        const pixelCountSpan = card.querySelector('.bm-pixel-count');
        
        if (dimensionsSpan && pixelCountSpan) {
            let dimensions = 'Unknown';
            if (template.file && template.file.width && template.file.height) {
                dimensions = `${template.file.width}×${template.file.height}`;
            }
            
            const pixelCountFormatted = new Intl.NumberFormat().format(template.pixelCount || 0);
            const newPixelText = `${pixelCountFormatted} pixels`;
            
            if (dimensionsSpan.textContent !== dimensions) {
                dimensionsSpan.textContent = dimensions;
            }
            if (pixelCountSpan.textContent !== newPixelText) {
                pixelCountSpan.textContent = newPixelText;
            }
        }

        // Update coordinates if changed
        const coordsElement = card.querySelector('.bm-template-coords');
        if (coordsElement && template.coords) {
            const newCoordsDisplay = `Tile: ${template.coords[0]},${template.coords[1]} Pixel: ${template.coords[2]},${template.coords[3]}`;
            if (coordsElement.textContent !== newCoordsDisplay) {
                coordsElement.textContent = newCoordsDisplay;
            }
        }

        // Update enabled state visual indicators
        const templateIdKey = this.getTemplateId(template);
        let isEnabled = true;
        if (this.templateManager.templatesJSON &&
            this.templateManager.templatesJSON.templates &&
            this.templateManager.templatesJSON.templates[templateIdKey]) {
            isEnabled = this.templateManager.templatesJSON.templates[templateIdKey].enabled !== false;
        }

        this.updateTemplateCardVisualState(templateId, isEnabled);
    }

    /**
     * Reorders template cards in the grid to match the current template array order
     * Ensures visual consistency with template priority/sort order
     * @param {Array} templates - Current templates array in desired order
     */
    reorderTemplateCards(templates) {
        if (!this.galleryElement) return;

        const templateGrid = this.galleryElement.querySelector('.bm-template-grid');
        if (!templateGrid) return;

        // Create a document fragment to efficiently reorder elements
        const fragment = document.createDocumentFragment();
        
        // Append cards in the correct order based on templates array
        templates.forEach(template => {
            const templateId = this.getTemplateId(template);
            const card = this.templateCards.get(templateId);
            if (card && card.parentNode === templateGrid) {
                fragment.appendChild(card);
            }
        });

        // Append the reordered cards back to the grid
        templateGrid.appendChild(fragment);
    }

    /**
     * Sets up automatic refresh when templates are added or removed
     * Hooks into templateManager operations to trigger gallery updates
     * Requirements: 1.4, 3.4
     */
    setupAutomaticRefresh() {
        // Store original methods to wrap them
        const originalCreateTemplate = this.templateManager.createTemplate.bind(this.templateManager);
        const originalDeleteTemplate = this.templateManager.deleteTemplate.bind(this.templateManager);

        // Wrap createTemplate to trigger refresh after template creation
        this.templateManager.createTemplate = async (...args) => {
            const result = await originalCreateTemplate(...args);
            
            // Trigger refresh if gallery is visible
            if (this.isVisible) {
                // Small delay to ensure template is fully processed
                setTimeout(() => {
                    this.refresh();
                    console.log('Gallery auto-refreshed after template creation');
                }, 100);
            }
            
            return result;
        };

        // Wrap deleteTemplate to trigger refresh after template deletion
        this.templateManager.deleteTemplate = (...args) => {
            const result = originalDeleteTemplate(...args);
            
            // Trigger refresh if gallery is visible and deletion was successful
            if (this.isVisible && result) {
                // Small delay to ensure template is fully removed
                setTimeout(() => {
                    this.refresh();
                    console.log('Gallery auto-refreshed after template deletion');
                }, 100);
            }
            
            return result;
        };

        console.log('Automatic gallery refresh system initialized');
    }

    /**
     * Forces a manual refresh of the gallery
     * Useful for external calls when template state changes outside of normal operations
     * Requirements: 1.4, 3.4
     */
    forceRefresh() {
        if (this.isVisible) {
            this.refresh();
            console.log('Gallery manually refreshed');
        }
    }

    /**
     * Sets up state synchronization system to keep gallery in sync with TemplateManager
     * Monitors template state changes and updates gallery accordingly
     * Requirements: 2.4, 3.4
     */
    setupStateSynchronization() {
        // Initialize template state tracking
        this.updateTemplateStateTracking();

        // Set up periodic synchronization check (every 2 seconds when visible)
        this.syncInterval = setInterval(() => {
            if (this.isVisible && !this.isDestroyed) {
                this.syncTemplateStates();
            }
        }, 2000);

        console.log('State synchronization system initialized');
    }

    /**
     * Updates the template state tracking map with current template states
     * Used to detect changes in template properties
     */
    updateTemplateStateTracking() {
        if (!this.templateManager.templatesArray) return;

        this.lastKnownTemplateState.clear();
        
        this.templateManager.templatesArray.forEach(template => {
            const templateId = this.getTemplateId(template);
            
            // Track key properties that affect display
            const state = {
                displayName: template.displayName,
                coords: template.coords ? [...template.coords] : null,
                pixelCount: template.pixelCount,
                enabled: this.getTemplateEnabledState(templateId),
                lastModified: Date.now()
            };
            
            this.lastKnownTemplateState.set(templateId, state);
        });
    }

    /**
     * Gets the enabled state of a template from templatesJSON
     * @param {string} templateId - Template ID to check
     * @returns {boolean} True if template is enabled
     */
    getTemplateEnabledState(templateId) {
        if (this.templateManager.templatesJSON &&
            this.templateManager.templatesJSON.templates &&
            this.templateManager.templatesJSON.templates[templateId]) {
            return this.templateManager.templatesJSON.templates[templateId].enabled !== false;
        }
        return true; // Default to enabled
    }

    /**
     * Synchronizes template states between TemplateManager and gallery display
     * Detects changes and updates gallery cards accordingly
     * Requirements: 2.4, 3.4
     */
    syncTemplateStates() {
        if (this.isDestroyed || !this.isVisible) return;

        const changes = this.detectTemplateChanges();
        
        if (changes.length > 0) {
            console.log(`Detected ${changes.length} template state changes, updating gallery`);
            
            changes.forEach(change => {
                this.updateTemplateState(change);
            });
            
            // Update state tracking with new values
            this.updateTemplateStateTracking();
        }
    }

    /**
     * Detects changes in template states by comparing current state with last known state
     * @returns {Array} Array of change objects describing what changed
     */
    detectTemplateChanges() {
        const changes = [];
        
        if (!this.templateManager.templatesArray) return changes;

        // Check for changes in existing templates
        this.templateManager.templatesArray.forEach(template => {
            const templateId = this.getTemplateId(template);
            const lastKnownState = this.lastKnownTemplateState.get(templateId);
            
            if (!lastKnownState) {
                // New template
                changes.push({
                    type: 'added',
                    templateId,
                    template
                });
                return;
            }

            // Check for property changes
            const currentState = {
                displayName: template.displayName,
                coords: template.coords ? [...template.coords] : null,
                pixelCount: template.pixelCount,
                enabled: this.getTemplateEnabledState(templateId)
            };

            const propertyChanges = [];
            
            if (currentState.displayName !== lastKnownState.displayName) {
                propertyChanges.push('displayName');
            }
            
            if (JSON.stringify(currentState.coords) !== JSON.stringify(lastKnownState.coords)) {
                propertyChanges.push('coords');
            }
            
            if (currentState.pixelCount !== lastKnownState.pixelCount) {
                propertyChanges.push('pixelCount');
            }
            
            if (currentState.enabled !== lastKnownState.enabled) {
                propertyChanges.push('enabled');
            }

            if (propertyChanges.length > 0) {
                changes.push({
                    type: 'modified',
                    templateId,
                    template,
                    properties: propertyChanges,
                    oldState: lastKnownState,
                    newState: currentState
                });
            }
        });

        // Check for removed templates
        this.lastKnownTemplateState.forEach((state, templateId) => {
            const stillExists = this.templateManager.templatesArray.some(template => 
                this.getTemplateId(template) === templateId
            );
            
            if (!stillExists) {
                changes.push({
                    type: 'removed',
                    templateId
                });
            }
        });

        return changes;
    }

    /**
     * Updates template state in the gallery based on detected changes
     * Handles template additions, modifications, and removals
     * Requirements: 2.4, 3.4
     * @param {Object} change - Change object describing what changed
     */
    updateTemplateState(change) {
        switch (change.type) {
            case 'added':
                // New template added - trigger refresh to add it
                console.log(`Template added: ${change.templateId}`);
                this.refresh();
                break;

            case 'removed':
                // Template removed - remove from display
                console.log(`Template removed: ${change.templateId}`);
                this.removeTemplateCardFromDisplay(change.templateId);
                this.templateCards.delete(change.templateId);
                this.clearThumbnailCache(change.templateId);
                break;

            case 'modified':
                // Template properties changed - update card
                console.log(`Template modified: ${change.templateId}, properties: ${change.properties.join(', ')}`);
                
                if (change.properties.includes('enabled')) {
                    // Update visual state for enabled/disabled change
                    this.updateTemplateCardVisualState(change.templateId, change.newState.enabled);
                }
                
                if (change.properties.some(prop => ['displayName', 'coords', 'pixelCount'].includes(prop))) {
                    // Update card content for other property changes
                    this.updateExistingTemplateCard(change.templateId, change.template);
                }
                break;

            default:
                console.warn(`Unknown change type: ${change.type}`);
        }
    }

    /**
     * Performs cleanup when gallery is closed or destroyed
     * Clears intervals, caches, and prevents further operations
     * Requirements: 3.4
     */
    cleanup() {
        // Mark as destroyed to prevent further operations
        this.isDestroyed = true;

        // Clear synchronization interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('State synchronization interval cleared');
        }

        // Clear state tracking
        this.lastKnownTemplateState.clear();

        // Clear caches
        this.templateCards.clear();
        this.thumbnailCache.clear();

        console.log('Gallery cleanup completed');
    }

    /**
     * Reinitializes the gallery after cleanup (useful for reopening)
     * Resets destroyed state and reinitializes synchronization
     */
    reinitialize() {
        this.isDestroyed = false;
        this.setupStateSynchronization();
        console.log('Gallery reinitialized');
    }

    /**
     * Generates a consistent template ID from a template object
     * Handles different template object structures and provides fallbacks
     * @param {Object} template - Template object
     * @returns {string} Template ID in format "sortID authorID"
     */
    getTemplateId(template) {
        if (!template || typeof template !== 'object') {
            console.error('Invalid template object provided to getTemplateId:', template);
            return 'invalid_' + Date.now();
        }

        // Check for standard properties first
        if (template.sortID !== undefined && template.authorID !== undefined) {
            return template.sortID + ' ' + template.authorID;
        }
        
        // Fallback to single ID property
        if (template.id) {
            const idStr = template.id.toString();
            // If it already contains a space, assume it's in the correct format
            if (idStr.includes(' ')) {
                return idStr;
            }
            // Otherwise, try to parse it or use as authorID with sortID 0
            const parts = idStr.split('_');
            if (parts.length >= 2) {
                return parts[0] + ' ' + parts[1];
            } else {
                return '0 ' + idStr;
            }
        }
        
        // Generate fallback ID based on displayName or other properties
        console.warn('Template missing ID properties, generating fallback ID:', template);
        const fallbackId = template.displayName ? 
            template.displayName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) : 
            'unknown_' + Date.now();
        return '0 ' + fallbackId;
    }

    /**
     * Shows loading state on a button with loading indicator
     * Requirements: 3.1
     * @param {HTMLElement} button - Button element to show loading state on
     * @param {string} loadingText - Text to show during loading (optional)
     */
    showButtonLoadingState(button, loadingText = 'Loading...') {
        if (!button) return;

        // Store original content
        if (!button.dataset.originalContent) {
            button.dataset.originalContent = button.innerHTML;
        }

        // Add loading class and disable button
        button.classList.add('bm-loading');
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';

        // Show loading spinner and text
        button.innerHTML = `
            <span class="bm-loading-spinner" style="
                display: inline-block;
                width: 12px;
                height: 12px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: bm-spin 1s ease-in-out infinite;
                margin-right: 5px;
            "></span>
            <span style="font-size: 0.8em;">${loadingText}</span>
        `;

        // Add CSS animation if not already present
        if (!document.getElementById('bm-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'bm-loading-styles';
            style.textContent = `
                @keyframes bm-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Clears loading state from a button and restores original content
     * Requirements: 3.1
     * @param {HTMLElement} button - Button element to clear loading state from
     */
    clearButtonLoadingState(button) {
        if (!button) return;

        // Remove loading class and re-enable button
        button.classList.remove('bm-loading');
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';

        // Restore original content
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
            delete button.dataset.originalContent;
        }
    }

    /**
     * Adds comprehensive tooltips and help text for gallery controls
     * Requirements: 3.1
     * @param {HTMLElement} element - Element to add tooltip to
     * @param {string} tooltipText - Tooltip text to display
     * @param {string} position - Tooltip position ('top', 'bottom', 'left', 'right')
     */
    addTooltip(element, tooltipText, position = 'top') {
        if (!element || !tooltipText) return;

        // Set basic title attribute as fallback
        element.title = tooltipText;

        // Create enhanced tooltip on hover
        let tooltip = null;

        const showTooltip = (e) => {
            // Remove any existing tooltip
            if (tooltip) {
                tooltip.remove();
            }

            // Create tooltip element
            tooltip = document.createElement('div');
            tooltip.className = 'bm-tooltip';
            tooltip.textContent = tooltipText;
            tooltip.style.cssText = `
                position: absolute;
                background-color: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 0.8em;
                font-family: 'Roboto Mono', monospace;
                white-space: nowrap;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;

            document.body.appendChild(tooltip);

            // Position tooltip
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let left, top;

            switch (position) {
                case 'bottom':
                    left = rect.left + (rect.width - tooltipRect.width) / 2;
                    top = rect.bottom + 8;
                    break;
                case 'left':
                    left = rect.left - tooltipRect.width - 8;
                    top = rect.top + (rect.height - tooltipRect.height) / 2;
                    break;
                case 'right':
                    left = rect.right + 8;
                    top = rect.top + (rect.height - tooltipRect.height) / 2;
                    break;
                default: // 'top'
                    left = rect.left + (rect.width - tooltipRect.width) / 2;
                    top = rect.top - tooltipRect.height - 8;
                    break;
            }

            // Ensure tooltip stays within viewport
            left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
            top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';

            // Fade in tooltip
            setTimeout(() => {
                if (tooltip) {
                    tooltip.style.opacity = '1';
                }
            }, 10);
        };

        const hideTooltip = () => {
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
        };

        // Add event listeners
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('focus', showTooltip);
        element.addEventListener('blur', hideTooltip);

        // Clean up on element removal
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === element || (node.contains && node.contains(element))) {
                        hideTooltip();
                        observer.disconnect();
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Shows comprehensive help dialog for gallery usage
     * Requirements: 3.1
     */
    showGalleryHelp() {
        const helpContent = `
            <div style="text-align: left; line-height: 1.5;">
                <h3 style="margin: 0 0 15px 0; color: #1061e5; font-size: 1.2em;">Template Gallery Help</h3>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 1em;">Template Controls:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.8);">
                        <li style="margin-bottom: 5px;"><strong>👁 Toggle:</strong> Enable/disable template visibility on canvas</li>
                        <li style="margin-bottom: 5px;"><strong>📍 Navigate:</strong> Set coordinates to template location and close gallery</li>
                        <li style="margin-bottom: 5px;"><strong>🗑 Remove:</strong> Permanently delete template (requires confirmation)</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 1em;">Keyboard Shortcuts:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.8);">
                        <li style="margin-bottom: 5px;"><strong>ESC:</strong> Close gallery</li>
                        <li style="margin-bottom: 5px;"><strong>Click outside:</strong> Close gallery</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 1em;">Template Information:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.8);">
                        <li style="margin-bottom: 5px;">Each card shows template name, dimensions, and pixel count</li>
                        <li style="margin-bottom: 5px;">Coordinates display current template position</li>
                        <li style="margin-bottom: 5px;">Thumbnails are generated automatically for visual reference</li>
                        <li style="margin-bottom: 5px;">Active templates have blue borders, inactive have gray borders</li>
                    </ul>
                </div>

                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 1em;">Tips:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.8);">
                        <li style="margin-bottom: 5px;">Gallery updates automatically when templates are added or removed</li>
                        <li style="margin-bottom: 5px;">Hover over buttons for detailed tooltips</li>
                        <li style="margin-bottom: 5px;">Template removal requires confirmation to prevent accidents</li>
                    </ul>
                </div>
            </div>
        `;

        // Create help modal
        this.overlay.createModal(
            {
                'id': 'bm-gallery-help-modal',
                'className': 'bm-modal-backdrop bm-gallery-help-backdrop'
            },
            {
                'id': 'bm-gallery-help-content',
                'className': 'bm-modal-content bm-gallery-help-content',
                'style': `
                    background-color: rgba(21, 48, 99, 0.95);
                    color: white;
                    border-radius: 8px;
                    padding: 30px;
                    max-width: 600px;
                    width: 90vw;
                    max-height: 80vh;
                    overflow-y: auto;
                    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
                    letter-spacing: 0.05em;
                    border: 2px solid #1061e5;
                `
            },
            () => {
                // Modal closed
                console.log('Gallery help modal closed');
            }
        )
            .addModalCloseButton().buildElement()
            .addDiv({
                'innerHTML': helpContent,
                'style': 'margin-top: 10px;'
            }).buildElement()
            .addDiv({
                'style': `
                    display: flex;
                    justify-content: center;
                    margin-top: 25px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                `
            })
            .addButton({
                'textContent': 'Got it!',
                'style': `
                    background-color: #1061e5;
                    border: 1px solid #1061e5;
                    border-radius: 4px;
                    padding: 10px 25px;
                    color: white;
                    cursor: pointer;
                    font-size: 1em;
                    font-family: inherit;
                    transition: all 0.2s ease;
                    font-weight: bold;
                `
            }).buildElement()
            .buildElement()
            .buildOverlay(document.body);

        // Add button functionality
        const helpModal = document.getElementById('bm-gallery-help-modal');
        const gotItBtn = helpModal.querySelector('button:last-child');
        
        if (gotItBtn) {
            gotItBtn.addEventListener('click', () => {
                this.overlay.closeModal(helpModal);
            });

            // Add hover effect
            gotItBtn.addEventListener('mouseenter', () => {
                gotItBtn.style.backgroundColor = '#0d5cb8';
                gotItBtn.style.transform = 'translateY(-1px)';
            });

            gotItBtn.addEventListener('mouseleave', () => {
                gotItBtn.style.backgroundColor = '#1061e5';
                gotItBtn.style.transform = 'translateY(0)';
            });
        }
    }

    /**
     * Handles template navigation action
     * Handles template navigation functionality by setting coordinates in overlay
     * Sets the template coordinates in the main overlay coordinate input fields
     * Requirements: 4.1, 4.2, 4.3, 4.4
     * @param {string} templateId - ID of template to navigate to
     */
    handleTemplateNavigate(templateId) {
        try {
            console.log(`Setting coordinates for template: ${templateId}`);

            // Validate templateId parameter
            if (!templateId || typeof templateId !== 'string') {
                console.error('Invalid template ID provided to handleTemplateNavigate:', templateId);
                this.overlay.handleDisplayError('Invalid template ID provided');
                return;
            }

            // Ensure templateManager is available
            if (!this.templateManager) {
                console.error('TemplateManager not available');
                this.overlay.handleDisplayError('Template system not available');
                return;
            }

            // Ensure templatesArray exists
            if (!this.templateManager.templatesArray || !Array.isArray(this.templateManager.templatesArray)) {
                console.error('Templates array not available or invalid');
                this.overlay.handleDisplayError('Template data not available');
                return;
            }

            // Find the template by ID
            const template = this.templateManager.templatesArray.find(t => 
                this.getTemplateId(t) === templateId
            );

            if (!template) {
                console.error(`Template not found in templatesArray: ${templateId}`);
                this.overlay.handleDisplayError('Template not found in system');
                return;
            }

            const templateName = template.displayName || template.name || 'Unnamed Template';

            // Validate template coordinates exist
            if (!template.coords) {
                console.error(`Template ${templateId} (${templateName}) has no coordinates`);
                this.overlay.handleDisplayError(`Template "${templateName}" has no coordinates set`);
                return;
            }

            // Validate coordinates array structure
            if (!Array.isArray(template.coords) || template.coords.length !== 4) {
                console.error(`Invalid coordinates structure for template ${templateId} (${templateName}):`, template.coords);
                this.overlay.handleDisplayError(`Template "${templateName}" has invalid coordinate format`);
                return;
            }

            const [tileX, tileY, pixelX, pixelY] = template.coords;

            // Validate coordinate values are numbers
            if (!Number.isInteger(tileX) || !Number.isInteger(tileY) || 
                !Number.isInteger(pixelX) || !Number.isInteger(pixelY)) {
                console.error(`Non-integer coordinates for template ${templateId} (${templateName}):`, template.coords);
                this.overlay.handleDisplayError(`Template "${templateName}" has invalid coordinate values`);
                return;
            }

            // Validate coordinate ranges (Blue Marble canvas limits)
            const coordinateErrors = [];
            if (tileX < 0 || tileX > 2047) coordinateErrors.push(`Tile X (${tileX}) out of range 0-2047`);
            if (tileY < 0 || tileY > 2047) coordinateErrors.push(`Tile Y (${tileY}) out of range 0-2047`);
            if (pixelX < 0 || pixelX > 999) coordinateErrors.push(`Pixel X (${pixelX}) out of range 0-999`);
            if (pixelY < 0 || pixelY > 999) coordinateErrors.push(`Pixel Y (${pixelY}) out of range 0-999`);

            if (coordinateErrors.length > 0) {
                console.error(`Coordinates out of range for template ${templateId} (${templateName}):`, coordinateErrors);
                this.overlay.handleDisplayError(`Template "${templateName}" coordinates are out of valid range`);
                return;
            }

            // Ensure overlay is available for coordinate setting
            if (!this.overlay) {
                console.error('Overlay not available for coordinate setting');
                this.overlay.handleDisplayError('Interface not available for coordinate setting');
                return;
            }

            // Verify coordinate input fields exist before setting
            const inputFields = ['bm-input-tx', 'bm-input-ty', 'bm-input-px', 'bm-input-py'];
            const missingFields = inputFields.filter(fieldId => !document.getElementById(fieldId));
            
            if (missingFields.length > 0) {
                console.error('Coordinate input fields not found:', missingFields);
                this.overlay.handleDisplayError('Coordinate input fields not available');
                return;
            }

            // Set coordinates in the main overlay input fields
            this.overlay.updateInnerHTML('bm-input-tx', tileX.toString());
            this.overlay.updateInnerHTML('bm-input-ty', tileY.toString());
            this.overlay.updateInnerHTML('bm-input-px', pixelX.toString());
            this.overlay.updateInnerHTML('bm-input-py', pixelY.toString());

            // Update the API manager coordinates if available
            if (this.templateManager.apiManager) {
                try {
                    this.templateManager.apiManager.coordsTilePixel = [tileX, tileY, pixelX, pixelY];
                    console.log('Updated API manager coordinates:', [tileX, tileY, pixelX, pixelY]);
                } catch (apiError) {
                    console.warn('Failed to update API manager coordinates:', apiError);
                    // Don't fail the entire operation for this
                }
            }

            // Display success message with checkmark
            this.overlay.handleDisplayStatus(`✓ Navigated to template "${templateName}" at Tile: ${tileX},${tileY} Pixel: ${pixelX},${pixelY}`);

            console.log(`Successfully set coordinates for template "${templateName}":`, template.coords);

            // Close gallery after successful coordinate setting
            this.hide();

        } catch (error) {
            console.error(`Error setting coordinates for template ${templateId}:`, error);
            
            // Provide more specific error messages
            let errorMessage = 'Failed to navigate to template';
            if (error.name === 'TypeError') {
                errorMessage = 'Template data is corrupted or invalid';
            } else if (error.message.includes('permission')) {
                errorMessage = 'Permission denied when accessing template coordinates';
            } else if (error.message.includes('DOM')) {
                errorMessage = 'Interface error when setting coordinates';
            } else if (error.message) {
                errorMessage = `Failed to navigate to template: ${error.message}`;
            }
            
            this.overlay.handleDisplayError(errorMessage);
        }
    }


}