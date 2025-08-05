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
     * Requirements: 5.1, 5.2, 5.3
     */
    hide() {
        if (!this.isVisible || !this.galleryElement) return;

        // Use the Overlay class closeModal method for proper cleanup
        this.overlay.closeModal(this.galleryElement);

        this.isVisible = false;
        this.galleryElement = null; // Reset reference since modal is removed from DOM
    }

    /**
     * Refreshes the template gallery with current templates
     * Updates the display to reflect current state of templateManager
     */
    refresh() {
        if (!this.galleryElement) return;

        const contentArea = this.galleryElement.querySelector('#bm-gallery-content');
        const templateGrid = contentArea.querySelector('.bm-template-grid');
        const emptyState = contentArea.querySelector('#bm-gallery-empty');
        const countElement = this.galleryElement.querySelector('#bm-gallery-count');

        // Clear existing cards
        templateGrid.innerHTML = '';
        this.templateCards.clear();

        // Get templates from templateManager
        const templates = this.templateManager.templatesArray || [];

        // Update template count in header
        if (countElement) {
            const count = templates.length;
            countElement.textContent = count === 1 ? '1 template' : `${count} templates`;
        }

        if (templates.length === 0) {
            // Show empty state
            templateGrid.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            // Hide empty state and show templates
            emptyState.style.display = 'none';
            templateGrid.style.display = 'grid';

            // Preload thumbnails for better performance
            this.preloadThumbnails(templates);

            // Create cards for each template
            templates.forEach(template => {
                const card = this.createTemplateCard(template);
                templateGrid.appendChild(card);
            });
        }
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
                    gap: 10px;
                    font-size: 0.9em;
                    color: rgba(255, 255, 255, 0.8);
                `
            })
            .addSmall({
                'id': 'bm-gallery-count',
                'textContent': '0 templates',
                'style': 'margin: 0;'
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
                'textContent': 'Load a template to start using the gallery',
                'style': `
                        margin: 0;
                        opacity: 0.8;
                    `
            }).buildElement()
            .buildElement()
            .buildElement()

            // Build the modal and append to document body
            .buildOverlay(document.body);

        // Store reference to the modal element for later use
        this.galleryElement = document.getElementById('bm-gallery-overlay');
    }

    /**
     * Generates a thumbnail for a template using createImageBitmap
     * Creates a 100x100px thumbnail with nearest-neighbor filtering for pixel art
     * Requirements: 1.2
     * @param {Object} template - Template object from templateManager
     * @returns {Promise<HTMLCanvasElement|null>} Canvas element with thumbnail or null if failed
     */
    async generateThumbnail(template) {
        const templateId = template.sortID + ' ' + template.authorID;

        // Check cache first for performance optimization
        if (this.thumbnailCache.has(templateId)) {
            return this.thumbnailCache.get(templateId);
        }

        try {
            // Ensure template has a file to generate thumbnail from
            if (!template.file) {
                console.warn(`Template ${templateId} has no file for thumbnail generation`);
                return null;
            }

            // Create bitmap from template file
            const sourceBitmap = await createImageBitmap(template.file);

            // Create thumbnail canvas with fixed 100x100px size
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 100;
            thumbnailCanvas.height = 100;

            const ctx = thumbnailCanvas.getContext('2d');

            // Configure nearest-neighbor filtering for pixel art
            ctx.imageSmoothingEnabled = false;
            ctx.imageSmoothingQuality = 'high';

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

            // Clear canvas with transparent background
            ctx.clearRect(0, 0, 100, 100);

            // Draw scaled image centered in canvas
            ctx.drawImage(
                sourceBitmap,
                0, 0, sourceWidth, sourceHeight,  // Source rectangle
                offsetX, offsetY, drawWidth, drawHeight  // Destination rectangle
            );

            // Cache the generated thumbnail
            this.thumbnailCache.set(templateId, thumbnailCanvas);

            console.log(`Generated thumbnail for template ${templateId} (${sourceWidth}x${sourceHeight} -> ${Math.round(drawWidth)}x${Math.round(drawHeight)})`);

            return thumbnailCanvas;

        } catch (error) {
            console.error(`Failed to generate thumbnail for template ${templateId}:`, error);

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
                console.warn(`Failed to preload thumbnail for template ${template.sortID} ${template.authorID}:`, error);
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
        const templateId = template.sortID + ' ' + template.authorID;
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

        // Add event listeners (placeholder implementations for now)
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
        try {
            // Ensure templatesJSON exists
            if (!this.templateManager.templatesJSON || 
                !this.templateManager.templatesJSON.templates || 
                !this.templateManager.templatesJSON.templates[templateId]) {
                console.error(`Template ${templateId} not found in templatesJSON`);
                this.overlay.handleDisplayError(`Template ${templateId} not found`);
                return;
            }

            // Get current enabled state
            const currentState = this.templateManager.templatesJSON.templates[templateId].enabled !== false;
            const newState = !currentState;

            // Update enabled state in templatesJSON
            this.templateManager.templatesJSON.templates[templateId].enabled = newState;

            console.log(`Template ${templateId} ${newState ? 'enabled' : 'disabled'}`);

            // Update visual state immediately
            this.updateTemplateCardVisualState(templateId, newState);

            // Display status message
            const templateName = this.templateManager.templatesJSON.templates[templateId].name || 'Template';
            this.overlay.handleDisplayStatus(
                `${templateName} ${newState ? 'enabled' : 'disabled'}`
            );

        } catch (error) {
            console.error(`Error toggling template ${templateId}:`, error);
            this.overlay.handleDisplayError(`Failed to toggle template: ${error.message}`);
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
            // Get template information for confirmation dialog
            const template = this.templateManager.templatesJSON?.templates?.[templateId];
            if (!template) {
                console.error(`Template ${templateId} not found`);
                this.overlay.handleDisplayError(`Template ${templateId} not found`);
                return;
            }

            const templateName = template.name || 'Unnamed Template';

            // Show confirmation dialog
            this.showRemoveConfirmationDialog(templateId, templateName);

        } catch (error) {
            console.error(`Error initiating template removal for ${templateId}:`, error);
            this.overlay.handleDisplayError(`Failed to remove template: ${error.message}`);
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
                'textContent': 'This action cannot be undone.',
                'style': `
                    color: rgba(255, 255, 255, 0.7);
                    font-style: italic;
                    display: block;
                    margin-bottom: 20px;
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
            // Remove template using TemplateManager
            const success = this.templateManager.deleteTemplate(templateId);

            if (success) {
                // Clear thumbnail cache for removed template
                this.clearThumbnailCache(templateId);

                // Remove template card from gallery display
                this.removeTemplateCardFromDisplay(templateId);

                // Refresh gallery to update counts and empty state
                this.refresh();

                // Show success message
                this.overlay.handleDisplayStatus(`Template "${templateName}" removed successfully`);

                console.log(`Successfully removed template ${templateId}`);
            } else {
                // Show error message
                this.overlay.handleDisplayError(`Failed to remove template "${templateName}"`);
            }

        } catch (error) {
            console.error(`Error confirming template removal for ${templateId}:`, error);
            this.overlay.handleDisplayError(`Failed to remove template: ${error.message}`);
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
     * Handles template navigation action
     * Handles template navigation functionality by setting coordinates in overlay
     * Sets the template coordinates in the main overlay coordinate input fields
     * Requirements: 4.3
     * @param {string} templateId - ID of template to navigate to
     */
    handleTemplateNavigate(templateId) {
        console.log(`Setting coordinates for template: ${templateId}`);

        // Find the template by ID
        const template = this.templateManager.templatesArray?.find(t => 
            (t.sortID + ' ' + t.authorID) === templateId
        );

        if (!template) {
            console.error(`Template not found: ${templateId}`);
            this.overlay.handleDisplayError('Template not found!');
            return;
        }

        // Validate template coordinates
        if (!template.coords || template.coords.length !== 4) {
            console.error(`Invalid coordinates for template: ${templateId}`, template.coords);
            this.overlay.handleDisplayError('Template coordinates are invalid!');
            return;
        }

        const [tileX, tileY, pixelX, pixelY] = template.coords;

        // Validate coordinate ranges
        if (tileX < 0 || tileX > 2047 || tileY < 0 || tileY > 2047 ||
            pixelX < 0 || pixelX > 999 || pixelY < 0 || pixelY > 999) {
            console.error(`Coordinates out of range for template: ${templateId}`, template.coords);
            this.overlay.handleDisplayError('Template coordinates are out of valid range!');
            return;
        }

        try {
            // Set coordinates in the main overlay input fields
            this.overlay.updateInnerHTML('bm-input-tx', tileX.toString());
            this.overlay.updateInnerHTML('bm-input-ty', tileY.toString());
            this.overlay.updateInnerHTML('bm-input-px', pixelX.toString());
            this.overlay.updateInnerHTML('bm-input-py', pixelY.toString());

            // Update the API manager coordinates if available
            if (this.templateManager.apiManager) {
                this.templateManager.apiManager.coordsTilePixel = [tileX, tileY, pixelX, pixelY];
            }

            // Display success message
            const templateName = template.displayName || 'Unnamed Template';
            this.overlay.handleDisplayStatus(`Coordinates set to template "${templateName}" at Tile: ${tileX},${tileY} Pixel: ${pixelX},${pixelY}`);

            console.log(`Successfully set coordinates for template "${templateName}":`, template.coords);

            // Close gallery after successful coordinate setting
            this.hide();

        } catch (error) {
            console.error(`Error setting coordinates for template ${templateId}:`, error);
            this.overlay.handleDisplayError('Failed to set template coordinates!');
        }
    }


}